import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  and,
  contains,
  database,
  defineConfig,
  endsWith,
  eq,
  gt,
  gte,
  ilike,
  isIn,
  isNotNull,
  isNull,
  length,
  like,
  lower,
  lt,
  lte,
  ne,
  or,
  startsWith,
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

describe("Filters", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("filters");

  beforeAll(async () => {
    containerInfo = await startPostgresContainer({
      image: "postgres:16-alpine",
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

  describe("eq (equals)", () => {
    it("should filter rows with eq operator", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
          createTestUser({ username: "charlie" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select(({ users }) => ({ username: users.username }))
        .where(({ users }) => eq(users.username, "bob"));

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe("bob");
    });

    it("should work with numeric columns", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ age: 25 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 35 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => eq(users.age, 30));

      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(30);
    });

    it("should work with boolean columns", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ isActive: true }),
          createTestUser({ isActive: false }),
          createTestUser({ isActive: true }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => eq(users.isActive, true));

      expect(result).toHaveLength(2);
    });
  });

  it("should ignore nullish conditions in and/or combinators", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "alice", type: "admin" }),
        createTestUser({ username: "bob", type: "user" }),
      ]);

    const andResult = await db
      .from(schema.Users)
      .select(({ users }) => ({ username: users.username }))
      .where(({ users }) => and(eq(users.type, "admin"), undefined, null));

    const orResult = await db
      .from(schema.Users)
      .select(({ users }) => ({ username: users.username }))
      .where(({ users }) => or(undefined, eq(users.type, "admin"), null));

    expect(andResult).toHaveLength(1);
    expect(andResult[0].username).toBe("alice");
    expect(orResult).toHaveLength(1);
    expect(orResult[0].username).toBe("alice");
  });

  describe("ne (not equals)", () => {
    it("should filter rows with ne operator", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
          createTestUser({ username: "charlie" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select(({ users }) => ({ username: users.username }))
        .where(({ users }) => ne(users.username, "bob"));

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.username)).not.toContain("bob");
    });

    it("should work with numeric columns", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ age: 25 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 30 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => ne(users.age, 30));

      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(25);
    });
  });

  describe("gte (greater than or equal)", () => {
    it("should filter rows with gte operator", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ age: 20 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 40 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => gte(users.age, 30));

      expect(result).toHaveLength(2);
      expect(result.every((r) => (r.age ?? 0) >= 30)).toBe(true);
    });

    it("should include boundary value", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ score: 100 }),
          createTestUser({ score: 50 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => gte(users.score, 100));

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(100);
    });
  });

  describe("lte (less than or equal)", () => {
    it("should filter rows with lte operator", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ age: 20 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 40 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => lte(users.age, 30));

      expect(result).toHaveLength(2);
      expect(result.every((r) => (r.age ?? 0) <= 30)).toBe(true);
    });

    it("should include boundary value", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ score: 50 }),
          createTestUser({ score: 100 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => lte(users.score, 50));

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(50);
    });
  });

  describe("gt (greater than)", () => {
    it("should filter rows with gt operator", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ age: 20 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 40 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => gt(users.age, 30));

      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(40);
    });

    it("should exclude boundary value", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ score: 50 }),
          createTestUser({ score: 100 }),
          createTestUser({ score: 150 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => gt(users.score, 100));

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(150);
    });
  });

  describe("lt (less than)", () => {
    it("should filter rows with lt operator", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ age: 20 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 40 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => lt(users.age, 30));

      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(20);
    });

    it("should exclude boundary value", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ score: 50 }),
          createTestUser({ score: 100 }),
          createTestUser({ score: 150 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => lt(users.score, 100));

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(50);
    });
  });

  describe("isNull", () => {
    it("should filter rows with null values", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ email: "test@example.com" }),
          createTestUser({ email: null }),
          createTestUser({ email: null }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => isNull(users.email));

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.email === null)).toBe(true);
    });

    it("should work with optional numeric columns", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ age: 25 }),
          createTestUser({ age: null }),
          createTestUser({ age: null }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => isNull(users.age));

      expect(result).toHaveLength(2);
    });
  });

  describe("isNotNull", () => {
    it("should filter rows with non-null values", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ email: "test@example.com" }),
          createTestUser({ email: null }),
          createTestUser({ email: "another@example.com" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => isNotNull(users.email));

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.email !== null)).toBe(true);
    });

    it("should work with optional boolean columns", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ isVerified: true }),
          createTestUser({ isVerified: null }),
          createTestUser({ isVerified: false }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => isNotNull(users.isVerified));

      expect(result).toHaveLength(2);
    });
  });

  describe("isIn", () => {
    it("should filter rows with values in list", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
          createTestUser({ username: "charlie" }),
          createTestUser({ username: "dave" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select(({ users }) => ({ username: users.username }))
        .where(({ users }) => isIn(users.username, ["alice", "charlie"]));

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.username).sort()).toEqual([
        "alice",
        "charlie",
      ]);
    });

    it("should work with numeric values", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ age: 20 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 40 }),
          createTestUser({ age: 50 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => isIn(users.age, [20, 40]));

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.age).sort()).toEqual([20, 40]);
    });

    it("should handle empty list", async () => {
      await db
        .insertInto(schema.Users)
        .values([createTestUser(), createTestUser()]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => isIn(users.username, []));

      expect(result).toHaveLength(0);
    });
  });

  describe("and", () => {
    it("should combine multiple conditions with AND", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ type: "admin", status: "active" }),
          createTestUser({ type: "admin", status: "inactive" }),
          createTestUser({ type: "user", status: "active" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) =>
          and(eq(users.type, "admin"), eq(users.status, "active")),
        );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("admin");
      expect(result[0].status).toBe("active");
    });

    it("should work with multiple AND conditions", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ type: "admin", status: "active", isActive: true }),
          createTestUser({ type: "admin", status: "active", isActive: false }),
          createTestUser({ type: "user", status: "active", isActive: true }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) =>
          and(
            eq(users.type, "admin"),
            eq(users.status, "active"),
            eq(users.isActive, true),
          ),
        );

      expect(result).toHaveLength(1);
    });

    it("should work with comparison operators", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ age: 25, score: 100 }),
          createTestUser({ age: 30, score: 50 }),
          createTestUser({ age: 35, score: 150 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) => and(gte(users.age, 30), gte(users.score, 100)));

      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(35);
    });
  });

  describe("or", () => {
    it("should combine multiple conditions with OR", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ type: "admin" }),
          createTestUser({ type: "user" }),
          createTestUser({ type: "user" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) =>
          or(eq(users.type, "admin"), eq(users.username, "never")),
        );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("admin");
    });

    it("should work with multiple OR conditions", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ status: "active" }),
          createTestUser({ status: "inactive" }),
          createTestUser({ status: "pending" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) =>
          or(eq(users.status, "active"), eq(users.status, "pending")),
        );

      expect(result).toHaveLength(2);
    });

    it("should work with isNull and isNotNull", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ email: "test@example.com" }),
          createTestUser({ email: null }),
          createTestUser({ email: null }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) =>
          or(isNull(users.email), eq(users.email, "test@example.com")),
        );

      expect(result).toHaveLength(3);
    });
  });

  describe("Complex combinations", () => {
    it("should combine AND and OR operators", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ type: "admin", status: "active", age: 30 }),
          createTestUser({ type: "user", status: "active", age: 30 }),
          createTestUser({ type: "admin", status: "inactive", age: 35 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) =>
          and(
            or(eq(users.type, "admin"), gte(users.age, 30)),
            eq(users.status, "active"),
          ),
        );

      expect(result).toHaveLength(2);
    });

    it("should work with multiple operators in complex query", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ age: 25, score: 100, type: "admin" }),
          createTestUser({ age: 30, score: 50, type: "user" }),
          createTestUser({ age: 35, score: 150, type: "admin" }),
          createTestUser({ age: 40, score: 200, type: "user" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(({ users }) =>
          and(
            or(eq(users.type, "admin"), gte(users.score, 150)),
            lte(users.age, 35),
          ),
        );

      expect(result).toHaveLength(2);
    });
  });

  describe("like / ilike / startsWith / endsWith / contains", () => {
    it("should filter rows with string pattern filters", async () => {
      const uniqueVal = Date.now().toString();
      await db.insertInto(schema.Users).values(
        createTestUser({
          username: `Prefix_${uniqueVal}_Suffix`,
          email: `filter${uniqueVal}@example.com`,
        }),
      );

      const byStarts = await db
        .from(schema.Users)
        .select(({ users }) => ({ id: users.id }))
        .where(({ users }) =>
          startsWith(users.username, `Prefix_${uniqueVal}`),
        );
      expect(byStarts.length).toBe(1);

      const byEnds = await db
        .from(schema.Users)
        .select(({ users }) => ({ id: users.id }))
        .where(({ users }) => endsWith(users.username, `${uniqueVal}_Suffix`));
      expect(byEnds.length).toBe(1);

      const byContains = await db
        .from(schema.Users)
        .select(({ users }) => ({ id: users.id }))
        .where(({ users }) => contains(users.username, uniqueVal));
      expect(byContains.length).toBe(1);

      const byLike = await db
        .from(schema.Users)
        .select(({ users }) => ({ id: users.id }))
        .where(({ users }) => like(users.username, `Prefix_${uniqueVal}%`));
      expect(byLike.length).toBe(1);

      const byILike = await db
        .from(schema.Users)
        .select(({ users }) => ({ id: users.id }))
        .where(({ users }) => ilike(users.username, `prefix_${uniqueVal}%`));
      expect(byILike.length).toBe(1);

      const byLikeCaseMismatch = await db
        .from(schema.Users)
        .select(({ users }) => ({ id: users.id }))
        .where(({ users }) => like(users.username, `prefix_${uniqueVal}%`));
      expect(byLikeCaseMismatch.length).toBe(0);
    });
  });

  describe("with SqlFn values", () => {
    it("should support SqlFn as filter argument", async () => {
      const uniqueEmail = `mixedCASE${Date.now()}@test.com`;
      const otherEmail = `other${Date.now()}@test.com`;

      await db.insertInto(schema.Users).values([
        createTestUser({
          username: "SqlFn Filter Test",
          email: uniqueEmail,
        }),
        createTestUser({
          username: "SqlFn Filter Test 2",
          email: otherEmail,
        }),
      ]);

      // eq with lower
      const eqResult = await db
        .from(schema.Users)
        .select(({ users }) => ({ email: users.email }))
        .where(({ users }) =>
          eq(lower(users.email), uniqueEmail.toLowerCase()),
        );
      expect(eqResult.length).toBe(1);

      // ne with lower
      const neResult = await db
        .from(schema.Users)
        .select(({ users }) => ({ email: users.email }))
        .where(({ users }) =>
          ne(lower(users.email), uniqueEmail.toLowerCase()),
        );
      expect(neResult.length).toBeGreaterThan(0);
      expect(neResult.find((u) => u.email === uniqueEmail)).toBeUndefined();

      // gt, lt with length
      const lenGt = await db
        .from(schema.Users)
        .select(({ users }) => ({ email: users.email }))
        .where(({ users }) =>
          and(
            eq(users.email, uniqueEmail),
            gt(length(users.email), uniqueEmail.length - 1),
          ),
        );
      expect(lenGt.length).toBe(1);

      const lenLt = await db
        .from(schema.Users)
        .select(({ users }) => ({ email: users.email }))
        .where(({ users }) =>
          and(
            eq(users.email, uniqueEmail),
            lt(length(users.email), uniqueEmail.length + 1),
          ),
        );
      expect(lenLt.length).toBe(1);
    });
  });
});
