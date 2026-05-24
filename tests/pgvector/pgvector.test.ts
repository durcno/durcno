import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  type $Client,
  asc,
  database,
  defineConfig,
  eq,
  hammingDistance,
  l2Distance,
  lt,
} from "durcno";
import { pg as pgConnector } from "durcno/connectors/pg";
import pg from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
  truncateTables,
} from "../docker-utils";
import * as schema from "./schema";

describe("pgvector", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  let containerInfo: TestContainerInfo;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;

  beforeAll(async () => {
    if (fs.existsSync(migrationsDir)) {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }

    execSync(`durcno generate --config ${configPath}`, {
      stdio: ["ignore", "ignore", "pipe"],
    });

    containerInfo = await startPostgresContainer({
      image: "pgvector/pgvector:pg16",
      user: "testuser",
      password: "testpass",
      dbName: "testdb",
    });

    // Install the vector extension before migrations run
    const pgClient = new pg.Client(containerInfo.connectionString);
    await pgClient.connect();
    await pgClient.query("CREATE EXTENSION IF NOT EXISTS vector;");
    await pgClient.end();

    execSync(`durcno migrate --config ${configPath}`, {
      stdio: ["ignore", "ignore", "pipe"],
      cwd: __dirname,
      env: {
        ...process.env,
        DATABASE_PORT: String(containerInfo.port),
      },
    });

    db = database(
      schema,
      defineConfig({
        schema: "./schema.ts",
        connector: pgConnector({
          pool: { max: 1 },
          dbCredentials: {
            host: "localhost",
            port: containerInfo.port,
            user: "testuser",
            password: "testpass",
            database: containerInfo.dbName,
          },
        }),
      }),
    );
    client = db.$.config.connector.getClient();
    await client.connect();
  }, 120000);

  afterAll(async () => {
    if (client) await client.close();
    if (db) await db.close();
    if (containerInfo) await stopPostgresContainer(containerInfo.container);
  });

  // ==========================================================================
  // vector
  // ==========================================================================

  describe("vector", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const [row] = await db
        .insert(schema.Items)
        .values({
          vec: [1, 2, 3],
          hvec: [1.5, 2.5, 3.5],
          svec: "{1:1,3:2}/3",
          b: "101",
        })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const [row] = await db
        .from(schema.Items)
        .select()
        .where(eq(schema.Items.id, insertedId));
      expect(row.vec).toEqual([1, 2, 3]);
    });

    it("update", async () => {
      await db
        .update(schema.Items)
        .set({ vec: [4, 5, 6] })
        .where(eq(schema.Items.id, insertedId));
      const [row] = await db
        .from(schema.Items)
        .select()
        .where(eq(schema.Items.id, insertedId));
      expect(row.vec).toEqual([4, 5, 6]);
    });
  });

  // ==========================================================================
  // halfvec
  // ==========================================================================

  describe("halfvec", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const [row] = await db
        .insert(schema.Items)
        .values({
          vec: [0, 0, 0],
          hvec: [1.5, 2.5, 3.5],
          svec: "{1:1}/3",
          b: "000",
        })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const [row] = await db
        .from(schema.Items)
        .select()
        .where(eq(schema.Items.id, insertedId));
      expect(row.hvec).toEqual([1.5, 2.5, 3.5]);
    });
  });

  // ==========================================================================
  // sparsevec
  // ==========================================================================

  describe("sparsevec", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const [row] = await db
        .insert(schema.Items)
        .values({
          vec: [0, 0, 0],
          hvec: [0, 0, 0],
          svec: "{1:1,3:2}/3",
          b: "000",
        })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const [row] = await db
        .from(schema.Items)
        .select()
        .where(eq(schema.Items.id, insertedId));
      expect(row.svec).toEqual("{1:1,3:2}/3");
    });
  });

  // ==========================================================================
  // bit
  // ==========================================================================

  describe("bit", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const [row] = await db
        .insert(schema.Items)
        .values({ vec: [0, 0, 0], hvec: [0, 0, 0], svec: "{1:1}/3", b: "101" })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const [row] = await db
        .from(schema.Items)
        .select()
        .where(eq(schema.Items.id, insertedId));
      expect(row.b).toEqual("101");
    });
  });

  // ==========================================================================
  // distance functions
  // ==========================================================================

  describe("distance functions", () => {
    beforeEach(async () => {
      await truncateTables(client);
    });

    it("l2Distance orderBy", async () => {
      await db.insert(schema.Items).values([
        { vec: [1, 1, 1], hvec: [1, 1, 1], svec: "{1:1}/3", b: "101" },
        { vec: [2, 2, 2], hvec: [2, 2, 2], svec: "{2:1}/3", b: "111" },
        { vec: [3, 3, 3], hvec: [3, 3, 3], svec: "{3:1}/3", b: "000" },
      ]);

      const rows = await db
        .from(schema.Items)
        .select({ id: schema.Items.id })
        .orderBy(asc(l2Distance(schema.Items.vec, [1, 1, 1])));

      expect(rows[0].id).toBe(1n);
      expect(rows[1].id).toBe(2n);
      expect(rows[2].id).toBe(3n);
    });

    it("l2Distance select and where", async () => {
      await db.insert(schema.Items).values([
        { vec: [1, 1, 1], hvec: [1, 1, 1], svec: "{1:1}/3", b: "101" },
        { vec: [2, 2, 2], hvec: [2, 2, 2], svec: "{2:1}/3", b: "111" },
      ]);

      const rows = await db
        .from(schema.Items)
        .select({ dist: l2Distance(schema.Items.vec, [1, 1, 1]) })
        .where(lt(l2Distance(schema.Items.vec, [1, 1, 1]), 1.0));

      expect(rows).toHaveLength(1);
      expect(rows[0].dist).toBe(0);
    });

    it("hammingDistance on bit column", async () => {
      await db.insert(schema.Items).values([
        { vec: [1, 1, 1], hvec: [1, 1, 1], svec: "{1:1}/3", b: "101" },
        { vec: [2, 2, 2], hvec: [2, 2, 2], svec: "{2:1}/3", b: "111" },
        { vec: [3, 3, 3], hvec: [3, 3, 3], svec: "{3:1}/3", b: "000" },
      ]);

      // "111" vs "101" = 1 bit diff, "111" vs "111" = 0, "111" vs "000" = 3
      const rows = await db
        .from(schema.Items)
        .select({
          id: schema.Items.id,
          dist: hammingDistance(schema.Items.b, "111"),
        })
        .orderBy(asc(hammingDistance(schema.Items.b, "111")));

      expect(rows[0].id).toBe(2n); // "111" dist 0
      expect(rows[1].id).toBe(1n); // "101" dist 1
      expect(rows[2].id).toBe(3n); // "000" dist 3
    });
  });
});
