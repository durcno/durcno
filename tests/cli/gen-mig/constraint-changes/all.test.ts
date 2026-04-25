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

  it("[stage 1] should generate and apply initial migration with PK and unique constraints", async () => {
    const result = runGenerateAndMigrate(1);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(1);

    const uniqueConstraints = await getConstraints("constraint_test", "u");
    expect(
      uniqueConstraints["constraint_test_unique_email_name"],
    ).toBeDefined();
    expect(
      uniqueConstraints["constraint_test_unique_email_name"].columns,
    ).toEqual(["email", "name"]);

    const pkConstraints = await getConstraints("constraint_test", "p");
    expect(pkConstraints["constraint_test_pk"]).toBeDefined();
    expect(pkConstraints["constraint_test_pk"].columns).toEqual([
      "user_id",
      "group_id",
    ]);

    // Valid insert
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (1, 1, 'test@example.com', 'John', now());
    `);

    // Duplicate PK should fail
    await expect(
      client.query(`
        INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
        VALUES (1, 1, 'other@example.com', 'Jane', now());
      `),
    ).rejects.toThrow();

    // Duplicate (email, name) should fail
    await expect(
      client.query(`
        INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
        VALUES (2, 2, 'test@example.com', 'John', now());
      `),
    ).rejects.toThrow();

    // Same email, different name should succeed
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (2, 2, 'test@example.com', 'Jane', now());
    `);
  });

  it("[stage 2] should generate and apply migration adding unique name+createdAt constraint", async () => {
    const result = runGenerateAndMigrate(2);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(2);

    const uniqueConstraints = await getConstraints("constraint_test", "u");
    expect(
      uniqueConstraints["constraint_test_unique_name_created"],
    ).toBeDefined();
    expect(
      uniqueConstraints["constraint_test_unique_name_created"].columns,
    ).toEqual(["name", "created_at"]);

    // Duplicate (name, createdAt) should now fail
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (3, 3, 'a@example.com', 'UniqueName', '2025-01-01T00:00:00Z');
    `);
    await expect(
      client.query(`
        INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
        VALUES (4, 4, 'b@example.com', 'UniqueName', '2025-01-01T00:00:00Z');
      `),
    ).rejects.toThrow();
  });

  it("[stage 3] should generate and apply migration removing unique_email_name constraint", async () => {
    const result = runGenerateAndMigrate(3);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(3);

    const uniqueConstraints = await getConstraints("constraint_test", "u");
    expect(
      uniqueConstraints["constraint_test_unique_email_name"],
    ).toBeUndefined();
    expect(
      uniqueConstraints["constraint_test_unique_name_created"],
    ).toBeDefined();

    // Duplicate (email, name) should now be allowed
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (5, 5, 'dupe@example.com', 'DupeName', now());
    `);
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (6, 6, 'dupe@example.com', 'DupeName', now());
    `);
  });

  it("[stage 4] should generate and apply migration modifying PK to include email", async () => {
    const result = runGenerateAndMigrate(4);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(4);

    const pkConstraints = await getConstraints("constraint_test", "p");
    expect(pkConstraints["constraint_test_pk"]).toBeDefined();
    expect(pkConstraints["constraint_test_pk"].columns).toEqual([
      "user_id",
      "group_id",
      "email",
    ]);

    // Same userId+groupId but different email should now succeed
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (10, 10, 'a@example.com', 'Alpha', now());
    `);
    await client.query(`
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (10, 10, 'b@example.com', 'Beta', now());
    `);

    // Same userId+groupId+email should still fail
    await expect(
      client.query(`
        INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
        VALUES (10, 10, 'a@example.com', 'Other', now());
      `),
    ).rejects.toThrow();
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
      INSERT INTO constraint_test ("user_id", "group_id", email, name, "created_at")
      VALUES (99, 99, 'final@example.com', 'Final User', now());
    `);

    const queryResult = await client.query(
      `SELECT "user_id", "group_id", email, name FROM constraint_test WHERE email = $1`,
      ["final@example.com"],
    );
    expect(queryResult.rows.length).toBe(1);
    expect(queryResult.rows[0]["user_id"]).toBe(99);
    expect(queryResult.rows[0]["group_id"]).toBe(99);
    expect(queryResult.rows[0].name).toBe("Final User");
  });
});
