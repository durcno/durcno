import fs from "node:fs";
import path from "node:path";
import { MIGRATION_NAME_REGEX } from "durcno/migration";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
} from "../../../docker-utils";
import { rmSync, runDurcno } from "../../../helpers";

describe("durcno generate - index changes (column + index ordering)", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  let containerInfo: TestContainerInfo;
  let client: pg.Client;

  function runGenerateAndMigrate(stage: number): {
    success: boolean;
    output: string;
  } {
    const env = {
      ...process.env,
      STAGE: String(stage),
      DATABASE_PORT: String(containerInfo.port),
    };

    let genOutput = "";
    try {
      genOutput = runDurcno(
        ["generate", "--config", configPath],
        env,
        process.cwd(),
      );
    } catch (e: unknown) {
      return {
        success: false,
        output: e instanceof Error ? e.message : String(e),
      };
    }

    try {
      const migrateOutput = runDurcno(
        ["migrate", "--config", configPath],
        env,
        __dirname,
      );
      return {
        success: true,
        output: genOutput + migrateOutput,
      };
    } catch (e: unknown) {
      return {
        success: false,
        output: genOutput + (e instanceof Error ? e.message : String(e)),
      };
    }
  }

  function getMigrationFolders(): string[] {
    if (!fs.existsSync(migrationsDir)) return [];
    return fs
      .readdirSync(migrationsDir)
      .filter((f) => MIGRATION_NAME_REGEX.test(f))
      .sort();
  }

  /** Returns index names for the products table. */
  async function getProductsIndexes(): Promise<string[]> {
    const result = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = 'products'
      AND indexname != 'products_pkey'
      ORDER BY indexname;
    `);
    return result.rows.map((r) => r.indexname);
  }

  /** Returns column names for the products table. */
  async function getProductsColumns(): Promise<string[]> {
    const result = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'products'
      ORDER BY ordinal_position;
    `);
    return result.rows.map((r) => r.column_name);
  }

  beforeAll(async () => {
    rmSync(migrationsDir);
    delete process.env.STAGE;

    containerInfo = await startPostgresContainer({
      user: "testuser",
      password: "testpass",
      dbName: "testdb",
    });
    client = new pg.Client(containerInfo.connectionString);
    await client.connect();
  }, 120000);

  afterAll(async () => {
    await client?.end().catch(console.error);
    await stopPostgresContainer(containerInfo.container);
  });

  it("[stage 1] should generate and apply initial migration with indexed sku column", async () => {
    const result = runGenerateAndMigrate(1);
    expect(result.success).toBe(true);
    expect(getMigrationFolders()).toHaveLength(1);

    const cols = await getProductsColumns();
    expect(cols).toContain("sku");
    expect(cols).not.toContain("category");

    const indexes = await getProductsIndexes();
    expect(indexes.length).toBe(1);
    expect(indexes[0]).toContain("sku");
  });

  it("[stage 2] should add category column with new index (addColumn before createIndex)", async () => {
    const result = runGenerateAndMigrate(2);
    expect(result.success).toBe(true);
    expect(getMigrationFolders()).toHaveLength(2);

    const cols = await getProductsColumns();
    expect(cols).toContain("sku");
    expect(cols).toContain("category");

    const indexes = await getProductsIndexes();
    expect(indexes.length).toBe(2);
    const skuIdx = indexes.find((i) => i.includes("sku"));
    const catIdx = indexes.find((i) => i.includes("category"));
    expect(skuIdx).toBeDefined();
    expect(catIdx).toBeDefined();
  });

  it("[stage 3] should drop sku column and its index (dropIndex before dropColumn)", async () => {
    const result = runGenerateAndMigrate(3);
    expect(result.success).toBe(true);
    expect(getMigrationFolders()).toHaveLength(3);

    const cols = await getProductsColumns();
    expect(cols).not.toContain("sku");
    expect(cols).toContain("category");

    const indexes = await getProductsIndexes();
    expect(indexes.length).toBe(1);
    expect(indexes[0]).toContain("category");
  });

  it("[stage 4] should drop category index without dropping the column (dropIndex only)", async () => {
    const result = runGenerateAndMigrate(4);
    expect(result.success).toBe(true);
    expect(getMigrationFolders()).toHaveLength(4);

    const cols = await getProductsColumns();
    expect(cols).toContain("category");

    const indexes = await getProductsIndexes();
    expect(indexes.length).toBe(0);
  });
});
