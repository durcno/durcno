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

describe("durcno generate - table changes", () => {
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

  it("[stage 1] should generate and apply initial migration creating users table", async () => {
    const result = runGenerateAndMigrate(1);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(1);

    // Verify users table exists and posts does not
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesResult.rows.map((row) => row.table_name);
    expect(tableNames).toContain("users");
    expect(tableNames).not.toContain("posts");

    // Verify initial columns exist and optional ones do not
    const columnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    const columnNames = columnsResult.rows.map((row) => row.column_name);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("username");
    expect(columnNames).toContain("email");
    expect(columnNames).toContain("created_at");
    expect(columnNames).not.toContain("bio");
    expect(columnNames).not.toContain("age");
  });

  it("[stage 2] should generate and apply migration adding columns to users and creating posts table", async () => {
    const result = runGenerateAndMigrate(2);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(2);

    // Verify posts table now exists
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesResult.rows.map((row) => row.table_name);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("posts");

    // Verify users table now has bio and age columns
    const usersColumnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    const usersColumns = usersColumnsResult.rows.reduce(
      (acc, row) => {
        acc[row.column_name] = {
          type: row.data_type,
          nullable: row.is_nullable === "YES",
        };
        return acc;
      },
      {} as Record<string, { type: string; nullable: boolean }>,
    );
    expect(usersColumns.bio).toBeDefined();
    expect(usersColumns.bio.type).toBe("text");
    expect(usersColumns.age).toBeDefined();
    expect(usersColumns.age.type).toBe("integer");

    // Verify posts table structure
    const postsColumnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'posts'
      ORDER BY ordinal_position;
    `);
    const postsColumns = postsColumnsResult.rows.reduce(
      (acc, row) => {
        acc[row.column_name] = {
          type: row.data_type,
          nullable: row.is_nullable === "YES",
        };
        return acc;
      },
      {} as Record<string, { type: string; nullable: boolean }>,
    );
    expect(postsColumns.id).toBeDefined();
    expect(postsColumns.title).toBeDefined();
    expect(postsColumns.content).toBeDefined();
    expect(postsColumns.user_id).toBeDefined();
    expect(postsColumns.published_at).toBeDefined();
    expect(postsColumns.created_at).toBeDefined();
  });

  it("[stage 3] should generate and apply migration dropping bio column (column drop)", async () => {
    const result = runGenerateAndMigrate(3);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(3);

    // Verify posts table still exists
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesResult.rows.map((row) => row.table_name);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("posts");

    // Verify bio column was dropped, but age remains
    const columnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    const columnNames = columnsResult.rows.map((row) => row.column_name);
    expect(columnNames).not.toContain("bio");
    expect(columnNames).toContain("age");
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("username");
    expect(columnNames).toContain("email");
  });

  it("[stage 4] should generate and apply migration dropping posts table (table drop)", async () => {
    const result = runGenerateAndMigrate(4);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(4);

    // Verify posts table was dropped
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesResult.rows.map((row) => row.table_name);
    expect(tableNames).toContain("users");
    expect(tableNames).not.toContain("posts");

    // Users table should still have age (bio was already dropped in stage 3)
    const columnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    const columnNames = columnsResult.rows.map((row) => row.column_name);
    expect(columnNames).toContain("age");
    expect(columnNames).not.toContain("bio");
  });

  it("[stage 4] should detect no changes when schema is unchanged", () => {
    const result = spawnSync("durcno", ["generate", "--config", configPath], {
      encoding: "utf8",
      cwd: process.cwd(),
      env: {
        ...process.env,
        STAGE: "4",
        DATABASE_PORT: String(containerInfo.port),
      },
    });
    const output = result.stdout + result.stderr;
    expect(output).toContain("No changes detected");

    // Should not create a new migration folder
    const folders = getMigrationFolders();
    expect(folders).toHaveLength(4);
  });

  it("should verify migration folders follow ISO timestamp naming", () => {
    const folders = getMigrationFolders();
    expect(folders.length).toBeGreaterThanOrEqual(4);

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

  it("should be able to insert and query data after migrations", async () => {
    // At stage 4: users has age but no bio, posts table is dropped
    await client.query(`
      INSERT INTO users (username, email, age, "created_at")
      VALUES ('testuser', 'test@example.com', 30, now());
    `);

    const userResult = await client.query(
      "SELECT username, email, age FROM users WHERE username = $1",
      ["testuser"],
    );
    expect(userResult.rows.length).toBe(1);
    expect(userResult.rows[0].username).toBe("testuser");
    expect(userResult.rows[0].email).toBe("test@example.com");
    expect(userResult.rows[0].age).toBe(30);
  });
});
