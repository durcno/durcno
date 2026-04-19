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

describe("durcno generate - enum changes", () => {
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
      name: `durcno-enum-changes-test-${uuid()}`,
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
        DATABASE_PORT: String(port),
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
