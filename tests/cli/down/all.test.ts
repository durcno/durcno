import { execSync } from "node:child_process";
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

describe("durcno down command", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  let containerInfo: TestContainerInfo;
  let pgContainer: Docker.Container;
  let client: pg.Client;
  let connectionString: string;
  let databasePort: string;
  let databaseName: string;

  // Store migration folder names for rollback tests
  let firstMigrationName: string;
  let secondMigrationName: string;

  beforeAll(async () => {
    // Clean up test migrations directory before tests
    if (fs.existsSync(migrationsDir)) {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }

    // Create Docker database using shared utility
    if (process.env.PG_CONNECTION_STRING) {
      connectionString = process.env.PG_CONNECTION_STRING;
    } else {
      containerInfo = await startPostgresContainer({
        image: "postgres:14-alpine",
        containerNamePrefix: "durcno-down-tests",
      });
      pgContainer = containerInfo.container;
      connectionString = containerInfo.connectionString;
    }

    const url = new URL(connectionString);
    databasePort = url.port;
    databaseName = containerInfo?.dbName ?? url.pathname.slice(1);

    // Connect to the database
    client = new pg.Client(connectionString);
    await client.connect();

    // Generate first migration (Users table only)
    execSync(`durcno generate --config ${configPath}`, {
      stdio: ["ignore", "ignore", "pipe"],
      cwd: __dirname,
      env: {
        ...process.env,
        MIGRATION_VERSION: "1",
        DATABASE_PORT: databasePort,
        DB_NAME: databaseName,
      },
    });

    // Get first migration folder name
    let folders = fs
      .readdirSync(migrationsDir)
      .filter((f) => MIGRATION_NAME_REGEX.test(f))
      .sort();
    firstMigrationName = folders[0];

    // Wait to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Generate second migration (add Posts table and columns to Users)
    execSync(`durcno generate --config ${configPath}`, {
      stdio: ["ignore", "ignore", "pipe"],
      cwd: __dirname,
      env: {
        ...process.env,
        MIGRATION_VERSION: "2",
        DATABASE_PORT: databasePort,
        DB_NAME: databaseName,
      },
    });

    // Get second migration folder name
    folders = fs
      .readdirSync(migrationsDir)
      .filter((f) => MIGRATION_NAME_REGEX.test(f))
      .sort();
    secondMigrationName = folders[1];

    // Apply all migrations
    execSync(`durcno migrate --config ${configPath}`, {
      stdio: ["ignore", "ignore", "pipe"],
      cwd: __dirname,
      env: {
        ...process.env,
        DATABASE_PORT: databasePort,
        DB_NAME: databaseName,
      },
    });
  }, 120000);

  afterAll(async () => {
    // Clean up migrations directory
    if (fs.existsSync(migrationsDir)) {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }

    await client?.end().catch(console.error);
    if (pgContainer) await stopPostgresContainer(pgContainer);
  });

  it("should have both migrations applied before rollback", async () => {
    // Verify Posts table exists (from second migration)
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

    // Verify migrations table has both migrations
    const migrationsResult = await client.query(`
      SELECT name FROM durcno.migrations ORDER BY name;
    `);
    expect(migrationsResult.rows).toHaveLength(2);
    expect(migrationsResult.rows[0].name).toBe(firstMigrationName);
    expect(migrationsResult.rows[1].name).toBe(secondMigrationName);

    // Verify new columns exist on users table
    const columnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      ORDER BY column_name;
    `);
    const columnNames = columnsResult.rows.map((row) => row.column_name);
    expect(columnNames).toContain("bio");
    expect(columnNames).toContain("age");
  });

  it("should rollback second migration and remove Posts table", async () => {
    // Run down command to rollback to second migration (inclusive)
    execSync(`durcno down ${secondMigrationName} --config ${configPath}`, {
      stdio: ["ignore", "ignore", "pipe"],
      cwd: __dirname,
      env: {
        ...process.env,
        DATABASE_PORT: databasePort,
        DB_NAME: databaseName,
      },
    });

    // Verify Posts table is dropped
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

    // Verify new columns are removed from users table
    const columnsResult = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'users'
      ORDER BY column_name;
    `);
    const columnNames = columnsResult.rows.map((row) => row.column_name);
    expect(columnNames).not.toContain("bio");
    expect(columnNames).not.toContain("age");
  });

  it("should remove migration record from migrations table after rollback", async () => {
    // Verify migrations table only has first migration
    const migrationsResult = await client.query(`
      SELECT name FROM durcno.migrations ORDER BY name;
    `);
    expect(migrationsResult.rows).toHaveLength(1);
    expect(migrationsResult.rows[0].name).toBe(firstMigrationName);
  });

  it("should rollback first migration and drop entire schema", async () => {
    // Run down command to rollback first migration (drops everything)
    execSync(`durcno down ${firstMigrationName} --config ${configPath}`, {
      stdio: ["ignore", "ignore", "pipe"],
      cwd: __dirname,
      env: {
        ...process.env,
        DATABASE_PORT: databasePort,
        DB_NAME: databaseName,
      },
    });

    // Verify all tables are dropped (including users)
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tableNames = tablesResult.rows.map((row) => row.table_name);
    expect(tableNames).not.toContain("users");
    expect(tableNames).not.toContain("posts");

    // Verify durcno schema is dropped (migrations table no longer exists)
    const schemaResult = await client.query(`
      SELECT schema_name
      FROM information_schema.schemata
      WHERE schema_name = 'durcno';
    `);
    expect(schemaResult.rows).toHaveLength(0);
  });
});
