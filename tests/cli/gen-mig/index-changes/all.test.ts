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

describe("durcno generate - index changes (column + index ordering, partial indexes)", () => {
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

  /** Returns index names and definitions for the users table. */
  async function getUsersIndexes(): Promise<
    { indexname: string; indexdef: string }[]
  > {
    const result = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = 'users'
      AND indexname != 'users_pkey'
      ORDER BY indexname;
    `);
    return result.rows;
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

  it("[stage 1] should generate and apply initial migration with indexed sku column and partial indexes", async () => {
    const result = runGenerateAndMigrate(1);
    expect(result.success).toBe(true);
    const folders = getMigrationFolders();
    expect(folders).toHaveLength(1);

    // Products table checks
    const cols = await getProductsColumns();
    expect(cols).toContain("sku");
    expect(cols).not.toContain("category");

    const pIndexes = await getProductsIndexes();
    expect(pIndexes.length).toBe(1);
    expect(pIndexes[0]).toContain("sku");

    // Users table partial indexes checks in up.ts
    const upFile = fs.readFileSync(
      path.resolve(migrationsDir, folders[0], "up.ts"),
      "utf-8",
    );
    expect(upFile).toContain('.where(`"deleted_at" IS NULL`)');
    expect(upFile).toContain(".where(`\"status\" = 'active'`)");

    // Users table indexes in PostgreSQL
    const uIndexes = await getUsersIndexes();
    expect(uIndexes.length).toBe(2);

    const emailIdx = uIndexes.find(
      (i) => i.indexname === "users_active_email_idx",
    );
    expect(emailIdx).toBeDefined();
    expect(emailIdx?.indexdef).toContain("UNIQUE");
    expect(emailIdx?.indexdef).toContain("WHERE (deleted_at IS NULL)");

    const statusIdx = uIndexes.find((i) => i.indexname === "users_status_idx");
    expect(statusIdx).toBeDefined();
    expect(statusIdx?.indexdef).toContain("WHERE");
    expect(statusIdx?.indexdef).toContain("active");

    // Test partial unique index behavior:
    // 1. Insert active row
    await client.query(
      `INSERT INTO users (email, status) VALUES ('user@example.com', 'active')`,
    );

    // 2. Duplicate active row should fail
    await expect(
      client.query(
        `INSERT INTO users (email, status) VALUES ('user@example.com', 'active')`,
      ),
    ).rejects.toThrow();

    // 3. Duplicate soft-deleted rows should succeed
    await client.query(
      `INSERT INTO users (email, status, deleted_at) VALUES ('user@example.com', 'inactive', NOW())`,
    );
    await client.query(
      `INSERT INTO users (email, status, deleted_at) VALUES ('user@example.com', 'inactive', NOW())`,
    );
  });

  it("[stage 2] should add category column with new index and modify partial index predicate", async () => {
    const result = runGenerateAndMigrate(2);
    expect(result.success).toBe(true);
    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);

    // Products table checks
    const cols = await getProductsColumns();
    expect(cols).toContain("sku");
    expect(cols).toContain("category");

    const pIndexes = await getProductsIndexes();
    expect(pIndexes.length).toBe(2);
    const skuIdx = pIndexes.find((i) => i.includes("sku"));
    const catIdx = pIndexes.find((i) => i.includes("category"));
    expect(skuIdx).toBeDefined();
    expect(catIdx).toBeDefined();

    // Users table partial index update checks
    const upFile = fs.readFileSync(
      path.resolve(migrationsDir, folders[1], "up.ts"),
      "utf-8",
    );
    expect(upFile).toContain('ddl.dropIndex("users_status_idx")');
    expect(upFile).toContain(".where(`\"status\" = 'archived'`)");

    const uIndexes = await getUsersIndexes();
    const statusIdx = uIndexes.find((i) => i.indexname === "users_status_idx");
    expect(statusIdx).toBeDefined();
    expect(statusIdx?.indexdef).toContain("archived");
  });

  it("[stage 3] should drop sku column and index, and drop removed partial index", async () => {
    const result = runGenerateAndMigrate(3);
    expect(result.success).toBe(true);
    const folders = getMigrationFolders();
    expect(folders).toHaveLength(3);

    // Products table checks
    const cols = await getProductsColumns();
    expect(cols).not.toContain("sku");
    expect(cols).toContain("category");

    const pIndexes = await getProductsIndexes();
    expect(pIndexes.length).toBe(1);
    expect(pIndexes[0]).toContain("category");

    // Users table checks
    const upFile = fs.readFileSync(
      path.resolve(migrationsDir, folders[2], "up.ts"),
      "utf-8",
    );
    expect(upFile).toContain('ddl.dropIndex("users_status_idx")');

    const uIndexes = await getUsersIndexes();
    expect(uIndexes.length).toBe(1);
    expect(uIndexes[0].indexname).toBe("users_active_email_idx");
  });

  it("[stage 4] should drop category index without dropping the column (dropIndex only)", async () => {
    const result = runGenerateAndMigrate(4);
    expect(result.success).toBe(true);
    const folders = getMigrationFolders();
    expect(folders).toHaveLength(4);

    // Products table checks
    const cols = await getProductsColumns();
    expect(cols).toContain("category");

    const pIndexes = await getProductsIndexes();
    expect(pIndexes.length).toBe(0);

    // Users table checks (active email index remains)
    const uIndexes = await getUsersIndexes();
    expect(uIndexes.length).toBe(1);
    expect(uIndexes[0].indexname).toBe("users_active_email_idx");
  });
});
