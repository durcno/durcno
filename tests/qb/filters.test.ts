import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  Arg,
  and,
  asc,
  caseWhen,
  contains,
  count,
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
  prepare,
  Query,
  startsWith,
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
    client = db._.config.connector.getClient();
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
        .select(() => ({ username: schema.Users.username }))
        .where(() => eq(schema.Users.username, "bob"));

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
        .where(() => eq(schema.Users.age, 30));

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
        .where(() => eq(schema.Users.isActive, true));

      expect(result).toHaveLength(2);
    });
  });

  describe("null predicates", () => {
    it("rejects empty logical groups at runtime", () => {
      // @ts-expect-error - runtime guard for untyped callers
      expect(() => and()).toThrow("and() requires at least one condition.");
      // @ts-expect-error - runtime guard for untyped callers
      expect(() => or()).toThrow("or() requires at least one condition.");
    });

    it("renders null as SQL NULL in a SELECT predicate", async () => {
      await db.insertInto(schema.Users).values(createTestUser());

      const query = db
        .from(schema.Users)
        .select("*")
        .where(() => null);
      expect(query.toQuery().sql).toContain(" WHERE NULL");
      await expect(query).resolves.toEqual([]);
    });

    it("keeps native SQL semantics for null comparison operands", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "with_email", email: "test@example.com" }),
          createTestUser({ username: "without_email", email: null }),
        ]);

      const equalsNull = db
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.email, null));
      const notEqualsNull = db
        .from(schema.Users)
        .select("*")
        .where(() => ne(schema.Users.email, null));

      expect(equalsNull.toQuery().sql).toContain('"email" = NULL');
      expect(notEqualsNull.toQuery().sql).toContain('"email" != NULL');
      await expect(equalsNull).resolves.toEqual([]);
      await expect(notEqualsNull).resolves.toEqual([]);
    });

    it("uses PostgreSQL three-valued logic in and/or combinators", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin" }),
          createTestUser({ username: "bob", type: "user" }),
        ]);

      const selectUsernames = () =>
        db
          .from(schema.Users)
          .select(() => ({ username: schema.Users.username }))
          .orderBy(() => asc(schema.Users.username));
      const isAdmin = eq(schema.Users.type, "admin");

      const andNull = selectUsernames().where(() => and(isAdmin, null));
      const orNull = selectUsernames().where(() => or(isAdmin, null));
      const orFalseNull = selectUsernames().where(() => or(false, null));
      const orTrueNull = selectUsernames().where(() => or(true, null));

      expect(andNull.toQuery().sql).toContain("AND NULL");
      expect(orNull.toQuery().sql).toContain("OR NULL");
      await expect(andNull).resolves.toEqual([]);
      await expect(orNull).resolves.toEqual([{ username: "alice" }]);
      await expect(orFalseNull).resolves.toEqual([]);
      await expect(orTrueNull).resolves.toEqual([
        { username: "alice" },
        { username: "bob" },
      ]);
    });

    it("applies SQL NULL predicates to updates, deletes, and shortcuts", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "unchanged", bio: "original" }))
        .returning({ id: true });

      await expect(
        db
          .update(schema.Users)
          .set({ bio: "changed" })
          .where(null)
          .returning("*"),
      ).resolves.toEqual([]);
      await expect(db.deleteFrom(schema.Users).where(null)).resolves.toEqual(
        [],
      );

      const [unchanged] = await db
        .from(schema.Users)
        .select(() => ({ bio: schema.Users.bio }))
        .where(() => eq(schema.Users.id, user.id));
      expect(unchanged.bio).toBe("original");
      await expect(db.$count(schema.Users, null)).resolves.toBe(0);
      await expect(db.$exists(schema.Users, null)).resolves.toBe(false);
    });

    it("uses SQL NULL in join predicates", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "null_join" }))
        .returning({ id: true });
      await db
        .insertInto(schema.Posts)
        .values({ userId: user.id, title: "Post" });

      const innerJoin = db
        .from(schema.Users)
        .innerJoin(schema.Posts)
        .on(() => null)
        .select(() => ({ userId: schema.Users.id, postId: schema.Posts.id }));
      const leftJoin = db
        .from(schema.Users)
        .leftJoin(schema.Posts)
        .on(() => null)
        .select(({ posts }) => ({
          userId: schema.Users.id,
          postId: posts.id,
        }));

      await expect(innerJoin).resolves.toEqual([]);
      await expect(leftJoin).resolves.toEqual([
        { userId: user.id, postId: null },
      ]);
    });

    it("uses SQL NULL in HAVING, FILTER, and CASE predicates", async () => {
      await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "null_aggregates", score: 10 }));

      const grouped = db
        .from(schema.Users)
        .select(() => ({ type: schema.Users.type, total: count("*") }))
        .groupBy(() => schema.Users.type)
        .having(() => null);
      await expect(grouped).resolves.toEqual([]);

      const aggregates = db.from(schema.Users).select(() => ({
        total: count("*").filter(null),
        scoreSum: sum(schema.Users.score).filter(null),
        label: caseWhen(null, "matched").else("fallback"),
      }));
      await expect(aggregates).resolves.toEqual([
        { total: 0, scoreSum: null, label: "fallback" },
      ]);
    });

    it("uses SQL NULL in conflict update predicates", async () => {
      await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "null_conflict", bio: "original" }));

      const conflictResult = await db
        .insertInto(schema.Users)
        .values(
          createTestUser({ username: "null_conflict", bio: "replacement" }),
        )
        .onConflict(schema.Users.username)
        .doUpdateSet(
          ({ excluded }) => ({ bio: excluded.bio }),
          () => null,
        )
        .returning("*");
      expect(conflictResult).toEqual([]);

      const [afterConflict] = await db
        .from(schema.Users)
        .select(() => ({ bio: schema.Users.bio }))
        .where(() => eq(schema.Users.username, "null_conflict"));
      expect(afterConflict.bio).toBe("original");
    });
  });

  it("should accept boolean literals in where", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "alice" }),
        createTestUser({ username: "bob" }),
      ]);

    const all = await db
      .from(schema.Users)
      .select(() => ({ username: schema.Users.username }))
      .where(() => true);

    const none = await db
      .from(schema.Users)
      .select(() => ({ username: schema.Users.username }))
      .where(() => false);

    expect(all).toHaveLength(2);
    expect(none).toHaveLength(0);
  });

  it("should compose boolean literals in and/or combinators", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "alice", type: "admin" }),
        createTestUser({ username: "bob", type: "user" }),
        createTestUser({ username: "charlie", type: "user" }),
      ]);

    const selectUsernames = () =>
      db.from(schema.Users).select(() => ({ username: schema.Users.username }));

    const andTrue = await selectUsernames().where(() =>
      and(true, eq(schema.Users.type, "admin")),
    );
    const andFalse = await selectUsernames().where(() =>
      and(false, eq(schema.Users.type, "admin")),
    );
    const orFalse = await selectUsernames().where(() =>
      or(false, eq(schema.Users.type, "admin")),
    );
    const orTrue = await selectUsernames().where(() =>
      or(true, eq(schema.Users.type, "admin")),
    );

    expect(andTrue).toHaveLength(1);
    expect(andFalse).toHaveLength(0);
    expect(orFalse).toHaveLength(1);
    expect(orTrue).toHaveLength(3);
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
        .select(() => ({ username: schema.Users.username }))
        .where(() => ne(schema.Users.username, "bob"));

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
        .where(() => ne(schema.Users.age, 30));

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
        .where(() => gte(schema.Users.age, 30));

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
        .where(() => gte(schema.Users.score, 100));

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
        .where(() => lte(schema.Users.age, 30));

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
        .where(() => lte(schema.Users.score, 50));

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
        .where(() => gt(schema.Users.age, 30));

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
        .where(() => gt(schema.Users.score, 100));

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
        .where(() => lt(schema.Users.age, 30));

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
        .where(() => lt(schema.Users.score, 100));

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
        .where(() => isNull(schema.Users.email));

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
        .where(() => isNull(schema.Users.age));

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
        .where(() => isNotNull(schema.Users.email));

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
        .where(() => isNotNull(schema.Users.isVerified));

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
        .select(() => ({ username: schema.Users.username }))
        .where(() => isIn(schema.Users.username, ["alice", "charlie"]));

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
        .where(() => isIn(schema.Users.age, [20, 40]));

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
        .where(() => isIn(schema.Users.username, []));

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
        .where(() =>
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
        .insertInto(schema.Users)
        .values([
          createTestUser({ type: "admin", status: "active", isActive: true }),
          createTestUser({ type: "admin", status: "active", isActive: false }),
          createTestUser({ type: "user", status: "active", isActive: true }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(() =>
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
        .insertInto(schema.Users)
        .values([
          createTestUser({ age: 25, score: 100 }),
          createTestUser({ age: 30, score: 50 }),
          createTestUser({ age: 35, score: 150 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(() =>
          and(gte(schema.Users.age, 30), gte(schema.Users.score, 100)),
        );

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
        .where(() =>
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
        .insertInto(schema.Users)
        .values([
          createTestUser({ status: "active" }),
          createTestUser({ status: "inactive" }),
          createTestUser({ status: "pending" }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(() =>
          or(
            eq(schema.Users.status, "active"),
            eq(schema.Users.status, "pending"),
          ),
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
        .where(() =>
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
        .insertInto(schema.Users)
        .values([
          createTestUser({ type: "admin", status: "active", age: 30 }),
          createTestUser({ type: "user", status: "active", age: 30 }),
          createTestUser({ type: "admin", status: "inactive", age: 35 }),
        ]);

      const result = await db
        .from(schema.Users)
        .select("*")
        .where(() =>
          and(
            or(eq(schema.Users.type, "admin"), gte(schema.Users.age, 30)),
            eq(schema.Users.status, "active"),
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
        .where(() =>
          and(
            or(eq(schema.Users.type, "admin"), gte(schema.Users.score, 150)),
            lte(schema.Users.age, 35),
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
        .select(() => ({ id: schema.Users.id }))
        .where(() => startsWith(schema.Users.username, `Prefix_${uniqueVal}`));
      expect(byStarts.length).toBe(1);

      const byEnds = await db
        .from(schema.Users)
        .select(() => ({ id: schema.Users.id }))
        .where(() => endsWith(schema.Users.username, `${uniqueVal}_Suffix`));
      expect(byEnds.length).toBe(1);

      const byContains = await db
        .from(schema.Users)
        .select(() => ({ id: schema.Users.id }))
        .where(() => contains(schema.Users.username, uniqueVal));
      expect(byContains.length).toBe(1);

      const byLike = await db
        .from(schema.Users)
        .select(() => ({ id: schema.Users.id }))
        .where(() => like(schema.Users.username, `Prefix_${uniqueVal}%`));
      expect(byLike.length).toBe(1);

      const byILike = await db
        .from(schema.Users)
        .select(() => ({ id: schema.Users.id }))
        .where(() => ilike(schema.Users.username, `prefix_${uniqueVal}%`));
      expect(byILike.length).toBe(1);

      const byLikeCaseMismatch = await db
        .from(schema.Users)
        .select(() => ({ id: schema.Users.id }))
        .where(() => like(schema.Users.username, `prefix_${uniqueVal}%`));
      expect(byLikeCaseMismatch.length).toBe(0);
    });

    it("should honor a custom escape character", async () => {
      await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "100%_done" }));

      const escaped = await db
        .from(schema.Users)
        .select(() => ({ id: schema.Users.id }))
        .where(() => like(schema.Users.username, "100!%%!_done").escape("!"));
      expect(escaped).toHaveLength(1);

      const caseInsensitive = await db
        .from(schema.Users)
        .select(() => ({ id: schema.Users.id }))
        .where(() => ilike(schema.Users.username, "100!%%!_DONE").escape("!"));
      expect(caseInsensitive).toHaveLength(1);

      // Without a custom escape, '!' is a literal character in the pattern.
      const unescaped = await db
        .from(schema.Users)
        .select(() => ({ id: schema.Users.id }))
        .where(() => like(schema.Users.username, "100!%%!_done"));
      expect(unescaped).toHaveLength(0);

      const escapeArg = new Arg<string>((value) => value);
      const prepared = prepare({ escape: escapeArg }, (args) =>
        db
          .prepare()
          .from(schema.Users)
          .select(() => ({ id: schema.Users.id }))
          .where(() =>
            like(schema.Users.username, "100!%%!_done").escape(args.escape),
          ),
      );
      const preparedRows = await prepared.run(db, { escape: "!" });
      expect(preparedRows).toHaveLength(1);
    });

    it("should render ESCAPE clauses", () => {
      const query = new Query("", () => []);
      like(schema.Users.username, "a!%").escape("!").toQuery(query);
      query.sql += " ";
      ilike(schema.Users.username, "a!%")
        .escape(new Arg<string>((value) => value))
        .toQuery(query);
      query.sql += " ";
      like(schema.Users.username, "a'%").escape("'").toQuery(query);
      query.sql += " ";
      like(schema.Users.username, "a%").toQuery(query);

      expect(query.sql).toContain("LIKE 'a!%' ESCAPE '!'");
      expect(query.sql).toContain("ILIKE 'a!%' ESCAPE $1");
      expect(query.sql).toContain("LIKE 'a''%' ESCAPE ''''");
      expect(query.sql).toContain("LIKE 'a%'");
      expect(query.sql).not.toContain("LIKE 'a%' ESCAPE");
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
        .select(() => ({ email: schema.Users.email }))
        .where(() => eq(lower(schema.Users.email), uniqueEmail.toLowerCase()));
      expect(eqResult.length).toBe(1);

      // ne with lower
      const neResult = await db
        .from(schema.Users)
        .select(() => ({ email: schema.Users.email }))
        .where(() => ne(lower(schema.Users.email), uniqueEmail.toLowerCase()));
      expect(neResult.length).toBeGreaterThan(0);
      expect(neResult.find((u) => u.email === uniqueEmail)).toBeUndefined();

      // gt, lt with length
      const lenGt = await db
        .from(schema.Users)
        .select(() => ({ email: schema.Users.email }))
        .where(() =>
          and(
            eq(schema.Users.email, uniqueEmail),
            gt(length(schema.Users.email), uniqueEmail.length - 1),
          ),
        );
      expect(lenGt.length).toBe(1);

      const lenLt = await db
        .from(schema.Users)
        .select(() => ({ email: schema.Users.email }))
        .where(() =>
          and(
            eq(schema.Users.email, uniqueEmail),
            lt(length(schema.Users.email), uniqueEmail.length + 1),
          ),
        );
      expect(lenLt.length).toBe(1);
    });
  });
});
