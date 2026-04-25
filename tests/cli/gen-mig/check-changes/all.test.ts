/** biome-ignore-all lint/complexity/useLiteralKeys: <> */
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

describe("durcno generate - check constraint changes", () => {
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

  it("[stage 1] should generate and apply initial migration with check constraints", async () => {
    const result = runGenerateAndMigrate(1);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(1);

    const checks = await getCheckConstraints("check_test");
    expect(checks["positive_price_check"]).toBeDefined();
    expect(checks["valid_quantity_check"]).toBeDefined();
    expect(checks["valid_email_check"]).toBeDefined();
    expect(checks["name_length_check"]).toBeDefined();
    expect(checks["max_price_check"]).toBeUndefined();

    // Valid data should insert
    await client.query(`
      INSERT INTO check_test (price, quantity, email, name, "created_at")
      VALUES (100, 50, 'test@example.com', 'Valid Name', now());
    `);
    const rows = await client.query("SELECT * FROM check_test");
    expect(rows.rows.length).toBe(1);

    // Invalid price should fail
    await expect(
      client.query(`
        INSERT INTO check_test (price, quantity, email, name, "created_at")
        VALUES (-10, 50, 'test@example.com', 'Valid Name', now());
      `),
    ).rejects.toThrow();

    // Invalid quantity should fail
    await expect(
      client.query(`
        INSERT INTO check_test (price, quantity, email, name, "created_at")
        VALUES (100, -5, 'test@example.com', 'Valid Name', now());
      `),
    ).rejects.toThrow();
  });

  it("[stage 2] should generate and apply migration adding max_price check", async () => {
    const result = runGenerateAndMigrate(2);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(2);

    const checks = await getCheckConstraints("check_test");
    expect(checks["max_price_check"]).toBeDefined();
    expect(checks["max_price_check"]).toContain("1000000");

    // Price >= 1000000 should now fail
    await expect(
      client.query(`
        INSERT INTO check_test (price, quantity, email, name, "created_at")
        VALUES (1000001, 50, 'test@example.com', 'Valid Name', now());
      `),
    ).rejects.toThrow();

    // Price within range should succeed
    await client.query(`
      INSERT INTO check_test (price, quantity, email, name, "created_at")
      VALUES (999999, 50, 'test@example.com', 'Valid Name', now());
    `);
  });

  it("[stage 3] should generate and apply migration removing valid_email check", async () => {
    const result = runGenerateAndMigrate(3);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(3);

    const checks = await getCheckConstraints("check_test");
    expect(checks["valid_email_check"]).toBeUndefined();
    expect(checks["positive_price_check"]).toBeDefined();
    expect(checks["valid_quantity_check"]).toBeDefined();
    expect(checks["name_length_check"]).toBeDefined();
    expect(checks["max_price_check"]).toBeDefined();

    // Invalid email format should now be allowed
    await client.query(`
      INSERT INTO check_test (price, quantity, email, name, "created_at")
      VALUES (100, 50, 'invalid-email', 'Valid Name', now());
    `);
  });

  it("[stage 4] should generate and apply migration modifying valid_quantity upper bound", async () => {
    const result = runGenerateAndMigrate(4);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(4);

    const checks = await getCheckConstraints("check_test");
    expect(checks["valid_quantity_check"]).toBeDefined();
    expect(checks["valid_quantity_check"]).toContain("1000");
    expect(checks["valid_quantity_check"]).not.toContain("10000");

    // Quantity > 1000 should now fail
    await expect(
      client.query(`
        INSERT INTO check_test (price, quantity, email, name, "created_at")
        VALUES (100, 5000, 'test@example.com', 'Valid Name', now());
      `),
    ).rejects.toThrow();

    // Quantity <= 1000 should succeed
    await client.query(`
      INSERT INTO check_test (price, quantity, email, name, "created_at")
      VALUES (100, 1000, 'test@example.com', 'Valid Name', now());
    `);
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

    expect(getMigrationFolders()).toHaveLength(4);
  });

  it("should verify migration folders follow ISO timestamp naming", () => {
    const folders = getMigrationFolders();
    expect(folders.length).toBeGreaterThanOrEqual(4);

    for (const folder of folders) {
      expect(MIGRATION_NAME_REGEX.test(folder)).toBe(true);
    }

    for (let i = 1; i < folders.length; i++) {
      const toISOString = (d: string) =>
        `${d.split("T")[0]}T${d.split("T")[1].replace(/-/g, ":")}`;
      const prevTime = new Date(toISOString(folders[i - 1])).getTime();
      const currTime = new Date(toISOString(folders[i])).getTime();
      expect(currTime).toBeGreaterThan(prevTime);
    }
  });

  it("should be able to insert and query data after migrations", async () => {
    await client.query(`
      INSERT INTO check_test (price, quantity, email, name, "created_at")
      VALUES (500, 100, 'final@example.com', 'Final User', now());
    `);

    const queryResult = await client.query(
      "SELECT price, quantity, email, name FROM check_test WHERE email = $1",
      ["final@example.com"],
    );
    expect(queryResult.rows.length).toBe(1);
    expect(queryResult.rows[0].price).toBe("500");
    expect(queryResult.rows[0].quantity).toBe(100);
    expect(queryResult.rows[0].name).toBe("Final User");
  });
});
