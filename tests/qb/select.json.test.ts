import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  asc,
  caseWhen,
  coalesce,
  count,
  database,
  defineConfig,
  eq,
  isNotNull,
  isNull,
  jsonAgg,
  jsonBuildArray,
  jsonBuildObject,
  jsonbAgg,
  jsonbBuildObject,
  jsonStripNulls,
  sum,
  toJson,
  toJsonb,
} from "durcno";
import { pg } from "durcno/connectors/pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  createTestComment,
  createTestPost,
  createTestUser,
  generateMigrationsDirPath,
  runDurcnoCli,
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
  truncateTables,
} from "./setup";

describe("SELECT with JSON functions, Aggregate builders, and CASE", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("json-functions");

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

  describe("jsonBuildObject & jsonbBuildObject", () => {
    it("should construct JSON and JSONB objects from columns and literals", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", email: "alice@example.com" }),
        ]);

      const [row] = await db.from(schema.Users).select(() => ({
        userObj: jsonBuildObject({
          id: schema.Users.id,
          username: schema.Users.username,
          email: schema.Users.email,
        }),
        userObjB: jsonbBuildObject({
          name: schema.Users.username,
          staticKey: "durcno",
        }),
      }));

      expect(row.userObj).toEqual({
        id: expect.any(Number),
        username: "alice",
        email: "alice@example.com",
      });
      expect(row.userObjB).toEqual({
        name: "alice",
        staticKey: "durcno",
      });
    });

    it("should support nested jsonBuildObject calls", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "bob", email: "bob@example.com" }),
        ]);

      const [row] = await db.from(schema.Users).select(() => ({
        nested: jsonBuildObject({
          id: schema.Users.id,
          profile: jsonBuildObject({
            name: schema.Users.username,
            verified: true,
          }),
        }),
      }));

      expect(row.nested).toEqual({
        id: expect.any(Number),
        profile: {
          name: "bob",
          verified: true,
        },
      });
    });
  });

  describe("caseWhen builder", () => {
    it("should evaluate conditional CASE branches", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "admin_user", type: "admin" }),
          createTestUser({ username: "regular_user", type: "user" }),
        ]);

      const rows = await db
        .from(schema.Users)
        .select(() => ({
          username: schema.Users.username,
          label: caseWhen(eq(schema.Users.type, "admin"), "Administrator")
            .when(eq(schema.Users.type, "user"), "Standard Member")
            .else("Unknown"),
        }))
        .orderBy(() => asc(schema.Users.username));

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        username: "admin_user",
        label: "Administrator",
      });
      expect(rows[1]).toEqual({
        username: "regular_user",
        label: "Standard Member",
      });
    });

    it("should evaluate direct caseWhen without explicit else or end", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "admin_user", type: "admin" }),
          createTestUser({ username: "regular_user", type: "user" }),
        ]);

      const rows = await db
        .from(schema.Users)
        .select(() => ({
          username: schema.Users.username,
          adminOnly: caseWhen(eq(schema.Users.type, "admin"), "Admin"),
        }))
        .orderBy(() => asc(schema.Users.username));

      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        username: "admin_user",
        adminOnly: "Admin",
      });
      expect(rows[1]).toEqual({
        username: "regular_user",
        adminOnly: null,
      });
    });

    it("should handle null on 1-to-1 LEFT JOIN when parent is missing", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "author" }))
        .returning({ id: true });

      await db
        .insertInto(schema.Posts)
        .values([createTestPost(user.id, { title: "Post with Author" })]);

      // Left join matching user
      const [postWithAuthor] = await db
        .from(schema.Posts)
        .leftJoin(schema.Users, () => eq(schema.Users.id, schema.Posts.userId))
        .select(({ users }) => ({
          title: schema.Posts.title,
          author: caseWhen(isNull(users.id), null).else(
            jsonBuildObject({
              id: users.id,
              username: users.username,
            }),
          ),
        }));

      expect(postWithAuthor.author).toEqual({
        id: Number(user.id),
        username: "author",
      });

      // Left join where join condition does not match (author should be null)
      const [postWithoutAuthor] = await db
        .from(schema.Posts)
        .leftJoin(schema.Users, () => eq(schema.Users.id, 999999n))
        .select(({ users }) => ({
          title: schema.Posts.title,
          author: caseWhen(isNull(users.id), null).else(
            jsonBuildObject({
              id: users.id,
              username: users.username,
            }),
          ),
        }));

      expect(postWithoutAuthor.author).toBeNull();
    });

    it("should evaluate caseWhen with plain object literals and BigInt values without NaN or unhandled errors", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "case_obj_user" }))
        .returning({ id: true });

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          meta: caseWhen(eq(schema.Users.id, user.id), {
            role: "admin",
            level: 1,
          }).else({
            role: "guest",
            level: 0,
          }),
          bigintVal: caseWhen(
            eq(schema.Users.id, user.id),
            9007199254740993n,
          ).else(0n),
          boolVal: caseWhen(eq(schema.Users.id, user.id), true).else(false),
          numVal: caseWhen(eq(schema.Users.id, user.id), 42).else(0),
        }))
        .where(() => eq(schema.Users.id, user.id));

      expect(row.meta).toEqual({ role: "admin", level: 1 });
      expect(row.bigintVal).toBe(9007199254740993n);
      expect(row.boolVal).toBe(true);
      expect(row.numVal).toBe(42);
    });

    it("should evaluate caseWhen and coalesce with Date instances", async () => {
      const targetDate = new Date("2025-01-01T00:00:00.000Z");
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "date_user" }))
        .returning({ id: true });

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          fallbackDate: coalesce(null, targetDate),
          caseDate: caseWhen(eq(schema.Users.id, user.id), targetDate).else(
            new Date("2020-01-01T00:00:00.000Z"),
          ),
        }))
        .where(() => eq(schema.Users.id, user.id));

      expect(new Date(row.fallbackDate as any).toISOString()).toBe(
        targetDate.toISOString(),
      );
      expect(new Date(row.caseDate as any).toISOString()).toBe(
        targetDate.toISOString(),
      );
    });

    it("should match jsonb types between branch and else when plain objects are used", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "jsonb_case_user" }))
        .returning({ id: true });

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          result: caseWhen(
            eq(schema.Users.id, user.id),
            jsonbBuildObject({ active: true }),
          ).else({ active: false }),
        }))
        .where(() => eq(schema.Users.id, user.id));

      expect(row.result).toEqual({ active: true });
    });
  });

  describe("jsonAgg & jsonbAgg", () => {
    it("should aggregate rows into a JSON array", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
        ]);

      const [row] = await db.from(schema.Users).select(() => ({
        allUsers: jsonAgg(
          jsonBuildObject({
            id: schema.Users.id,
            username: schema.Users.username,
          }),
        ).orderBy(asc(schema.Users.username)),
      }));

      expect(row.allUsers).toHaveLength(2);
      expect(row.allUsers![0].username).toBe("alice");
      expect(row.allUsers![1].username).toBe("bob");
    });

    it("should support .distinct() on jsonAgg and jsonbAgg", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "user" }),
          createTestUser({ username: "bob", type: "user" }),
          createTestUser({ username: "carol", type: "admin" }),
        ]);

      const [row] = await db.from(schema.Users).select(() => ({
        types: jsonbAgg(schema.Users.type).distinct(),
      }));

      expect(row.types?.sort()).toEqual(["admin", "user"]);
    });
  });

  describe("coalesce with jsonAgg in LEFT JOIN queries", () => {
    it("should return [] when joined table has 0 rows using coalesce and filter", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "alice" }))
        .returning({ id: true });

      const [post] = await db
        .insertInto(schema.Posts)
        .values(createTestPost(user.id, { title: "Post without comments" }))
        .returning({ id: true });

      const [result] = await db
        .from(schema.Posts)
        .leftJoin(schema.Comments, () =>
          eq(schema.Comments.postId, schema.Posts.id),
        )
        .select(({ comments }) => ({
          postId: schema.Posts.id,
          comments: coalesce(
            jsonAgg(
              jsonBuildObject({
                id: comments.id,
                body: comments.body,
              }),
            ).filter(isNotNull(comments.id)),
            [],
          ),
        }))
        .where(() => eq(schema.Posts.id, post.id))
        .groupBy(() => [schema.Posts.id]);

      expect(result.comments).toEqual([]);
    });

    it("should return sorted array of children when comments exist", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "author" }))
        .returning({ id: true });

      const [post] = await db
        .insertInto(schema.Posts)
        .values(createTestPost(user.id, { title: "Active discussion" }))
        .returning({ id: true });

      await db.insertInto(schema.Comments).values([
        createTestComment(post.id, user.id, {
          body: "First comment",
        }),
        createTestComment(post.id, user.id, {
          body: "Second comment",
        }),
      ]);

      const [result] = await db
        .from(schema.Posts)
        .leftJoin(schema.Comments, () =>
          eq(schema.Comments.postId, schema.Posts.id),
        )
        .select(({ comments }) => ({
          postId: schema.Posts.id,
          comments: coalesce(
            jsonAgg(
              jsonBuildObject({
                id: comments.id,
                body: comments.body,
              }),
            )
              .orderBy(asc(comments.id))
              .filter(isNotNull(comments.id)),
            [],
          ),
        }))
        .where(() => eq(schema.Posts.id, post.id))
        .groupBy(() => [schema.Posts.id]);

      expect(result.comments).toHaveLength(2);
      expect(result.comments[0].body).toBe("First comment");
      expect(result.comments[1].body).toBe("Second comment");
    });
  });

  describe("Base AggregateSqlFn .filter() and .orderBy()", () => {
    it("should filter standard aggregates like count() and sum()", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "admin1", type: "admin", score: 50 }),
          createTestUser({ username: "admin2", type: "admin", score: 100 }),
          createTestUser({ username: "user1", type: "user", score: 25 }),
        ]);

      const [stats] = await db.from(schema.Users).select(() => ({
        adminCount: count(schema.Users.id).filter(
          eq(schema.Users.type, "admin"),
        ),
        adminScoreSum: sum(schema.Users.score).filter(
          eq(schema.Users.type, "admin"),
        ),
        totalCount: count("*"),
      }));

      expect(stats.adminCount).toBe(2);
      expect(stats.adminScoreSum).toBe(150);
      expect(stats.totalCount).toBe(3);
    });
  });

  describe("toJson, jsonBuildArray & jsonStripNulls", () => {
    it("should convert table view to JSON object using toJson", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(
          createTestUser({ username: "json_user", email: "ju@example.com" }),
        )
        .returning({ id: true });

      const [row] = await db.from(schema.Users).select(() => ({
        fullUser: toJson(schema.Users),
      }));

      expect(row.fullUser).toMatchObject({
        username: "json_user",
        email: "ju@example.com",
      });
      expect(Number((row.fullUser as any).id)).toBe(Number(user.id));
    });

    it("should construct JSON array using jsonBuildArray", async () => {
      await db
        .insertInto(schema.Users)
        .values([createTestUser({ username: "coords_user" })]);

      const [row] = await db.from(schema.Users).select(() => ({
        pair: jsonBuildArray(schema.Users.id, schema.Users.username),
      }));

      expect(row.pair).toEqual([expect.any(Number), "coords_user"]);
    });

    it("should strip null keys using jsonStripNulls", async () => {
      await db
        .insertInto(schema.Users)
        .values([createTestUser({ username: "null_email_user", email: null })]);

      const [row] = await db.from(schema.Users).select(() => ({
        cleaned: jsonStripNulls(
          jsonBuildObject({
            id: schema.Users.id,
            username: schema.Users.username,
            email: schema.Users.email,
          }),
        ),
      }));

      expect(row.cleaned).toHaveProperty("id");
      expect(row.cleaned).toHaveProperty("username");
      expect(row.cleaned).not.toHaveProperty("email");
    });

    it("should convert Table reference to JSON and JSONB using toJson(schema.Users) and toJsonb(schema.Users)", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(
          createTestUser({
            username: "table_ref_user",
            email: "tru@example.com",
          }),
        )
        .returning({ id: true });

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          asJson: toJson(schema.Users),
          asJsonb: toJsonb(schema.Users),
        }))
        .where(() => eq(schema.Users.id, user.id));

      expect(row.asJson).toMatchObject({
        username: "table_ref_user",
        email: "tru@example.com",
      });
      expect(row.asJsonb).toMatchObject({
        username: "table_ref_user",
        email: "tru@example.com",
      });
    });

    it("should support plain objects in jsonBuildArray", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "obj_arr_user" }))
        .returning({ id: true });

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          arr: jsonBuildArray({ key: "val" }, schema.Users.username),
        }))
        .where(() => eq(schema.Users.id, user.id));

      expect(row.arr).toEqual([{ key: "val" }, "obj_arr_user"]);
    });
  });

  describe("Auto-GROUP BY with JSON functions and Aggregates", () => {
    it("should automatically group by referenced columns when jsonBuildObject and jsonAgg are mixed", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "author1" }))
        .returning({ id: true });

      const [post] = await db
        .insertInto(schema.Posts)
        .values(createTestPost(user.id, { title: "Auto Group By Post" }))
        .returning({ id: true });

      await db
        .insertInto(schema.Comments)
        .values([createTestComment(post.id, user.id, { body: "Great post!" })]);

      // Query without explicit .groupBy()
      const [row] = await db
        .from(schema.Posts)
        .leftJoin(schema.Users, () => eq(schema.Users.id, schema.Posts.userId))
        .leftJoin(schema.Comments, () =>
          eq(schema.Comments.postId, schema.Posts.id),
        )
        .select(({ users, comments }) => ({
          postId: schema.Posts.id,
          author: jsonBuildObject({
            id: users.id,
            username: users.username,
          }),
          comments: coalesce(
            jsonAgg(
              jsonBuildObject({
                id: comments.id,
                body: comments.body,
              }),
            ).filter(isNotNull(comments.id)),
            [],
          ),
        }));

      expect(row.postId).toBe(post.id);
      expect(row.author).toEqual({
        id: Number(user.id),
        username: "author1",
      });
      expect(row.comments).toHaveLength(1);
      expect(row.comments[0].body).toBe("Great post!");
    });
  });
});
