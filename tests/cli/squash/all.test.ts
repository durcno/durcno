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
} from "../../docker-utils";
import { rmSync } from "../../helpers";

describe("durcno squash command", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  let containerInfo: TestContainerInfo;
  let client: pg.Client;
  let databasePort: string;
  let databaseName: string;

  let migration1: string;
  let migration2: string;
  let migration3: string;

  function getMigrationFolders(): string[] {
    if (!fs.existsSync(migrationsDir)) return [];
    return fs
      .readdirSync(migrationsDir)
      .filter((f) => MIGRATION_NAME_REGEX.test(f))
      .sort();
  }

  function runGenerate(version: number): { success: boolean; output: string } {
    const result = spawnSync("durcno", ["generate", "--config", configPath], {
      encoding: "utf8",
      cwd: __dirname,
      env: {
        ...process.env,
        MIGRATION_VERSION: String(version),
        DATABASE_PORT: databasePort,
        DB_NAME: databaseName,
      },
    });
    return {
      success: result.status === 0,
      output: result.stdout + result.stderr,
    };
  }

  function runMigrate(): { success: boolean; output: string } {
    const result = spawnSync("durcno", ["migrate", "--config", configPath], {
      encoding: "utf8",
      cwd: __dirname,
      env: {
        ...process.env,
        DATABASE_PORT: databasePort,
        DB_NAME: databaseName,
      },
    });
    return {
      success: result.status === 0,
      output: result.stdout + result.stderr,
    };
  }

  function runSquash(
    start: string,
    end: string,
    opts?: { force?: boolean },
  ): { success: boolean; output: string } {
    const args = ["squash", start, end, "--config", configPath];
    if (opts?.force) args.push("--force");
    const result = spawnSync("durcno", args, {
      encoding: "utf8",
      cwd: __dirname,
      env: {
        ...process.env,
        DATABASE_PORT: databasePort,
        DB_NAME: databaseName,
      },
    });
    return {
      success: result.status === 0,
      output: result.stdout + result.stderr,
    };
  }

  beforeAll(async () => {
    rmSync(migrationsDir);

    containerInfo = await startPostgresContainer({
      image: "postgres:16-alpine",
      containerNamePrefix: "durcno-squash-tests",
    });
    databasePort = String(containerInfo.port);
    databaseName = containerInfo.dbName;

    client = new pg.Client(containerInfo.connectionString);
    await client.connect();
  }, 120000);

  afterAll(async () => {
    await client?.end().catch(console.error);
    await stopPostgresContainer(containerInfo.container);
  });

  it("[step 1] should generate initial migration creating users table", () => {
    const result = runGenerate(1);
    expect(result.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(1);
    migration1 = folders[0];
  });

  it("[step 2] should generate migration adding bio and age to users", async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = runGenerate(2);
    expect(result.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);
    migration2 = folders[1];
  });

  it("[step 3] should generate migration creating posts table", async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = runGenerate(3);
    expect(result.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(3);
    migration3 = folders[2];
  });

  it("[error] should fail when start migration does not exist", () => {
    const result = runSquash("1999-01-01T00-00-00.000Z", migration2);
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
    expect(getMigrationFolders()).toHaveLength(3);
  });

  it("[error] should fail when end migration does not exist", () => {
    const result = runSquash(migration1, "2099-01-01T00-00-00.000Z");
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
    expect(getMigrationFolders()).toHaveLength(3);
  });

  it("[error] should fail when start comes after end", () => {
    const result = runSquash(migration3, migration1);
    expect(result.success).toBe(false);
    expect(result.output).toContain("must come before");
    expect(getMigrationFolders()).toHaveLength(3);
  });

  it("[error] should exit when only one migration in range", () => {
    const result = runSquash(migration1, migration1);
    expect(result.output).toContain("Nothing to squash");
    expect(getMigrationFolders()).toHaveLength(3);
  });

  it("[custom] should inject custom statement into migration 2", () => {
    const upPath = path.join(migrationsDir, migration2, "up.ts");
    const originalContent = fs.readFileSync(upPath, "utf8");
    const withCustom = originalContent.replace(
      /];(\s*)$/,
      `  ddl.custom("SELECT 1;"),\n];$1`,
    );
    fs.writeFileSync(upPath, withCustom);
    expect(fs.readFileSync(upPath, "utf8")).toContain(
      'ddl.custom("SELECT 1;")',
    );
  });

  it("[custom] should fail squash when custom statements exist without --force", () => {
    const result = runSquash(migration1, migration2);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Custom statements");
    expect(result.output).toContain("--force");
    expect(getMigrationFolders()).toHaveLength(3);
  });

  it("[custom] should squash migrations 1+2 with --force skipping custom statements", () => {
    const result = runSquash(migration1, migration2, { force: true });
    expect(result.success).toBe(true);
    expect(result.output).toContain("2");

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);
    // Squashed migration uses the start migration's timestamp
    expect(folders[0]).toBe(migration1);
    // migration3 is now the second remaining migration
    migration2 = folders[1];
  });

  it("[squash] should squash remaining two migrations into one", () => {
    const result = runSquash(migration1, migration2);
    expect(result.success).toBe(true);
    expect(result.output).toContain("2");

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(1);
    expect(folders[0]).toBe(migration1);
  });

  it("[squash] squashed migration should have up.ts and down.ts", () => {
    const squashedDir = path.join(migrationsDir, migration1);
    expect(fs.existsSync(path.join(squashedDir, "up.ts"))).toBe(true);
    expect(fs.existsSync(path.join(squashedDir, "down.ts"))).toBe(true);
  });

  it("[squash] should apply squashed migration and create full schema", async () => {
    const migrateResult = runMigrate();
    expect(migrateResult.success).toBe(true);

    // Verify users table with all columns (v1 + v2)
    const usersColumnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    const userColNames = usersColumnsResult.rows.map(
      (row: { column_name: string }) => row.column_name,
    );
    expect(userColNames).toContain("id");
    expect(userColNames).toContain("username");
    expect(userColNames).toContain("email");
    expect(userColNames).toContain("created_at");
    expect(userColNames).toContain("bio");
    expect(userColNames).toContain("age");

    // Verify posts table (v3)
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesResult.rows.map(
      (row: { table_name: string }) => row.table_name,
    );
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("posts");

    // Verify posts columns
    const postsColumnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'posts'
      ORDER BY ordinal_position;
    `);
    const postColNames = postsColumnsResult.rows.map(
      (row: { column_name: string }) => row.column_name,
    );
    expect(postColNames).toContain("id");
    expect(postColNames).toContain("title");
    expect(postColNames).toContain("content");
    expect(postColNames).toContain("author_id");

    // Verify foreign key
    const fkResult = await client.query(`
      SELECT
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'posts';
    `);
    expect(fkResult.rows).toHaveLength(1);
    expect(fkResult.rows[0].column_name).toBe("author_id");
    expect(fkResult.rows[0].foreign_table_name).toBe("users");
  });

  it("[squash] should detect no changes when schema is unchanged", () => {
    const result = runGenerate(3);
    expect(result.output).toContain("No changes detected");
    expect(getMigrationFolders()).toHaveLength(1);
  });
});
