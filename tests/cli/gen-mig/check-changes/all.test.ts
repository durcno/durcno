/** biome-ignore-all lint/complexity/useLiteralKeys: <> */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import Docker from "dockerode";
import { MIGRATION_NAME_REGEX } from "durcno/migration";
import getPort from "get-port";
import pg from "pg";
import { v4 as uuid } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rmSync } from "../../../helpers";

describe("durcno generate - check constraint changes", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  let pgContainer: Docker.Container;
  let docker: Docker;
  let client: pg.Client;
  let connectionString: string;
  let port: number;

  async function createDockerDB(): Promise<string> {
    docker = new Docker();
    port = await getPort({ port: 5432 });
    const image = "postgis/postgis:16-3.4";

    const pullStream = await docker.pull(image);
    await new Promise((resolve, reject) =>
      docker.modem.followProgress(pullStream, (err: Error | null) =>
        err ? reject(err) : resolve(err),
      ),
    );

    pgContainer = await docker.createContainer({
      Image: image,
      Env: [
        "POSTGRES_PASSWORD=testpass",
        "POSTGRES_USER=testuser",
        "POSTGRES_DB=testdb",
      ],
      name: `durcno-check-changes-test-${uuid()}`,
      HostConfig: {
        AutoRemove: true,
        PortBindings: {
          "5432/tcp": [{ HostPort: `${port}` }],
        },
      },
    });

    await pgContainer.start();

    return `postgres://testuser:testpass@localhost:${port}/testdb`;
  }

  async function cleanDatabase() {
    // Drop all objects to ensure a clean slate for each test
    await client.query(`
      DROP TABLE IF EXISTS public.check_test CASCADE;
      DROP TABLE IF EXISTS durcno.migrations CASCADE;
      DROP SCHEMA IF EXISTS durcno CASCADE;
    `);
  }

  function runGenerate(scenario: string): { success: boolean; output: string } {
    const result = spawnSync("durcno", ["generate", "--config", configPath], {
      encoding: "utf8",
      cwd: process.cwd(),
      env: { ...process.env, CHECK_SCENARIO: scenario },
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
      env: { ...process.env, DATABASE_PORT: String(port) },
    });
    return {
      success: result.status === 0,
      output: result.stdout + result.stderr,
    };
  }

  function getMigrationFolders(): string[] {
    if (!fs.existsSync(migrationsDir)) return [];
    return fs
      .readdirSync(migrationsDir)
      .filter((f) => MIGRATION_NAME_REGEX.test(f))
      .sort();
  }

  async function getCheckConstraints(
    tableName: string,
  ): Promise<Record<string, string>> {
    const result = await client.query(
      `
      SELECT con.conname as constraint_name, pg_get_constraintdef(con.oid) as constraint_def
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE con.contype = 'c'
        AND nsp.nspname = 'public'
        AND rel.relname = $1
      ORDER BY con.conname;
    `,
      [tableName],
    );
    return result.rows.reduce(
      (acc, row) => {
        acc[row.constraint_name] = row.constraint_def;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  beforeAll(async () => {
    rmSync(migrationsDir);
    delete process.env.CHECK_SCENARIO;

    connectionString =
      process.env.PG_CONNECTION_STRING ?? (await createDockerDB());

    const sleep = 1000;
    let timeLeft = 20000;
    let connected = false;
    let lastError: unknown | undefined;

    do {
      try {
        client = new pg.Client(connectionString);
        await client.connect();
        connected = true;
        break;
      } catch (e) {
        lastError = e;
        await new Promise((resolve) => setTimeout(resolve, sleep));
        timeLeft -= sleep;
      }
    } while (timeLeft > 0);

    if (!connected) {
      console.error("Cannot connect to Postgres");
      await client?.end().catch(console.error);
      await pgContainer?.stop().catch(console.error);
      throw lastError;
    }
  }, 120000);

  afterAll(async () => {
    await client?.end().catch(console.error);
    await pgContainer?.stop().catch(console.error);
  });

  it("should include checks in initial migration and apply them", async () => {
    await cleanDatabase();
    rmSync(migrationsDir);

    const initial = runGenerate("initial");
    expect(initial.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(1);

    // Run migrate
    const migrateResult = runMigrate();
    expect(migrateResult.success).toBe(true);

    // Verify check constraints exist in database
    const checks = await getCheckConstraints("check_test");

    expect(checks["positive_price_check"]).toBeDefined();
    expect(checks["valid_quantity_check"]).toBeDefined();
    expect(checks["valid_email_check"]).toBeDefined();
    expect(checks["name_length_check"]).toBeDefined();

    // Verify constraints work - valid data should insert
    await client.query(`
      INSERT INTO check_test (price, quantity, email, name, "created_at")
      VALUES (100, 50, 'test@example.com', 'Valid Name', now());
    `);

    const result = await client.query("SELECT * FROM check_test");
    expect(result.rows.length).toBe(1);

    // Verify constraint - invalid price should fail
    await expect(
      client.query(`
        INSERT INTO check_test (price, quantity, email, name, "created_at")
        VALUES (-10, 50, 'test@example.com', 'Valid Name', now());
      `),
    ).rejects.toThrow();

    // Verify constraint - invalid quantity should fail
    await expect(
      client.query(`
        INSERT INTO check_test (price, quantity, email, name, "created_at")
        VALUES (100, -5, 'test@example.com', 'Valid Name', now());
      `),
    ).rejects.toThrow();
  });

  it("should generate and apply ADD CONSTRAINT when a check is added", async () => {
    await cleanDatabase();
    rmSync(migrationsDir);

    // Initial
    const initial = runGenerate("initial");
    expect(initial.success).toBe(true);

    const migrateResult1 = runMigrate();
    expect(migrateResult1.success).toBe(true);

    // Wait for different timestamp
    await new Promise((r) => setTimeout(r, 100));

    // Add a check
    const add = runGenerate("add");
    expect(add.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);

    const migrateResult2 = runMigrate();
    expect(migrateResult2.success).toBe(true);

    // Verify new check constraint exists in database
    const checks = await getCheckConstraints("check_test");
    expect(checks["max_price_check"]).toBeDefined();
    expect(checks["max_price_check"]).toContain("1000000");

    // Verify the new constraint works - price >= 1000000 should fail
    await expect(
      client.query(`
        INSERT INTO check_test (price, quantity, email, name, "created_at")
        VALUES (1000001, 50, 'test@example.com', 'Valid Name', now());
      `),
    ).rejects.toThrow();

    // Valid price should work
    await client.query(`
      INSERT INTO check_test (price, quantity, email, name, "created_at")
      VALUES (999999, 50, 'test@example.com', 'Valid Name', now());
    `);

    const result = await client.query("SELECT price FROM check_test");
    expect(result.rows[0].price).toBe("999999");
  });

  it("should generate and apply DROP CONSTRAINT when a check is removed", async () => {
    await cleanDatabase();
    rmSync(migrationsDir);

    // Initial
    const initial = runGenerate("initial");
    expect(initial.success).toBe(true);

    const migrateResult1 = runMigrate();
    expect(migrateResult1.success).toBe(true);

    // Verify email check exists
    let checks = await getCheckConstraints("check_test");
    expect(checks["valid_email_check"]).toBeDefined();

    await new Promise((r) => setTimeout(r, 100));

    const remove = runGenerate("remove");
    expect(remove.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);

    const migrateResult2 = runMigrate();
    expect(migrateResult2.success).toBe(true);

    // Verify check constraint is removed from database
    checks = await getCheckConstraints("check_test");
    expect(checks["valid_email_check"]).toBeUndefined();

    // Email without @ should now be allowed
    await client.query(`
      INSERT INTO check_test (price, quantity, email, name, "created_at")
      VALUES (100, 50, 'invalid-email', 'Valid Name', now());
    `);

    const result = await client.query("SELECT email FROM check_test");
    expect(result.rows[0].email).toBe("invalid-email");
  });

  it("should recreate constraint when expression is modified", async () => {
    await cleanDatabase();
    rmSync(migrationsDir);

    // Initial
    const initial = runGenerate("initial");
    expect(initial.success).toBe(true);

    const migrateResult1 = runMigrate();
    expect(migrateResult1.success).toBe(true);

    // Verify original constraint - quantity up to 10000 should work
    await client.query(`
      INSERT INTO check_test (price, quantity, email, name, "created_at")
      VALUES (100, 5000, 'test@example.com', 'Valid Name', now());
    `);

    let result = await client.query("SELECT quantity FROM check_test");
    expect(result.rows[0].quantity).toBe(5000);

    // Clean up for next test
    await client.query("DELETE FROM check_test");

    await new Promise((r) => setTimeout(r, 100));

    const modified = runGenerate("modify");
    expect(modified.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);

    const migrateResult2 = runMigrate();
    expect(migrateResult2.success).toBe(true);

    // Verify modified constraint - quantity > 1000 should now fail
    await expect(
      client.query(`
        INSERT INTO check_test (price, quantity, email, name, "created_at")
        VALUES (100, 5000, 'test@example.com', 'Valid Name', now());
      `),
    ).rejects.toThrow();

    // Quantity <= 1000 should work
    await client.query(`
      INSERT INTO check_test (price, quantity, email, name, "created_at")
      VALUES (100, 1000, 'test@example.com', 'Valid Name', now());
    `);

    result = await client.query("SELECT quantity FROM check_test");
    expect(result.rows[0].quantity).toBe(1000);

    // Verify the constraint definition changed
    const checks = await getCheckConstraints("check_test");
    expect(checks["valid_quantity_check"]).toContain("1000");
    expect(checks["valid_quantity_check"]).not.toContain("10000");
  });
});
