import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
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
  let pgContainer: Docker.Container;
  let client: pg.Client;
  let connectionString: string;
  let databasePort: string;
  let databaseName: string;

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

  async function cleanDatabase() {
    await client.query(`
      DROP TABLE IF EXISTS public.posts CASCADE;
      DROP TABLE IF EXISTS public.users CASCADE;
      DROP TABLE IF EXISTS durcno.migrations CASCADE;
      DROP SCHEMA IF EXISTS durcno CASCADE;
    `);
  }

  async function resetState() {
    rmSync(migrationsDir);
    await cleanDatabase();
  }

  beforeAll(async () => {
    rmSync(migrationsDir);

    if (process.env.PG_CONNECTION_STRING) {
      connectionString = process.env.PG_CONNECTION_STRING;
    } else {
      containerInfo = await startPostgresContainer({
        image: "postgres:16",
        containerNamePrefix: "durcno-squash-tests",
      });
      pgContainer = containerInfo.container;
      connectionString = containerInfo.connectionString;
    }

    const url = new URL(connectionString);
    databasePort = url.port;
    databaseName = containerInfo?.dbName ?? url.pathname.slice(1);

    client = new pg.Client(connectionString);
    await client.connect();
  }, 120000);

  afterAll(async () => {
    rmSync(migrationsDir);
    await client?.end().catch(console.error);
    if (pgContainer) await stopPostgresContainer(pgContainer);
  });

  describe("squash two migrations", () => {
    let firstMigration: string;
    let secondMigration: string;

    it("should generate and setup two migrations", async () => {
      await resetState();

      // Generate first migration (Users table)
      const gen1 = runGenerate(1);
      expect(gen1.success).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Generate second migration (add bio, age to Users)
      const gen2 = runGenerate(2);
      expect(gen2.success).toBe(true);

      const folders = getMigrationFolders();
      expect(folders).toHaveLength(2);

      firstMigration = folders[0];
      secondMigration = folders[1];
    });

    it("should squash two migrations into one", () => {
      const result = runSquash(firstMigration, secondMigration);
      expect(result.success).toBe(true);
      expect(result.output).toContain("2");

      const folders = getMigrationFolders();
      expect(folders).toHaveLength(1);
      // The squashed migration uses the start migration's timestamp
      expect(folders[0]).toBe(firstMigration);
    });

    it("squashed migration should have up.ts and down.ts", () => {
      const squashedDir = path.join(migrationsDir, firstMigration);
      expect(fs.existsSync(path.join(squashedDir, "up.ts"))).toBe(true);
      expect(fs.existsSync(path.join(squashedDir, "down.ts"))).toBe(true);
    });

    it("squashed migration should apply correctly and create full schema", async () => {
      const migrateResult = runMigrate();
      expect(migrateResult.success).toBe(true);

      // Verify users table exists with ALL columns (from both migrations combined)
      const columnsResult = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        ORDER BY ordinal_position;
      `);
      const columnNames = columnsResult.rows.map(
        (row: { column_name: string }) => row.column_name,
      );
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("username");
      expect(columnNames).toContain("email");
      expect(columnNames).toContain("created_at");
      expect(columnNames).toContain("bio");
      expect(columnNames).toContain("age");
    });
  });

  describe("squash three migrations", () => {
    let firstMigration: string;
    let secondMigration: string;
    let thirdMigration: string;

    it("should generate three migrations", async () => {
      await resetState();

      const gen1 = runGenerate(1);
      expect(gen1.success).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const gen2 = runGenerate(2);
      expect(gen2.success).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const gen3 = runGenerate(3);
      expect(gen3.success).toBe(true);

      const folders = getMigrationFolders();
      expect(folders).toHaveLength(3);

      firstMigration = folders[0];
      secondMigration = folders[1];
      thirdMigration = folders[2];
    });

    it("should squash all three migrations into one", () => {
      const result = runSquash(firstMigration, thirdMigration);
      expect(result.success).toBe(true);
      expect(result.output).toContain("3");

      const folders = getMigrationFolders();
      expect(folders).toHaveLength(1);
      expect(folders[0]).toBe(firstMigration);
    });

    it("squashed migration should apply and create full schema with posts", async () => {
      const migrateResult = runMigrate();
      expect(migrateResult.success).toBe(true);

      // Verify tables
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

      // Verify users columns
      const usersColumns = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        ORDER BY ordinal_position;
      `);
      const userColNames = usersColumns.rows.map(
        (row: { column_name: string }) => row.column_name,
      );
      expect(userColNames).toContain("id");
      expect(userColNames).toContain("username");
      expect(userColNames).toContain("bio");
      expect(userColNames).toContain("age");

      // Verify posts columns
      const postsColumns = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'posts'
        ORDER BY ordinal_position;
      `);
      const postColNames = postsColumns.rows.map(
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
  });

  describe("squash partial range", () => {
    let firstMigration: string;
    let secondMigration: string;
    let thirdMigration: string;

    it("should generate three migrations", async () => {
      await resetState();

      const gen1 = runGenerate(1);
      expect(gen1.success).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const gen2 = runGenerate(2);
      expect(gen2.success).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const gen3 = runGenerate(3);
      expect(gen3.success).toBe(true);

      const folders = getMigrationFolders();
      expect(folders).toHaveLength(3);

      firstMigration = folders[0];
      secondMigration = folders[1];
      thirdMigration = folders[2];
    });

    it("should squash only the last two migrations", () => {
      const result = runSquash(secondMigration, thirdMigration);
      expect(result.success).toBe(true);
      expect(result.output).toContain("2");

      const folders = getMigrationFolders();
      expect(folders).toHaveLength(2);
      // First migration untouched, squashed uses second migration's timestamp
      expect(folders[0]).toBe(firstMigration);
      expect(folders[1]).toBe(secondMigration);
    });

    it("squashed migrations should apply correctly in sequence", async () => {
      const migrateResult = runMigrate();
      expect(migrateResult.success).toBe(true);

      // Verify full schema is created
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

      // Verify users has all columns
      const columnsResult = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        ORDER BY ordinal_position;
      `);
      const columnNames = columnsResult.rows.map(
        (row: { column_name: string }) => row.column_name,
      );
      expect(columnNames).toContain("bio");
      expect(columnNames).toContain("age");
    });
  });

  describe("error cases", () => {
    let firstMigration: string;
    let secondMigration: string;
    let thirdMigration: string;

    it("should setup migrations for error tests", async () => {
      await resetState();

      const gen1 = runGenerate(1);
      expect(gen1.success).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const gen2 = runGenerate(2);
      expect(gen2.success).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const gen3 = runGenerate(3);
      expect(gen3.success).toBe(true);

      const folders = getMigrationFolders();
      expect(folders).toHaveLength(3);

      firstMigration = folders[0];
      secondMigration = folders[1];
      thirdMigration = folders[2];
    });

    it("should fail when start migration does not exist", () => {
      const result = runSquash("1999-01-01T00-00-00.000Z", secondMigration);
      expect(result.success).toBe(false);
      expect(result.output).toContain("not found");
    });

    it("should fail when end migration does not exist", () => {
      const result = runSquash(firstMigration, "2099-01-01T00-00-00.000Z");
      expect(result.success).toBe(false);
      expect(result.output).toContain("not found");
    });

    it("should fail when start comes after end", () => {
      const result = runSquash(thirdMigration, firstMigration);
      expect(result.success).toBe(false);
      expect(result.output).toContain("must come before");
    });

    it("should exit when only one migration in range", () => {
      const result = runSquash(firstMigration, firstMigration);
      // exits with 0 but prints a message about nothing to squash
      expect(result.output).toContain("Nothing to squash");
    });
  });

  describe("squash with custom statements", () => {
    let firstMigration: string;
    let secondMigration: string;

    it("should setup migrations with a custom statement", async () => {
      await resetState();

      const gen1 = runGenerate(1);
      expect(gen1.success).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const gen2 = runGenerate(2);
      expect(gen2.success).toBe(true);

      const folders = getMigrationFolders();
      expect(folders).toHaveLength(2);

      firstMigration = folders[0];
      secondMigration = folders[1];

      // Inject a custom statement into the second migration's up.ts
      const upPath = path.join(migrationsDir, secondMigration, "up.ts");
      const originalContent = fs.readFileSync(upPath, "utf8");
      // Append a ddl.custom() call to the statements array
      const withCustom = originalContent.replace(
        /];(\s*)$/,
        `  ddl.custom("SELECT 1;"),\n];$1`,
      );
      fs.writeFileSync(upPath, withCustom);
    });

    it("should fail squash when custom statements exist without --force", () => {
      const result = runSquash(firstMigration, secondMigration);
      expect(result.success).toBe(false);
      expect(result.output).toContain("Custom statements");
      expect(result.output).toContain("--force");
    });

    it("should squash with --force even with custom statements", () => {
      const result = runSquash(firstMigration, secondMigration, {
        force: true,
      });
      expect(result.success).toBe(true);

      const folders = getMigrationFolders();
      expect(folders).toHaveLength(1);
      expect(folders[0]).toBe(firstMigration);
    });

    it("force-squashed migration should apply correctly", async () => {
      const migrateResult = runMigrate();
      expect(migrateResult.success).toBe(true);

      // Verify schema is correct (combined v1 + v2 minus custom)
      const columnsResult = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'users'
        ORDER BY ordinal_position;
      `);
      const columnNames = columnsResult.rows.map(
        (row: { column_name: string }) => row.column_name,
      );
      expect(columnNames).toContain("id");
      expect(columnNames).toContain("username");
      expect(columnNames).toContain("bio");
      expect(columnNames).toContain("age");
    });
  });
});
