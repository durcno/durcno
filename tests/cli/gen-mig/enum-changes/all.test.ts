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

describe("durcno generate - enum changes", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  let containerInfo: TestContainerInfo;
  let client: pg.Client;

  async function cleanDatabase() {
    // Drop all objects to ensure a clean slate for each test
    await client.query(`
      DROP TABLE IF EXISTS public.users CASCADE;
      DROP TYPE IF EXISTS public.role CASCADE;
      DROP TABLE IF EXISTS durcno.migrations CASCADE;
      DROP SCHEMA IF EXISTS durcno CASCADE;
    `);
  }

  function runGenerate(scenario: string): { success: boolean; output: string } {
    const result = spawnSync("durcno", ["generate", "--config", configPath], {
      encoding: "utf8",
      cwd: process.cwd(),
      env: { ...process.env, ENUM_SCENARIO: scenario },
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
        DATABASE_PORT: String(containerInfo.port),
      },
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

  beforeAll(async () => {
    rmSync(migrationsDir);
    delete process.env.ENUM_SCENARIO;

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

  describe("appending enum values", () => {
    it("should generate and apply migration when appending value to end", async () => {
      await cleanDatabase();
      rmSync(migrationsDir);

      // Create initial migration
      const initialResult = runGenerate("initial");
      expect(initialResult.success).toBe(true);

      let folders = getMigrationFolders();
      expect(folders).toHaveLength(1);

      // Run initial migrate
      const migrateResult1 = runMigrate();
      expect(migrateResult1.success).toBe(true);

      // Wait to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create subsequent migration with appended value
      const appendResult = runGenerate("append");
      expect(appendResult.success).toBe(true);

      folders = getMigrationFolders();
      expect(folders).toHaveLength(2);

      // Run migrate
      const migrateResult2 = runMigrate();
      expect(migrateResult2.success).toBe(true);
    });

    it("should generate and apply migration when inserting value in middle", async () => {
      await cleanDatabase();
      rmSync(migrationsDir);

      // Create initial migration
      const initialResult = runGenerate("initial");
      expect(initialResult.success).toBe(true);

      // Run initial migrate
      const migrateResult1 = runMigrate();
      if (!migrateResult1.success) {
        console.error("Migration failed:", migrateResult1.output);
      }
      expect(migrateResult1.success).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create subsequent migration with value inserted in middle
      const insertResult = runGenerate("insert_middle");
      expect(insertResult.success).toBe(true);

      const folders = getMigrationFolders();
      expect(folders).toHaveLength(2);

      // Run migrate
      const migrateResult2 = runMigrate();
      expect(migrateResult2.success).toBe(true);
    });

    it("should generate and apply migration when inserting value at start", async () => {
      await cleanDatabase();
      rmSync(migrationsDir);

      // Create initial migration
      const initialResult = runGenerate("initial");
      expect(initialResult.success).toBe(true);

      // Run initial migrate
      const migrateResult1 = runMigrate();
      expect(migrateResult1.success).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create subsequent migration with value inserted at start
      const insertResult = runGenerate("insert_start");
      expect(insertResult.success).toBe(true);

      const folders = getMigrationFolders();
      expect(folders).toHaveLength(2);

      // Run migrate
      const migrateResult2 = runMigrate();
      expect(migrateResult2.success).toBe(true);
    });
  });

  describe("failing on invalid enum changes", () => {
    it("should fail when enum values are removed", async () => {
      await cleanDatabase();
      rmSync(migrationsDir);

      // Create initial migration
      const initialResult = runGenerate("initial");
      expect(initialResult.success).toBe(true);

      // Run initial migrate
      const migrateResult = runMigrate();
      expect(migrateResult.success).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Try to create subsequent migration with removed value - should fail
      const removeResult = runGenerate("remove");
      expect(removeResult.success).toBe(false);
      expect(removeResult.output).toContain("removed values");
      expect(removeResult.output).toContain("user");

      // Should not create a new migration folder
      const folders = getMigrationFolders();
      expect(folders).toHaveLength(1);
    });

    it("should fail when enum values are reordered", async () => {
      await cleanDatabase();
      rmSync(migrationsDir);

      // Create initial migration
      const initialResult = runGenerate("initial");
      expect(initialResult.success).toBe(true);

      // Run initial migrate
      const migrateResult = runMigrate();
      expect(migrateResult.success).toBe(true);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Try to create subsequent migration with reordered values - should fail
      const reorderResult = runGenerate("reorder");
      expect(reorderResult.success).toBe(false);
      expect(reorderResult.output).toContain("reordered values");

      // Should not create a new migration folder
      const folders = getMigrationFolders();
      expect(folders).toHaveLength(1);
    });
  });
});
