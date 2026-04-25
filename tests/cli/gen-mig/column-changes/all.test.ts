import { spawnSync } from "node:child_process";
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
import { rmSync } from "../../../helpers";

describe("durcno generate - column changes (ALTER COLUMN)", () => {
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

    const genResult = spawnSync(
      "durcno",
      ["generate", "--config", configPath],
      {
        encoding: "utf8",
        cwd: process.cwd(),
        env,
      },
    );
    if (genResult.status !== 0) {
      return {
        success: false,
        output: genResult.stdout + genResult.stderr,
      };
    }

    const migrateResult = spawnSync(
      "durcno",
      ["migrate", "--config", configPath],
      {
        encoding: "utf8",
        cwd: __dirname,
        env,
      },
    );
    return {
      success: migrateResult.status === 0,
      output:
        genResult.stdout +
        genResult.stderr +
        migrateResult.stdout +
        migrateResult.stderr,
    };
  }

  function getMigrationFolders(): string[] {
    if (!fs.existsSync(migrationsDir)) return [];
    return fs
      .readdirSync(migrationsDir)
      .filter((f) => MIGRATION_NAME_REGEX.test(f))
      .sort();
  }

  /** Returns a map of column_name -> { type, nullable, hasDefault } for the articles table. */
  async function getArticlesColumns(): Promise<
    Record<string, { type: string; nullable: boolean; hasDefault: boolean }>
  > {
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'articles'
      ORDER BY ordinal_position;
    `);
    return result.rows.reduce(
      (acc, row) => {
        acc[row.column_name] = {
          type: row.data_type,
          nullable: row.is_nullable === "YES",
          hasDefault: row.column_default !== null,
        };
        return acc;
      },
      {} as Record<
        string,
        { type: string; nullable: boolean; hasDefault: boolean }
      >,
    );
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

  it("[stage 1] should generate and apply initial migration creating articles table", async () => {
    const result = runGenerateAndMigrate(1);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(1);

    const cols = await getArticlesColumns();

    // title: varchar(100) notNull
    expect(cols.title).toBeDefined();
    expect(cols.title.type).toBe("character varying");
    expect(cols.title.nullable).toBe(false);

    // body: text nullable
    expect(cols.body).toBeDefined();
    expect(cols.body.type).toBe("text");
    expect(cols.body.nullable).toBe(true);

    // views: integer nullable, no default
    expect(cols.views).toBeDefined();
    expect(cols.views.type).toBe("integer");
    expect(cols.views.nullable).toBe(true);
    expect(cols.views.hasDefault).toBe(false);
  });

  it("[stage 2] should generate and apply migration changing title type from varchar to text (alterColumnType)", async () => {
    const result = runGenerateAndMigrate(2);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(2);

    const cols = await getArticlesColumns();

    // title: now text notNull
    expect(cols.title.type).toBe("text");
    expect(cols.title.nullable).toBe(false);

    // body and views unchanged
    expect(cols.body.type).toBe("text");
    expect(cols.body.nullable).toBe(true);
    expect(cols.views.type).toBe("integer");
    expect(cols.views.hasDefault).toBe(false);
  });

  it("[stage 3] should generate and apply migration adding NOT NULL to body (setNotNull)", async () => {
    const result = runGenerateAndMigrate(3);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(3);

    const cols = await getArticlesColumns();

    // body: now notNull
    expect(cols.body.nullable).toBe(false);

    // title and views unchanged
    expect(cols.title.type).toBe("text");
    expect(cols.views.hasDefault).toBe(false);
  });

  it("[stage 4] should generate and apply migration dropping NOT NULL from body (dropNotNull)", async () => {
    const result = runGenerateAndMigrate(4);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(4);

    const cols = await getArticlesColumns();

    // body: back to nullable
    expect(cols.body.nullable).toBe(true);

    // title and views unchanged
    expect(cols.title.type).toBe("text");
    expect(cols.views.hasDefault).toBe(false);
  });

  it("[stage 5] should generate and apply migration setting default on views (setDefault)", async () => {
    const result = runGenerateAndMigrate(5);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(5);

    const cols = await getArticlesColumns();

    // views: now has default 0
    expect(cols.views.hasDefault).toBe(true);

    // Insert a row without providing views and verify the default applies
    await client.query(
      `INSERT INTO articles (title, "body") VALUES ('Default Test', 'content')`,
    );
    const row = await client.query(
      "SELECT views FROM articles WHERE title = $1",
      ["Default Test"],
    );
    expect(row.rows[0].views).toBe(0);
  });

  it("[stage 6] should generate and apply migration dropping default from views (dropDefault)", async () => {
    const result = runGenerateAndMigrate(6);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(6);

    const cols = await getArticlesColumns();

    // views: default removed
    expect(cols.views.hasDefault).toBe(false);

    // body and title unchanged
    expect(cols.body.nullable).toBe(true);
    expect(cols.title.type).toBe("text");
  });

  it("[stage 6] should detect no changes when schema is unchanged", () => {
    const result = spawnSync("durcno", ["generate", "--config", configPath], {
      encoding: "utf8",
      cwd: process.cwd(),
      env: {
        ...process.env,
        STAGE: "6",
        DATABASE_PORT: String(containerInfo.port),
      },
    });
    const output = result.stdout + result.stderr;
    expect(output).toContain("No changes detected");

    expect(getMigrationFolders()).toHaveLength(6);
  });

  it("should verify migration folders follow ISO timestamp naming", () => {
    const folders = getMigrationFolders();
    expect(folders.length).toBeGreaterThanOrEqual(6);

    for (const folder of folders) {
      expect(MIGRATION_NAME_REGEX.test(folder)).toBe(true);
    }

    // Verify migrations are in chronological order
    for (let i = 1; i < folders.length; i++) {
      const toISOString = (d: string) =>
        `${d.split("T")[0]}T${d.split("T")[1].replace(/-/g, ":")}`;
      const prevTime = new Date(toISOString(folders[i - 1])).getTime();
      const currTime = new Date(toISOString(folders[i])).getTime();
      expect(currTime).toBeGreaterThan(prevTime);
    }
  });
});
