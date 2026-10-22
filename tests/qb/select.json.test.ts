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
  desc,
  eq,
  isNotNull,
  isNull,
  jsonAgg,
  jsonBuildArray,
  jsonBuildObject,
  jsonbAgg,
  jsonbBuildArray,
  jsonbBuildObject,
  jsonbStripNulls,
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
      const [user] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", email: "alice@example.com" }),
        ])
        .returning({ id: true });

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
        id: user.id,
        username: "alice",
        email: "alice@example.com",
      });
      expect(row.userObjB).toEqual({
        name: "alice",
        staticKey: "durcno",
      });
    });

    it("should restore the column types of the JSON values", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(
          createTestUser({
            username: "json_types_user",
            points: 42n,
            score: 7,
          }),
        )
        .returning({ id: true });

      const [row] = await db.from(schema.Users).select(() => ({
        userObj: jsonBuildObject({
          id: schema.Users.id,
          points: schema.Users.points,
          score: schema.Users.score,
          createdAt: schema.Users.createdAt,
          type: schema.Users.type,
        }),
        pair: jsonBuildArray(schema.Users.id, schema.Users.score),
      }));

      // A `bigint` stays a `bigint`, a timestamp stays a `Date`.
      expect(row.userObj.id).toBe(user.id);
      expect(row.userObj.points).toBe(42n);
      expect(row.userObj.score).toBe(7);
      expect(row.userObj.createdAt).toBeInstanceOf(Date);
      expect(row.userObj.type).toBe("user");
      expect(row.pair).toEqual([user.id, 7]);
    });

    it("should restore literal operands to their declared type", async () => {
      await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "literal_operand_user" }));

      const [row] = await db.from(schema.Users).select(() => ({
        literal: jsonBuildObject({
          at: new Date("2024-01-01T00:00:00.000Z"),
          count: 5n,
        }),
      }));

      expect(row.literal.at).toBeInstanceOf(Date);
      expect((row.literal.at as Date).toISOString()).toBe(
        "2024-01-01T00:00:00.000Z",
      );
      expect(row.literal.count).toBe(5n);
    });

    it("should restore nested record literals", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "nested_record_user" }))
        .returning({ id: true });

      const at = new Date("2024-01-01T00:00:00.000Z");
      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          obj: jsonBuildObject({
            nested: { count: 5n, at },
            items: [{ count: 7n }],
          }),
          picked: toJson({ nested: { count: 11n, at } }),
        }))
        .where(() => eq(schema.Users.id, user.id));

      const [aggRow] = await db
        .from(schema.Users)
        .select(() => ({ agg: jsonAgg({ count: 9n }) }))
        .where(() => eq(schema.Users.id, user.id));

      expect(row.obj.nested.count).toBe(5n);
      expect(row.obj.nested.at).toBeInstanceOf(Date);
      expect(row.obj.items).toEqual([{ count: 7n }]);
      expect(aggRow.agg).toEqual([{ count: 9n }]);
      expect(row.picked.nested.count).toBe(11n);
      expect(row.picked.nested.at).toBeInstanceOf(Date);
    });

    it("should keep a JSON column string as a string", async () => {
      await db.insertInto(schema.Users).values(
        createTestUser({
          username: "json_string_column_user",
          meta: "123",
        }),
      );

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          obj: jsonBuildObject({ meta: schema.Users.meta }),
          objb: jsonbBuildObject({ meta: schema.Users.meta }),
          asJson: toJson(schema.Users.meta),
          asJsonb: toJsonb(schema.Users.meta),
        }))
        .limit(1);

      // The value is decoded from the outer document, not raw driver text.
      expect(row.obj.meta).toBe("123");
      expect(row.objb.meta).toBe("123");
      expect(row.asJson).toBe("123");
      expect(row.asJsonb).toBe("123");
    });

    it("should encode array literals as JSON arrays", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "array_literal_user" }))
        .returning({ id: true });

      const at = new Date("2024-01-01T00:00:00.000Z");
      const fields = {
        tags: [] as string[],
        mixed: ["a", 1],
        counts: [1n, 2n],
        at: [at],
      };

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          obj: jsonBuildObject(fields),
          objb: jsonbBuildObject(fields),
          arr: jsonBuildArray([], ["a", 1], [1n, 2n], [at]),
          arrb: jsonbBuildArray([], ["a", 1], [1n, 2n], [at]),
        }))
        .where(() => eq(schema.Users.id, user.id));

      const expected = {
        tags: [],
        mixed: ["a", 1],
        counts: [1n, 2n],
        at: [at],
      };
      expect(row.obj).toEqual(expected);
      expect(row.objb).toEqual(expected);
      expect(row.arr).toEqual([[], ["a", 1], [1n, 2n], [at]]);
      expect(row.arrb).toEqual([[], ["a", 1], [1n, 2n], [at]]);
    });

    it("should support nested jsonBuildObject calls", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values([createTestUser({ username: "bob", email: "bob@example.com" })])
        .returning({ id: true });

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
        id: user.id,
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
        .leftJoin(schema.Users)
        .on(() => eq(schema.Users.id, schema.Posts.userId))
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
        id: user.id,
        username: "author",
      });

      // Left join where join condition does not match (author should be null)
      const [postWithoutAuthor] = await db
        .from(schema.Posts)
        .leftJoin(schema.Users)
        .on(() => eq(schema.Users.id, 999999n))
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

    it("should order aggregated rows by more than one key", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "author" }))
        .returning({ id: true });
      const [post] = await db
        .insertInto(schema.Posts)
        .values(createTestPost(user.id, { title: "Post" }))
        .returning({ id: true });

      // All three share a post, so the first key ties and the second decides.
      await db
        .insertInto(schema.Comments)
        .values([
          createTestComment(post.id, user.id, { body: "first" }),
          createTestComment(post.id, user.id, { body: "second" }),
          createTestComment(post.id, user.id, { body: "third" }),
        ]);

      const [row] = await db.from(schema.Comments).select(() => ({
        bodies: jsonAgg(schema.Comments.body).orderBy(
          asc(schema.Comments.postId),
          desc(schema.Comments.id),
        ),
      }));

      expect(row.bodies).toEqual(["third", "second", "first"]);
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

    it("should encode array operands as JSON arrays", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "array_agg_user" }))
        .returning({ id: true });

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          counts: jsonAgg([1n, 2n]),
          countsB: jsonbAgg([1n, 2n]),
          tags: jsonbAgg([] as string[]),
        }))
        .where(() => eq(schema.Users.id, user.id));

      expect(row.counts).toEqual([[1n, 2n]]);
      expect(row.countsB).toEqual([[1n, 2n]]);
      expect(row.tags).toEqual([[]]);
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
        .leftJoin(schema.Comments)
        .on(() => eq(schema.Comments.postId, schema.Posts.id))
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
        .leftJoin(schema.Comments)
        .on(() => eq(schema.Comments.postId, schema.Posts.id))
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
          createTestUser({
            username: "json_user",
            email: "ju@example.com",
            meta: "123",
          }),
        )
        .returning({ id: true });

      const [row] = await db.from(schema.Users).select(() => ({
        fullUser: toJson(schema.Users),
      }));

      expect(row.fullUser).toMatchObject({
        username: "json_user",
        email: "ju@example.com",
      });
      // The row is read back through the columns that produced it.
      expect(row.fullUser.id).toBe(user.id);
      expect(row.fullUser.createdAt).toBeInstanceOf(Date);
      // A JSON column keeps its own JSON string value.
      expect(row.fullUser.meta).toBe("123");
    });

    it("should convert a record of columns to a JSON object using toJson", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "record_user" }))
        .returning({ id: true });

      const [row] = await db.from(schema.Users).select(() => ({
        picked: toJson({
          id: schema.Users.id,
          username: schema.Users.username,
        }),
      }));

      expect(row.picked).toEqual({
        id: user.id,
        username: "record_user",
      });
    });

    it("should read a record of columns by its own keys", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "aliased_record_user" }))
        .returning({ id: true });

      const [row] = await db.from(schema.Users).select(() => ({
        picked: toJson({
          userId: schema.Users.id,
          label: schema.Users.username,
        }),
      }));

      expect(row.picked).toEqual({
        userId: user.id,
        label: "aliased_record_user",
      });
    });

    it("should convert a plain object target without throwing", async () => {
      await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "plain_target_user" }));

      const [row] = await db.from(schema.Users).select(() => ({
        picked: toJson({ a: null, b: 1 }),
      }));

      expect(row.picked).toEqual({ a: null, b: 1 });
    });

    it("should restore a __proto__ key as an own property", async () => {
      await db.insertInto(schema.Users).values(
        createTestUser({
          username: "proto_key_user",
          email: "proto@example.com",
        }),
      );

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          obj: jsonBuildObject({ ["__proto__"]: schema.Users.email }),
          picked: toJson({ ["__proto__"]: { polluted: true } }),
        }))
        .limit(1);

      const protoKey = "__proto__";
      expect(Object.hasOwn(row.obj as object, protoKey)).toBe(true);
      expect(Object.getOwnPropertyDescriptor(row.obj, protoKey)?.value).toBe(
        "proto@example.com",
      );
      expect(Object.getPrototypeOf(row.obj)).toBe(Object.prototype);
      expect(Object.hasOwn(row.picked as object, protoKey)).toBe(true);
      expect(
        Object.getOwnPropertyDescriptor(row.picked, protoKey)?.value,
      ).toEqual({
        polluted: true,
      });
      expect(Object.getPrototypeOf(row.picked)).toBe(Object.prototype);
    });

    it("should encode array entries of a toJson record as JSON arrays", async () => {
      await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "tojson_array_user" }));

      const at = new Date("2024-01-01T00:00:00.000Z");
      const record = {
        tags: [] as string[],
        mixed: ["a", 1],
        counts: [1n, 2n],
        at: [at],
      };
      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          asJson: toJson(record),
          asJsonb: toJsonb(record),
        }))
        .limit(1);

      expect(row.asJson).toEqual(record);
      expect(row.asJsonb).toEqual(record);
    });

    it("should convert scalar string, null, and array targets to JSON", async () => {
      await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "scalar_target_user" }));

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          text: toJson("hello"),
          numericText: toJson("123"),
          nullish: toJson(null),
          empty: toJson([] as string[]),
          mixed: toJson(["a", 1]),
          bad: toJson(new Date(Number.NaN)),
          textB: toJsonb("hello"),
          boolTextB: toJsonb("true"),
          nullishB: toJsonb(null),
          emptyB: toJsonb([] as string[]),
          mixedB: toJsonb(["a", 1]),
          badB: toJsonb(new Date(Number.NaN)),
        }))
        .limit(1);

      expect(row.text).toBe("hello");
      expect(row.numericText).toBe("123");
      expect(row.nullish).toBeNull();
      expect(row.empty).toEqual([]);
      expect(row.mixed).toEqual(["a", 1]);
      expect(row.bad).toBeNull();
      expect(row.textB).toBe("hello");
      expect(row.boolTextB).toBe("true");
      expect(row.nullishB).toBeNull();
      expect(row.emptyB).toEqual([]);
      expect(row.mixedB).toEqual(["a", 1]);
      expect(row.badB).toBeNull();
    });

    it("should restore literal and nested entries of a toJson record", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "tojson_literal_user" }))
        .returning({ id: true });

      const at = new Date("2024-01-01T00:00:00.000Z");
      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          card: toJson({
            at,
            count: 5n,
            nested: jsonBuildObject({ id: schema.Users.id }),
          }),
        }))
        .where(() => eq(schema.Users.id, user.id));

      expect(row.card.at).toBeInstanceOf(Date);
      expect(row.card.at.toISOString()).toBe(at.toISOString());
      expect(row.card.count).toBe(5n);
      expect(row.card.nested).toEqual({ id: user.id });
    });

    it("should restore the column type of a single column converted to JSON", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "single_column_user" }))
        .returning({ id: true });

      const [row] = await db.from(schema.Users).select(() => ({
        id: toJson(schema.Users.id),
      }));

      expect(row.id).toBe(user.id);
    });

    it("should construct JSON array using jsonBuildArray", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values([createTestUser({ username: "coords_user" })])
        .returning({ id: true });

      const [row] = await db.from(schema.Users).select(() => ({
        pair: jsonBuildArray(schema.Users.id, schema.Users.username),
      }));

      expect(row.pair).toEqual([user.id, "coords_user"]);
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

    it("should encode an array operand as a JSON array", async () => {
      await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "stripped_array_user" }));

      const [row] = await db.from(schema.Users).select(() => ({
        values: jsonStripNulls([1n, 2n]),
        valuesB: jsonbStripNulls([1n, 2n]),
      }));

      expect(row.values).toEqual([1n, 2n]);
      expect(row.valuesB).toEqual([1n, 2n]);
    });

    it("should not read a stripped key that shadows an Object.prototype member", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "prototype_key_user", email: null }),
        ]);

      const [row] = await db.from(schema.Users).select(() => ({
        cleaned: jsonStripNulls(
          jsonBuildObject({
            constructor: schema.Users.email,
          }),
        ),
      }));

      expect(Object.keys(row.cleaned as object)).toEqual([]);
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

    it("should convert a JSON function target to JSON", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "fn_target_user" }))
        .returning({ id: true });

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          asJson: toJson(jsonBuildObject({ id: schema.Users.id })),
          asJsonb: toJsonb(jsonBuildObject({ id: schema.Users.id })),
        }))
        .where(() => eq(schema.Users.id, user.id));

      expect(row.asJson).toEqual({ id: user.id });
      expect(row.asJsonb).toEqual({ id: user.id });
    });

    it("should convert a Date target to JSON", async () => {
      await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "date_target_user" }));

      const at = new Date("2024-01-01T00:00:00.000Z");
      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          asJson: toJson(at),
          asJsonb: toJsonb(at),
        }))
        .limit(1);

      expect(row.asJson).toEqual(at);
      expect(row.asJsonb).toEqual(at);
      expect(row.asJson).toBeInstanceOf(Date);
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
        .leftJoin(schema.Users)
        .on(() => eq(schema.Users.id, schema.Posts.userId))
        .leftJoin(schema.Comments)
        .on(() => eq(schema.Comments.postId, schema.Posts.id))
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
        id: user.id,
        username: "author1",
      });
      expect(row.comments).toHaveLength(1);
      expect(row.comments[0].body).toBe("Great post!");
    });
  });

  describe("JSON SQL literals", () => {
    it("should serialize bigint and Date values in toSQLValue", () => {
      expect(jsonBuildObject({ count: 5n }).toSQLValue({ count: 5n })).toBe(
        `'{"count":5}'::json`,
      );
      expect(jsonbBuildObject({ count: 5n }).toSQLValue({ count: 5n })).toBe(
        `'{"count":5}'::jsonb`,
      );
      expect(jsonBuildArray(1n, 2n).toSQLValue([1n, 2n])).toBe(`'[1,2]'::json`);
      expect(jsonbBuildArray(1n, 2n).toSQLValue([1n, 2n])).toBe(
        `'[1,2]'::jsonb`,
      );
      expect(toJson(5n).toSQLValue(5n)).toBe(`'5'::json`);
      expect(
        toJsonb(new Date("2024-01-01T00:00:00.000Z")).toSQLValue(
          new Date("2024-01-01T00:00:00.000Z"),
        ),
      ).toBe(`'"2024-01-01T00:00:00.000Z"'::jsonb`);
    });
  });
});
