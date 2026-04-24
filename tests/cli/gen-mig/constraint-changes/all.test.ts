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

describe("durcno generate - unique/primary key constraint changes", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  let containerInfo: TestContainerInfo;
  let client: pg.Client;

  async function cleanDatabase() {
    await client.query(`
      DROP TABLE IF EXISTS public.constraint_test CASCADE;
      DROP TABLE IF EXISTS durcno.migrations CASCADE;
      DROP SCHEMA IF EXISTS durcno CASCADE;
    `);
  }

  function runGenerate(scenario: string): { success: boolean; output: string } {
    const result = spawnSync("durcno", ["generate", "--config", configPath], {
      encoding: "utf8",
      cwd: process.cwd(),
      env: { ...process.env, CONSTRAINT_SCENARIO: scenario },
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
      env: { ...process.env, DATABASE_PORT: String(containerInfo.port) },
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

  async function getConstraints(
    tableName: string,
    contype: "u" | "p",
  ): Promise<Record<string, { columns: string[] }>> {
    const result = await client.query(
      `
      SELECT
        con.conname as constraint_name,
        array_agg(att.attname::text ORDER BY unnest_pos) as columns
      FROM pg_catalog.pg_constraint con
      JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      JOIN pg_catalog.pg_namespace nsp ON nsp.oid = rel.relnamespace
      JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS u(attnum, unnest_pos) ON true
      JOIN pg_catalog.pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = u.attnum
      WHERE con.contype = $1
        AND nsp.nspname = 'public'
        AND rel.relname = $2
      GROUP BY con.conname
      ORDER BY con.conname;
    `,
      [contype, tableName],
    );
    return result.rows.reduce(
      (
        acc: Record<string, { columns: string[] }>,
        row: { constraint_name: string; columns: string[] },
      ) => {
        acc[row.constraint_name] = { columns: row.columns };
        return acc;
      },
      {} as Record<string, { columns: string[] }>,
    );
  }

  beforeAll(async () => {
    rmSync(migrationsDir);
    delete process.env.CONSTRAINT_SCENARIO;

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

  it("should include unique and PK constraints in initial migration and apply them", async () => {
    await cleanDatabase();
    rmSync(migrationsDir);

    const initial = runGenerate("initial");
    expect(initial.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(1);

    const migrateResult = runMigrate();
    expect(migrateResult.success).toBe(true);

    // Verify unique constraints exist in database
    const uniqueConstraints = await getConstraints("constraint_test", "u");
    expect(
      uniqueConstraints["constraint_test_unique_email_name"],
    ).toBeDefined();
    expect(
      uniqueConstraints["constraint_test_unique_email_name"].columns,
    ).toEqual(["email", "name"]);

    // Verify primary key constraint exists in database
    const pkConstraints = await getConstraints("constraint_test", "p");
    expect(pkConstraints["constraint_test_pk"]).toBeDefined();
    expect(pkConstraints["constraint_test_pk"].columns).toEqual([
      "user_id",
      "group_id",
    ]);

    // Verify PK works - insert valid data
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (1, 1, 'test@example.com', 'John', now());
    `);

    // Verify PK works - duplicate PK should fail
    await expect(
      client.query(`
        INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
        VALUES (1, 1, 'other@example.com', 'Jane', now());
      `),
    ).rejects.toThrow();

    // Verify unique constraint works - duplicate email+name should fail
    await expect(
      client.query(`
        INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
        VALUES (2, 2, 'test@example.com', 'John', now());
      `),
    ).rejects.toThrow();

    // Same email, different name - should succeed
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (2, 2, 'test@example.com', 'Jane', now());
    `);
  });

  it("should generate and apply ADD CONSTRAINT when a unique constraint is added", async () => {
    await cleanDatabase();
    rmSync(migrationsDir);

    // Initial
    const initial = runGenerate("initial");
    expect(initial.success).toBe(true);

    const migrateResult1 = runMigrate();
    expect(migrateResult1.success).toBe(true);

    await new Promise((r) => setTimeout(r, 100));

    // Add unique constraint
    const add = runGenerate("add_unique");
    expect(add.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);

    const migrateResult2 = runMigrate();
    expect(migrateResult2.success).toBe(true);

    // Verify new unique constraint exists
    const uniqueConstraints = await getConstraints("constraint_test", "u");
    expect(
      uniqueConstraints["constraint_test_unique_name_created"],
    ).toBeDefined();
    expect(
      uniqueConstraints["constraint_test_unique_name_created"].columns,
    ).toEqual(["name", "created_at"]);

    // Verify the new constraint works - duplicate (name, createdAt) should fail
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (1, 1, 'a@example.com', 'UniqueName', '2025-01-01T00:00:00Z');
    `);

    await expect(
      client.query(`
        INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
        VALUES (2, 2, 'b@example.com', 'UniqueName', '2025-01-01T00:00:00Z');
      `),
    ).rejects.toThrow();
  });

  it("should generate and apply DROP CONSTRAINT when a unique constraint is removed", async () => {
    await cleanDatabase();
    rmSync(migrationsDir);

    // Initial
    const initial = runGenerate("initial");
    expect(initial.success).toBe(true);

    const migrateResult1 = runMigrate();
    expect(migrateResult1.success).toBe(true);

    // Verify unique constraint exists
    let uniqueConstraints = await getConstraints("constraint_test", "u");
    expect(
      uniqueConstraints["constraint_test_unique_email_name"],
    ).toBeDefined();

    await new Promise((r) => setTimeout(r, 100));

    const remove = runGenerate("remove_unique");
    expect(remove.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);

    const migrateResult2 = runMigrate();
    expect(migrateResult2.success).toBe(true);

    // Verify unique constraint is removed
    uniqueConstraints = await getConstraints("constraint_test", "u");
    expect(
      uniqueConstraints["constraint_test_unique_email_name"],
    ).toBeUndefined();

    // Duplicate email+name should now be allowed
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (1, 1, 'test@example.com', 'John', now());
    `);
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (2, 2, 'test@example.com', 'John', now());
    `);
  });

  it("should recreate unique constraint when columns are modified", async () => {
    await cleanDatabase();
    rmSync(migrationsDir);

    // Initial
    const initial = runGenerate("initial");
    expect(initial.success).toBe(true);

    const migrateResult1 = runMigrate();
    expect(migrateResult1.success).toBe(true);

    await new Promise((r) => setTimeout(r, 100));

    // Modify unique constraint columns (email, name) -> (email)
    const modified = runGenerate("modify_unique");
    expect(modified.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);

    const migrateResult2 = runMigrate();
    expect(migrateResult2.success).toBe(true);

    // Verify constraint now only covers email
    const uniqueConstraints = await getConstraints("constraint_test", "u");
    expect(
      uniqueConstraints["constraint_test_unique_email_name"],
    ).toBeDefined();
    expect(
      uniqueConstraints["constraint_test_unique_email_name"].columns,
    ).toEqual(["email", "created_at"]);

    // Duplicate (email, createdAt) should now fail
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (1, 1, 'test@example.com', 'John', '2025-01-01T00:00:00Z');
    `);
    await expect(
      client.query(`
        INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
        VALUES (2, 2, 'test@example.com', 'DifferentName', '2025-01-01T00:00:00Z');
      `),
    ).rejects.toThrow();
  });

  it("should recreate PK constraint when columns are modified", async () => {
    await cleanDatabase();
    rmSync(migrationsDir);

    // Initial
    const initial = runGenerate("initial");
    expect(initial.success).toBe(true);

    const migrateResult1 = runMigrate();
    expect(migrateResult1.success).toBe(true);

    // Verify initial PK covers (userId, groupId)
    let pkConstraints = await getConstraints("constraint_test", "p");
    expect(pkConstraints["constraint_test_pk"]).toBeDefined();
    expect(pkConstraints["constraint_test_pk"].columns).toEqual([
      "user_id",
      "group_id",
    ]);

    await new Promise((r) => setTimeout(r, 100));

    // Modify PK (userId, groupId) -> (userId, groupId, email)
    const modified = runGenerate("modify_pk");
    expect(modified.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);

    const migrateResult2 = runMigrate();
    expect(migrateResult2.success).toBe(true);

    // Verify PK now covers (userId, groupId, email)
    pkConstraints = await getConstraints("constraint_test", "p");
    expect(pkConstraints["constraint_test_pk"]).toBeDefined();
    expect(pkConstraints["constraint_test_pk"].columns).toEqual([
      "user_id",
      "group_id",
      "email",
    ]);

    // Same userId+groupId but different email should now succeed
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (1, 1, 'a@example.com', 'John', now());
    `);
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (1, 1, 'b@example.com', 'Jane', now());
    `);

    // Same userId+groupId+email should fail
    await expect(
      client.query(`
        INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
        VALUES (1, 1, 'a@example.com', 'Other', now());
      `),
    ).rejects.toThrow();
  });
});
