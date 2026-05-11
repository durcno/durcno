import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  asc,
  avg,
  count,
  countDistinct,
  database,
  defineConfig,
  desc,
  eq,
  lower,
  max,
  min,
  sum,
} from "durcno";
import { pg } from "durcno/connectors/pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  createTestUser,
  generateMigrationsDirPath,
  runDurcnoCli,
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
  truncateTables,
} from "./setup";

describe("SELECT aggregate functions", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("select-aggregate");

  beforeAll(async () => {
    containerInfo = await startPostgresContainer({
      image: "postgres:14-alpine",
    });
    container = containerInfo.container;

    const configPath = path.resolve(__dirname, "durcno.config.ts");
    const migrationsDir = path.resolve(__dirname, migrationsDirName);

    if (fs.existsSync(migrationsDir)) {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }

    runDurcnoCli("generate", configPath, containerInfo, migrationsDirName);
    runDurcnoCli("migrate", configPath, containerInfo, migrationsDirName);

    db = database(
      schema,
      defineConfig({
        schema: "./schema.ts",
        connector: pg({
          pool: { max: 1 },
          dbCredentials: {
            host: "localhost",
            port: containerInfo.port,
            user: "testuser",
            password: "testpassword",
            database: containerInfo.dbName,
          },
        }),
      }),
    );
    client = db.$.config.connector.getClient();
    await client.connect();
  }, 120000);

  beforeEach(async () => {
    await truncateTables(client);
  });

  afterAll(async () => {
    if (client) await client.close();
    if (db) await db.close();
    if (container) await stopPostgresContainer(container);
  });

  // =========================================================================
  // count
  // =========================================================================

  describe("count", () => {
    it("count(*) should return 0 for an empty table", async () => {
      const [result] = await db
        .from(schema.Users)
        .select({ total: count("*") });

      expect(result.total).toBe(0);
    });

    it("count(*) should count all rows including those with NULL columns", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", age: 30 }),
          createTestUser({ username: "bob", age: null }),
          createTestUser({ username: "charlie", age: null }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ total: count("*") });

      expect(result.total).toBe(3);
    });

    it("count(col) should only count non-null values", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", age: 25 }),
          createTestUser({ username: "bob", age: null }),
          createTestUser({ username: "charlie", age: null }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ withAge: count(schema.Users.age) });

      expect(result.withAge).toBe(1);
    });

    it("count(*) with WHERE filter should count only matching rows", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "admin1", type: "admin" }),
          createTestUser({ username: "admin2", type: "admin" }),
          createTestUser({ username: "user1", type: "user" }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ admins: count("*") })
        .where(eq(schema.Users.type, "admin"));

      expect(result.admins).toBe(2);
    });
  });

  // =========================================================================
  // countDistinct
  // =========================================================================

  describe("countDistinct", () => {
    it("countDistinct should count each distinct value once", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin" }),
          createTestUser({ username: "bob", type: "admin" }),
          createTestUser({ username: "charlie", type: "user" }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ uniqueTypes: countDistinct(schema.Users.type) });

      expect(result.uniqueTypes).toBe(2);
    });

    it("countDistinct should not count NULL values", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", age: 25 }),
          createTestUser({ username: "bob", age: 25 }),
          createTestUser({ username: "charlie", age: null }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ uniqueAges: countDistinct(schema.Users.age) });

      // Only 1 distinct non-null value (25)
      expect(result.uniqueAges).toBe(1);
    });
  });

  // =========================================================================
  // sum
  // =========================================================================

  describe("sum", () => {
    it("sum should return null for an empty table", async () => {
      const [result] = await db
        .from(schema.Users)
        .select({ total: sum(schema.Users.age) });

      expect(result.total).toBeNull();
    });

    it("sum should return the total of all non-null values", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", score: 10 }),
          createTestUser({ username: "bob", score: 20 }),
          createTestUser({ username: "charlie", score: 30 }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ total: sum(schema.Users.score) });

      expect(result.total).toBe(60);
    });

    it("sum should ignore NULL values", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", age: 10 }),
          createTestUser({ username: "bob", age: 20 }),
          createTestUser({ username: "charlie", age: null }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ total: sum(schema.Users.age) });

      expect(result.total).toBe(30);
    });
  });

  // =========================================================================
  // avg
  // =========================================================================

  describe("avg", () => {
    it("avg should return null for an empty table", async () => {
      const [result] = await db
        .from(schema.Users)
        .select({ average: avg(schema.Users.age) });

      expect(result.average).toBeNull();
    });

    it("avg should return the average of non-null values", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", score: 10 }),
          createTestUser({ username: "bob", score: 20 }),
          createTestUser({ username: "charlie", score: 30 }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ average: avg(schema.Users.score) });

      expect(Number(result.average)).toBe(20);
    });

    it("avg should ignore NULL values", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", age: 10 }),
          createTestUser({ username: "bob", age: 30 }),
          createTestUser({ username: "charlie", age: null }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ average: avg(schema.Users.age) });

      expect(Number(result.average)).toBe(20);
    });
  });

  // =========================================================================
  // min
  // =========================================================================

  describe("min", () => {
    it("min should return null for an empty table", async () => {
      const [result] = await db
        .from(schema.Users)
        .select({ lowest: min(schema.Users.age) });

      expect(result.lowest).toBeNull();
    });

    it("min should return the smallest numeric value", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", score: 50 }),
          createTestUser({ username: "bob", score: 10 }),
          createTestUser({ username: "charlie", score: 30 }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ lowest: min(schema.Users.score) });

      expect(result.lowest).toBe(10);
    });

    it("min should return the alphabetically first string value", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "charlie" }),
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ first: min(schema.Users.username) });

      expect(result.first).toBe("alice");
    });

    it("min should ignore NULL values", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", age: 40 }),
          createTestUser({ username: "bob", age: null }),
          createTestUser({ username: "charlie", age: 20 }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ lowest: min(schema.Users.age) });

      expect(result.lowest).toBe(20);
    });
  });

  // =========================================================================
  // max
  // =========================================================================

  describe("max", () => {
    it("max should return null for an empty table", async () => {
      const [result] = await db
        .from(schema.Users)
        .select({ highest: max(schema.Users.age) });

      expect(result.highest).toBeNull();
    });

    it("max should return the largest numeric value", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", score: 50 }),
          createTestUser({ username: "bob", score: 10 }),
          createTestUser({ username: "charlie", score: 30 }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ highest: max(schema.Users.score) });

      expect(result.highest).toBe(50);
    });

    it("max should return the alphabetically last string value", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "charlie" }),
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ last: max(schema.Users.username) });

      expect(result.last).toBe("charlie");
    });

    it("max should ignore NULL values", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", age: 40 }),
          createTestUser({ username: "bob", age: null }),
          createTestUser({ username: "charlie", age: 20 }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ highest: max(schema.Users.age) });

      expect(result.highest).toBe(40);
    });
  });

  // =========================================================================
  // multiple aggregates in a single select
  // =========================================================================

  describe("multiple aggregates in one select", () => {
    it("should compute count, sum, avg, min, and max in a single query", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", score: 10 }),
          createTestUser({ username: "bob", score: 20 }),
          createTestUser({ username: "charlie", score: 30 }),
        ]);

      const [result] = await db.from(schema.Users).select({
        total: count("*"),
        totalScore: sum(schema.Users.score),
        avgScore: avg(schema.Users.score),
        minScore: min(schema.Users.score),
        maxScore: max(schema.Users.score),
      });

      expect(result.total).toBe(3);
      expect(result.totalScore).toBe(60);
      expect(Number(result.avgScore)).toBe(20);
      expect(result.minScore).toBe(10);
      expect(result.maxScore).toBe(30);
    });
  });

  // =========================================================================
  // aggregates in ORDER BY
  // =========================================================================

  describe("aggregates in ORDER BY", () => {
    it("should allow ordering an aggregate-only query by the same aggregate ASC", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", score: 10 }),
          createTestUser({ username: "bob", score: 30 }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ maxScore: max(schema.Users.score) })
        .orderBy(desc("maxScore"));

      expect(result.maxScore).toBe(30);
    });

    it("should allow ordering an aggregate-only query by count DESC", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "user1" }),
          createTestUser({ username: "user2" }),
          createTestUser({ username: "user3" }),
        ]);

      const [result] = await db
        .from(schema.Users)
        .select({ total: count("*") })
        .orderBy(asc("total"));

      expect(result.total).toBe(3);
    });
  });

  // =========================================================================
  // auto GROUP BY — aggregate + plain column
  // =========================================================================

  describe("auto GROUP BY with plain columns", () => {
    it("should group by a plain column and count per group", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin" }),
          createTestUser({ username: "bob", type: "admin" }),
          createTestUser({ username: "charlie", type: "user" }),
        ]);

      const results = await db
        .from(schema.Users)
        .select({ type: schema.Users.type, total: count("*") })
        .orderBy(asc(schema.Users.type));

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe("admin");
      expect(results[0].total).toBe(2);
      expect(results[1].type).toBe("user");
      expect(results[1].total).toBe(1);
    });

    it("should group by multiple plain columns", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin", role: "admin" }),
          createTestUser({ username: "bob", type: "admin", role: "user" }),
          createTestUser({ username: "charlie", type: "user", role: "user" }),
        ]);

      const results = await db
        .from(schema.Users)
        .select({
          type: schema.Users.type,
          role: schema.Users.role,
          total: count("*"),
        })
        .orderBy(asc(schema.Users.type));

      expect(results.length).toBeGreaterThanOrEqual(2);
      const adminGroup = results.find(
        (r) => r.type === "admin" && r.role === "admin",
      );
      expect(adminGroup?.total).toBe(1);
    });

    it("should compute sum per group", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin", score: 10 }),
          createTestUser({ username: "bob", type: "admin", score: 20 }),
          createTestUser({ username: "charlie", type: "user", score: 5 }),
        ]);

      const results = await db
        .from(schema.Users)
        .select({
          type: schema.Users.type,
          totalScore: sum(schema.Users.score),
        })
        .orderBy(asc(schema.Users.type));

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe("admin");
      expect(results[0].totalScore).toBe(30);
      expect(results[1].type).toBe("user");
      expect(results[1].totalScore).toBe(5);
    });

    it("should work with WHERE + auto GROUP BY", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin", score: 10 }),
          createTestUser({ username: "bob", type: "admin", score: 20 }),
          createTestUser({ username: "charlie", type: "user", score: 5 }),
          createTestUser({ username: "dave", type: "user", score: 15 }),
        ]);

      const results = await db
        .from(schema.Users)
        .select({ type: schema.Users.type, total: count("*") })
        .where(eq(schema.Users.type, "admin"))
        .orderBy(asc(schema.Users.type));

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("admin");
      expect(results[0].total).toBe(2);
    });
  });

  // =========================================================================
  // auto GROUP BY — aggregate + scalar fn
  // =========================================================================

  describe("auto GROUP BY with scalar functions", () => {
    it("should group by a scalar fn result and count per group", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "Alice" }),
          createTestUser({ username: "adam" }),
          createTestUser({ username: "Bob" }),
        ]);

      const results = await db
        .from(schema.Users)
        .select({ lowerName: lower(schema.Users.username), total: count("*") })
        .orderBy(asc(lower(schema.Users.username)));

      // "Alice" and "adam" both lower to distinct values; "Bob" is also distinct
      expect(results.length).toBeGreaterThanOrEqual(2);
      const adamGroup = results.find((r) => r.lowerName === "adam");
      expect(adamGroup?.total).toBe(1);
    });
  });
});
