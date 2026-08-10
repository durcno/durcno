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

describe("durcno generate - enum changes", () => {
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

  it("[stage 1] should generate and apply initial migration creating role enum", async () => {
    const result = runGenerateAndMigrate(1);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(1);

    const enumResult = await client.query(`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'role'
      ORDER BY enumsortorder;
    `);
    const values = enumResult.rows.map((row) => row.enumlabel);
    expect(values).toEqual(["admin", "user"]);
  });

  it("[stage 2] should generate and apply migration appending value to role enum", async () => {
    const result = runGenerateAndMigrate(2);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(2);

    const enumResult = await client.query(`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'role'
      ORDER BY enumsortorder;
    `);
    const values = enumResult.rows.map((row) => row.enumlabel);
    expect(values).toEqual(["admin", "user", "moderator"]);
  });

  it("[stage 3] should generate and apply migration inserting value in middle of role enum", async () => {
    const result = runGenerateAndMigrate(3);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(3);

    const enumResult = await client.query(`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'role'
      ORDER BY enumsortorder;
    `);
    const values = enumResult.rows.map((row) => row.enumlabel);
    expect(values).toEqual(["admin", "editor", "user", "moderator"]);
  });

  it("[stage 4] should generate and apply migration inserting value at start of role enum", async () => {
    const result = runGenerateAndMigrate(4);
    expect(result.success).toBe(true);

    expect(getMigrationFolders()).toHaveLength(4);

    const enumResult = await client.query(`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'role'
      ORDER BY enumsortorder;
    `);
    const values = enumResult.rows.map((row) => row.enumlabel);
    expect(values).toEqual([
      "superadmin",
      "admin",
      "editor",
      "user",
      "moderator",
    ]);
  });

  it("[stage 4] should detect no changes when schema is unchanged", () => {
    const output = runDurcno(
      ["generate", "--config", configPath],
      {
        ...process.env,
        STAGE: "4",
        DATABASE_PORT: String(containerInfo.port),
      },
      process.cwd(),
    );
    expect(output).toContain("No changes detected");

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(4);
  });

  it("should fail when enum values are removed", () => {
    let output = "";
    try {
      output = runDurcno(
        ["generate", "--config", configPath],
        {
          ...process.env,
          STAGE: "5",
          DATABASE_PORT: String(containerInfo.port),
        },
        process.cwd(),
      );
    } catch (e: unknown) {
      output = e instanceof Error ? e.message : String(e);
    }
    expect(output).toContain("removed values");
    expect(output).toContain("user");

    expect(getMigrationFolders()).toHaveLength(4);
  });

  it("should fail when enum values are reordered", () => {
    let output = "";
    try {
      output = runDurcno(
        ["generate", "--config", configPath],
        {
          ...process.env,
          STAGE: "6",
          DATABASE_PORT: String(containerInfo.port),
        },
        process.cwd(),
      );
    } catch (e: unknown) {
      output = e instanceof Error ? e.message : String(e);
    }
    expect(output).toContain("reordered values");

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
      INSERT INTO users (username, role, "created_at")
      VALUES ('testuser', 'admin', now());
    `);

    const userResult = await client.query(
      "SELECT username, role FROM users WHERE username = $1",
      ["testuser"],
    );
    expect(userResult.rows.length).toBe(1);
    expect(userResult.rows[0].username).toBe("testuser");
    expect(userResult.rows[0].role).toBe("admin");
  });
});
