import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  and,
  database,
  defineConfig,
  eq,
  gt,
  gte,
  isIn,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
} from "durcno";
import { pg } from "durcno/connectors/pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  cleanDatabase,
  createTestUser,
  generateMigrationsDirPath,
  runDurcnoCli,
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
} from "./setup";

describe("WHERE clause operators", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  const migrationsDirName = generateMigrationsDirPath("where");

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
          pool: { max: 5 },
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
  }, 120000);

  beforeEach(async () => {
    await cleanDatabase(containerInfo.connectionString);
  });

  afterAll(async () => {
    if (db) await db.close();
    if (container) await stopPostgresContainer(container);
  });

  describe("eq (equals)", () => {
    it("should filter rows with eq operator", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
          createTestUser({ username: "charlie" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select({ username: schema.Users.username })
        .where(eq(schema.Users.username, "bob"));

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe("bob");
    });

    it("should work with numeric columns", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ age: 25 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 35 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(eq(schema.Users.age, 30));

      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(30);
    });

    it("should work with enum columns", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ type: "admin" }),
          createTestUser({ type: "user" }),
          createTestUser({ type: "user" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(eq(schema.Users.type, "admin"));

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("admin");
    });

    it("should work with boolean columns", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ isActive: true }),
          createTestUser({ isActive: false }),
          createTestUser({ isActive: true }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(eq(schema.Users.isActive, true));

      expect(result).toHaveLength(2);
    });
  });

  describe("ne (not equals)", () => {
    it("should filter rows with ne operator", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
          createTestUser({ username: "charlie" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select({ username: schema.Users.username })
        .where(ne(schema.Users.username, "bob"));

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.username)).not.toContain("bob");
    });

    it("should work with numeric columns", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ age: 25 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 30 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(ne(schema.Users.age, 30));

      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(25);
    });
  });

  describe("gte (greater than or equal)", () => {
    it("should filter rows with gte operator", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ age: 20 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 40 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(gte(schema.Users.age, 30));

      expect(result).toHaveLength(2);
      expect(result.every((r) => (r.age ?? 0) >= 30)).toBe(true);
    });

    it("should include boundary value", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ score: 100 }),
          createTestUser({ score: 50 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(gte(schema.Users.score, 100));

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(100);
    });
  });

  describe("lte (less than or equal)", () => {
    it("should filter rows with lte operator", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ age: 20 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 40 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(lte(schema.Users.age, 30));

      expect(result).toHaveLength(2);
      expect(result.every((r) => (r.age ?? 0) <= 30)).toBe(true);
    });

    it("should include boundary value", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ score: 50 }),
          createTestUser({ score: 100 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(lte(schema.Users.score, 50));

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(50);
    });
  });

  describe("gt (greater than)", () => {
    it("should filter rows with gt operator", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ age: 20 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 40 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(gt(schema.Users.age, 30));

      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(40);
    });

    it("should exclude boundary value", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ score: 50 }),
          createTestUser({ score: 100 }),
          createTestUser({ score: 150 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(gt(schema.Users.score, 100));

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(150);
    });
  });

  describe("lt (less than)", () => {
    it("should filter rows with lt operator", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ age: 20 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 40 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(lt(schema.Users.age, 30));

      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(20);
    });

    it("should exclude boundary value", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ score: 50 }),
          createTestUser({ score: 100 }),
          createTestUser({ score: 150 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(lt(schema.Users.score, 100));

      expect(result).toHaveLength(1);
      expect(result[0].score).toBe(50);
    });
  });

  describe("isNull", () => {
    it("should filter rows with null values", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ email: "test@example.com" }),
          createTestUser({ email: null }),
          createTestUser({ email: null }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(isNull(schema.Users.email));

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.email === null)).toBe(true);
    });

    it("should work with optional numeric columns", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ age: 25 }),
          createTestUser({ age: null }),
          createTestUser({ age: null }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(isNull(schema.Users.age));

      expect(result).toHaveLength(2);
    });
  });

  describe("isNotNull", () => {
    it("should filter rows with non-null values", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ email: "test@example.com" }),
          createTestUser({ email: null }),
          createTestUser({ email: "another@example.com" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(isNotNull(schema.Users.email));

      expect(result).toHaveLength(2);
      expect(result.every((r) => r.email !== null)).toBe(true);
    });

    it("should work with optional boolean columns", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ isVerified: true }),
          createTestUser({ isVerified: null }),
          createTestUser({ isVerified: false }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(isNotNull(schema.Users.isVerified));

      expect(result).toHaveLength(2);
    });
  });

  describe("isIn", () => {
    it("should filter rows with values in list", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
          createTestUser({ username: "charlie" }),
          createTestUser({ username: "dave" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select({ username: schema.Users.username })
        .where(isIn(schema.Users.username, ["alice", "charlie"]));

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.username).sort()).toEqual([
        "alice",
        "charlie",
      ]);
    });

    it("should work with numeric values", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ age: 20 }),
          createTestUser({ age: 30 }),
          createTestUser({ age: 40 }),
          createTestUser({ age: 50 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(isIn(schema.Users.age, [20, 40]));

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.age).sort()).toEqual([20, 40]);
    });

    it("should handle empty list", async () => {
      await db
        .insert(schema.Users)
        .values([createTestUser(), createTestUser()]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(isIn(schema.Users.username, []));

      expect(result).toHaveLength(0);
    });
  });

  describe("and", () => {
    it("should combine multiple conditions with AND", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ type: "admin", status: "active" }),
          createTestUser({ type: "admin", status: "inactive" }),
          createTestUser({ type: "user", status: "active" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(
          and(
            eq(schema.Users.type, "admin"),
            eq(schema.Users.status, "active"),
          ),
        );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("admin");
      expect(result[0].status).toBe("active");
    });

    it("should work with multiple AND conditions", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ type: "admin", status: "active", isActive: true }),
          createTestUser({ type: "admin", status: "active", isActive: false }),
          createTestUser({ type: "user", status: "active", isActive: true }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(
          and(
            eq(schema.Users.type, "admin"),
            eq(schema.Users.status, "active"),
            eq(schema.Users.isActive, true),
          ),
        );

      expect(result).toHaveLength(1);
    });

    it("should work with comparison operators", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ age: 25, score: 100 }),
          createTestUser({ age: 30, score: 50 }),
          createTestUser({ age: 35, score: 150 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(and(gte(schema.Users.age, 30), gte(schema.Users.score, 100)));

      expect(result).toHaveLength(1);
      expect(result[0].age).toBe(35);
    });
  });

  describe("or", () => {
    it("should combine multiple conditions with OR", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ type: "admin" }),
          createTestUser({ type: "user" }),
          createTestUser({ type: "user" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(
          or(
            eq(schema.Users.type, "admin"),
            eq(schema.Users.username, "never"),
          ),
        );

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("admin");
    });

    it("should work with multiple OR conditions", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ status: "active" }),
          createTestUser({ status: "inactive" }),
          createTestUser({ status: "pending" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(
          or(
            eq(schema.Users.status, "active"),
            eq(schema.Users.status, "pending"),
          ),
        );

      expect(result).toHaveLength(2);
    });

    it("should work with isNull and isNotNull", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ email: "test@example.com" }),
          createTestUser({ email: null }),
          createTestUser({ email: null }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(
          or(
            isNull(schema.Users.email),
            eq(schema.Users.email, "test@example.com"),
          ),
        );

      expect(result).toHaveLength(3);
    });
  });

  describe("Complex combinations", () => {
    it("should combine AND and OR operators", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ type: "admin", status: "active", age: 30 }),
          createTestUser({ type: "user", status: "active", age: 25 }),
          createTestUser({ type: "admin", status: "inactive", age: 35 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(
          and(
            or(eq(schema.Users.type, "admin"), gte(schema.Users.age, 30)),
            eq(schema.Users.status, "active"),
          ),
        );

      expect(result).toHaveLength(2);
    });

    it("should work with multiple operators in complex query", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ age: 25, score: 100, type: "admin" }),
          createTestUser({ age: 30, score: 50, type: "user" }),
          createTestUser({ age: 35, score: 150, type: "admin" }),
          createTestUser({ age: 40, score: 200, type: "user" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select()
        .where(
          and(
            or(eq(schema.Users.type, "admin"), gte(schema.Users.score, 150)),
            lte(schema.Users.age, 35),
          ),
        );

      expect(result).toHaveLength(2);
    });
  });
});
