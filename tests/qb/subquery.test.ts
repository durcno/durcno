import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  add,
  and,
  asc,
  caseWhen,
  coalesce,
  count,
  database,
  defineConfig,
  eq,
  exists,
  gt,
  isIn,
  jsonBuildObject,
  notExists,
  notIn,
  prepare,
  sql,
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

describe("Subquery Functions (exists, notExists, isIn, notIn)", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("subquery");

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

  afterAll(async () => {
    if (client) await client.close();
    if (db) await db.close();
    const migrationsDir = path.resolve(__dirname, migrationsDirName);
    if (fs.existsSync(migrationsDir)) {
      fs.rmSync(migrationsDir, { recursive: true, force: true });
    }
    if (container) await stopPostgresContainer(container);
  });

  beforeEach(async () => {
    await truncateTables(client);
  });

  // ==========================================================================
  // EXISTS / NOT EXISTS tests
  // ==========================================================================
  describe("exists and notExists", () => {
    it("should filter using exists with correlated subquery", async () => {
      const [alice, _bob] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
        ])
        .returning("*");

      await db.insertInto(schema.Posts).values({
        userId: alice.id,
        title: "Alice Post",
        slug: "alice-post",
      });

      const usersWithPosts = await db
        .from(schema.Users)
        .select("*")
        .where(() =>
          exists(
            db
              .from(schema.Posts)
              .select("*")
              .where(() => eq(schema.Posts.userId, schema.Users.id)),
          ),
        );

      expect(usersWithPosts).toHaveLength(1);
      expect(usersWithPosts[0].username).toBe("alice");
    });

    it("should filter using notExists with correlated subquery", async () => {
      const [alice, _bob] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
        ])
        .returning("*");

      await db.insertInto(schema.Posts).values({
        userId: alice.id,
        title: "Alice Post",
        slug: "alice-post",
      });

      const usersWithoutPosts = await db
        .from(schema.Users)
        .select("*")
        .where(() =>
          notExists(
            db
              .from(schema.Posts)
              .select("*")
              .where(() => eq(schema.Posts.userId, schema.Users.id)),
          ),
        );

      expect(usersWithoutPosts).toHaveLength(1);
      expect(usersWithoutPosts[0].username).toBe("bob");
    });

    it("should project boolean in select using exists and notExists", async () => {
      const [alice, _bob] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
        ])
        .returning("*");

      await db.insertInto(schema.Posts).values({
        userId: alice.id,
        title: "Alice Post",
        slug: "alice-post",
      });

      const results = await db
        .from(schema.Users)
        .select(() => ({
          username: schema.Users.username,
          hasPosts: exists(
            db
              .from(schema.Posts)
              .select("*")
              .where(() => eq(schema.Posts.userId, schema.Users.id)),
          ),
          noPosts: notExists(
            db
              .from(schema.Posts)
              .select("*")
              .where(() => eq(schema.Posts.userId, schema.Users.id)),
          ),
        }))
        .orderBy(() => asc(schema.Users.username));

      expect(results).toHaveLength(2);
      expect(results[0].username).toBe("alice");
      expect(results[0].hasPosts).toBe(true);
      expect(results[0].noPosts).toBe(false);

      expect(results[1].username).toBe("bob");
      expect(results[1].hasPosts).toBe(false);
      expect(results[1].noPosts).toBe(true);
    });

    it("should work inside caseWhen conditional expression", async () => {
      const [alice, _bob] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
        ])
        .returning("*");

      await db.insertInto(schema.Posts).values({
        userId: alice.id,
        title: "Alice Post",
        slug: "alice-post",
      });

      const results = await db
        .from(schema.Users)
        .select(() => ({
          username: schema.Users.username,
          postStatus: caseWhen(
            exists(
              db
                .from(schema.Posts)
                .select("*")
                .where(() => eq(schema.Posts.userId, schema.Users.id)),
            ),
            "author",
          ).else("reader"),
        }))
        .orderBy(() => asc(schema.Users.username));

      expect(results).toHaveLength(2);
      expect(results[0].postStatus).toBe("author");
      expect(results[1].postStatus).toBe("reader");
    });
  });

  // ==========================================================================
  // IS IN / NOT IN tests
  // ==========================================================================
  describe("isIn and notIn", () => {
    it("should filter with value array in where", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin" }),
          createTestUser({ username: "bob", type: "user" }),
          createTestUser({ username: "charlie", type: "user" }),
        ]);

      const matchedUsers = await db
        .from(schema.Users)
        .select("*")
        .where(() => isIn(schema.Users.username, ["alice", "bob"]))
        .orderBy(() => asc(schema.Users.username));

      expect(matchedUsers).toHaveLength(2);
      expect(matchedUsers.map((u) => u.username)).toEqual(["alice", "bob"]);
    });

    it("should filter with notIn value array in where", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin" }),
          createTestUser({ username: "bob", type: "user" }),
          createTestUser({ username: "charlie", type: "user" }),
        ]);

      const notAliceBob = await db
        .from(schema.Users)
        .select("*")
        .where(() => notIn(schema.Users.username, ["alice", "bob"]));

      expect(notAliceBob).toHaveLength(1);
      expect(notAliceBob[0].username).toBe("charlie");
    });

    it("should project boolean in select using isIn and notIn", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin" }),
          createTestUser({ username: "bob", type: "user" }),
        ]);

      const results = await db
        .from(schema.Users)
        .select(() => ({
          username: schema.Users.username,
          isAdmin: isIn(schema.Users.type, ["admin"]),
          isNotAdmin: notIn(schema.Users.type, ["admin"]),
        }))
        .orderBy(() => asc(schema.Users.username));

      expect(results).toHaveLength(2);
      expect(results[0].username).toBe("alice");
      expect(results[0].isAdmin).toBe(true);
      expect(results[0].isNotAdmin).toBe(false);

      expect(results[1].username).toBe("bob");
      expect(results[1].isAdmin).toBe(false);
      expect(results[1].isNotAdmin).toBe(true);
    });

    it("should filter with isIn subquery in where", async () => {
      const [alice, _bob] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
        ])
        .returning("*");

      await db.insertInto(schema.Posts).values({
        userId: alice.id,
        title: "Alice Post",
        slug: "alice-post",
      });

      const usersWithPosts = await db
        .from(schema.Users)
        .select("*")
        .where(() =>
          isIn(
            schema.Users.id,
            db
              .from(schema.Posts)
              .select(() => ({ userId: schema.Posts.userId })),
          ),
        );

      expect(usersWithPosts).toHaveLength(1);
      expect(usersWithPosts[0].username).toBe("alice");
    });

    it("should filter with notIn subquery in where", async () => {
      const [alice, _bob] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
        ])
        .returning("*");

      await db.insertInto(schema.Posts).values({
        userId: alice.id,
        title: "Alice Post",
        slug: "alice-post",
      });

      const usersWithoutPosts = await db
        .from(schema.Users)
        .select("*")
        .where(() =>
          notIn(
            schema.Users.id,
            db
              .from(schema.Posts)
              .select(() => ({ userId: schema.Posts.userId })),
          ),
        );

      expect(usersWithoutPosts).toHaveLength(1);
      expect(usersWithoutPosts[0].username).toBe("bob");
    });

    it("should handle empty arrays correctly", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
        ]);

      // isIn with empty array produces FALSE -> 0 rows
      const inEmpty = await db
        .from(schema.Users)
        .select("*")
        .where(() => isIn(schema.Users.id, []));
      expect(inEmpty).toHaveLength(0);

      // notIn with empty array produces TRUE -> all rows
      const notInEmpty = await db
        .from(schema.Users)
        .select("*")
        .where(() => notIn(schema.Users.id, []));
      expect(notInEmpty).toHaveLength(2);
    });

    it("should combine exists and isIn in compound conditions", async () => {
      const [alice, bob] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin" }),
          createTestUser({ username: "bob", type: "user" }),
        ])
        .returning("*");

      await db.insertInto(schema.Posts).values([
        {
          userId: alice.id,
          title: "Alice Post",
          slug: "alice-post",
        },
        {
          userId: bob.id,
          title: "Bob Post",
          slug: "bob-post",
        },
      ]);

      const adminWithPosts = await db
        .from(schema.Users)
        .select("*")
        .where(() =>
          and(
            isIn(schema.Users.type, ["admin"]),
            exists(
              db
                .from(schema.Posts)
                .select("*")
                .where(() => eq(schema.Posts.userId, schema.Users.id)),
            ),
          ),
        );

      expect(adminWithPosts).toHaveLength(1);
      expect(adminWithPosts[0].username).toBe("alice");
    });

    it("should work with raw sql in isIn", async () => {
      const [alice] = await db
        .insertInto(schema.Users)
        .values([createTestUser({ username: "alice" })])
        .returning("*");

      await db.insertInto(schema.Posts).values({
        userId: alice.id,
        title: "Alice Post",
        slug: "alice-post",
      });

      const users = await db
        .from(schema.Users)
        .select("*")
        .where(() => isIn(schema.Users.id, sql`SELECT user_id FROM posts`));

      expect(users).toHaveLength(1);
      expect(users[0].username).toBe("alice");
    });
  });

  describe("Advanced subquery features (GROUP BY, CTEs, prepared)", () => {
    it("should automatically group by referencedColumns when isIn is mixed with aggregate", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "grp-a", status: "active" }),
          createTestUser({ username: "grp-b", status: "active" }),
          createTestUser({ username: "grp-c", status: "inactive" }),
        ]);

      const rows = await db
        .from(schema.Users)
        .select(() => ({
          status: schema.Users.status,
          isInList: isIn(schema.Users.status, ["active", "pending"]),
          userCount: count("*"),
        }))
        .orderBy(() => asc(schema.Users.status));

      expect(rows).toEqual([
        { status: "active", isInList: true, userCount: 2 },
        { status: "inactive", isInList: false, userCount: 1 },
      ]);
    });

    it("should exclude exists subquery from auto GROUP BY clause", async () => {
      const [alice, bob] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice-posts" }),
          createTestUser({ username: "bob-no-posts" }),
        ])
        .returning("*");

      await db.insertInto(schema.Posts).values({
        userId: alice.id,
        title: "Alice Post",
        slug: "alice-post",
      });

      const rows = await db
        .from(schema.Users)
        .select(() => ({
          userId: schema.Users.id,
          hasPosts: exists(
            db
              .from(schema.Posts)
              .select("*")
              .where(() => eq(schema.Posts.userId, schema.Users.id)),
          ),
          total: count("*"),
        }))
        .orderBy(() => asc(schema.Users.id));

      expect(rows).toEqual([
        { userId: alice.id, hasPosts: true, total: 1 },
        { userId: bob.id, hasPosts: false, total: 1 },
      ]);
    });

    it("should preserve WITH clause when CTE-backed subquery is passed to exists()", async () => {
      const [alice, bob] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "cte-alice", status: "active" }),
          createTestUser({ username: "cte-bob", status: "inactive" }),
        ])
        .returning("*");

      await db.insertInto(schema.Posts).values([
        { userId: alice.id, title: "Alice CTE Post", slug: "alice-cte-post" },
        { userId: bob.id, title: "Bob CTE Post", slug: "bob-cte-post" },
      ]);

      const activeUserCte = db.with("activeUserCte").as(
        db
          .from(schema.Users)
          .select(() => ({ id: schema.Users.id }))
          .where(() => eq(schema.Users.status, "active")),
      );

      const postsOfActiveUsers = await db
        .from(schema.Posts)
        .select(() => ({ title: schema.Posts.title }))
        .where(() =>
          exists(
            db
              .with(activeUserCte)
              .from(activeUserCte)
              .select("*")
              .where(() => eq(activeUserCte.id, schema.Posts.userId)),
          ),
        );

      expect(postsOfActiveUsers).toHaveLength(1);
      expect(postsOfActiveUsers[0].title).toBe("Alice CTE Post");
    });

    it("should preserve WITH clause when CTE-backed subquery is passed to isIn()", async () => {
      const [alice, bob] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "cte-in-alice", status: "active" }),
          createTestUser({ username: "cte-in-bob", status: "inactive" }),
        ])
        .returning("*");

      await db.insertInto(schema.Posts).values([
        { userId: alice.id, title: "Alice IN Post", slug: "alice-in-post" },
        { userId: bob.id, title: "Bob IN Post", slug: "bob-in-post" },
      ]);

      const activeUserCte = db.with("activeUserCte").as(
        db
          .from(schema.Users)
          .select(() => ({ id: schema.Users.id }))
          .where(() => eq(schema.Users.status, "active")),
      );

      const postsOfActiveUsers = await db
        .from(schema.Posts)
        .select(() => ({ title: schema.Posts.title }))
        .where(() =>
          isIn(
            schema.Posts.userId,
            db
              .with(activeUserCte)
              .from(activeUserCte)
              .select(() => ({ id: activeUserCte.id })),
          ),
        );

      expect(postsOfActiveUsers).toHaveLength(1);
      expect(postsOfActiveUsers[0].title).toBe("Alice IN Post");
    });

    it("should work with prepared statements using isIn with array of Arg", async () => {
      const [u1, _u2, u3] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "prep-1" }),
          createTestUser({ username: "prep-2" }),
          createTestUser({ username: "prep-3" }),
        ])
        .returning("*");

      const selectPre = prepare(
        { id1: schema.Users.id.arg(), id2: schema.Users.id.arg() },
        (args) =>
          db
            .prepare()
            .from(schema.Users)
            .select(() => ({
              id: schema.Users.id,
              username: schema.Users.username,
            }))
            .where(() => isIn(schema.Users.id, [args.id1, args.id2]))
            .orderBy(() => asc(schema.Users.id)),
      );

      const rows = await selectPre.run(db, { id1: u1.id, id2: u3.id });
      expect(rows).toHaveLength(2);
      expect(rows.map((r) => r.username)).toEqual(["prep-1", "prep-3"]);
    });
  });
  // ==========================================================================
  // Scalar subqueries
  // ==========================================================================
  describe("scalar subqueries", () => {
    it("should project correlated aggregate and row subqueries", async () => {
      const [alice, bob] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "scalar-alice" }),
          createTestUser({ username: "scalar-bob" }),
        ])
        .returning("*");

      await db.insertInto(schema.Posts).values([
        { userId: alice.id, title: "First", slug: "scalar-first" },
        { userId: alice.id, title: "Second", slug: "scalar-second" },
      ]);

      const rows = await db
        .from(schema.Users)
        .select(() => ({
          id: schema.Users.id,
          postCount: db
            .from(schema.Posts)
            .select(() => ({ total: count("*") }))
            .where(() => eq(schema.Posts.userId, schema.Users.id)),
          firstTitle: db
            .from(schema.Posts)
            .select(() => ({ title: schema.Posts.title }))
            .where(() => eq(schema.Posts.userId, schema.Users.id))
            .orderBy(() => asc(schema.Posts.id))
            .limit(1),
        }))
        .orderBy(() => asc(schema.Users.id));

      const aliceRow = rows.find((row) => row.id === alice.id);
      const bobRow = rows.find((row) => row.id === bob.id);

      expect(aliceRow?.postCount).toBe(2);
      expect(aliceRow?.firstTitle).toBe("First");
      expect(bobRow?.postCount).toBe(0);
      expect(bobRow?.firstTitle).toBeNull();
    });

    it("should convert bigint, Date and JSON scalar subqueries", async () => {
      const [alice] = await db
        .insertInto(schema.Users)
        .values(
          createTestUser({
            username: "scalar-types",
            meta: { views: 3, likes: 5 },
          }),
        )
        .returning("*");

      const [post] = await db
        .insertInto(schema.Posts)
        .values({
          userId: alice.id,
          title: "Typed",
          slug: "scalar-typed",
        })
        .returning("*");

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          postId: db
            .from(schema.Posts)
            .select(() => ({ id: schema.Posts.id }))
            .where(() => eq(schema.Posts.userId, schema.Users.id))
            .limit(1),
          postCreatedAt: db
            .from(schema.Posts)
            .select(() => ({ createdAt: schema.Posts.createdAt }))
            .where(() => eq(schema.Posts.userId, schema.Users.id))
            .limit(1),
          meta: db
            .from(schema.Users)
            .select(() => ({ meta: schema.Users.meta }))
            .where(() => eq(schema.Users.id, alice.id))
            .limit(1),
        }))
        .where(() => eq(schema.Users.id, alice.id));

      expect(row.postId).toBe(post.id);
      expect(typeof row.postId).toBe("bigint");
      expect(row.postCreatedAt).toBeInstanceOf(Date);
      expect(row.meta).toEqual({ views: 3, likes: 5 });
    });

    it("should assign a scalar subquery in .set()", async () => {
      const [alice] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "scalar-set" }))
        .returning("*");

      await db.insertInto(schema.Posts).values({
        userId: alice.id,
        title: "Assigned",
        slug: "scalar-assigned",
        viewCount: 7,
      });

      const [updated] = await db
        .update(schema.Users)
        .set({
          bio: db
            .from(schema.Posts)
            .select(() => ({ title: schema.Posts.title }))
            .where(() => eq(schema.Posts.userId, schema.Users.id))
            .orderBy(() => asc(schema.Posts.id))
            .limit(1),
          score: coalesce(
            db
              .from(schema.Posts)
              .select(() => ({ total: count("*") }))
              .where(() => eq(schema.Posts.userId, schema.Users.id)),
            0,
          ),
        })
        .where(eq(schema.Users.username, "scalar-set"))
        .returning("*");

      expect(updated.bio).toBe("Assigned");
      expect(updated.score).toBe(1);
    });

    it("should compose scalar subqueries in arithmetic, case and comparisons", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "scalar-compose-a", score: 10 }),
          createTestUser({ username: "scalar-compose-b", score: 3 }),
        ])
        .returning("*");

      const rows = await db
        .from(schema.Users)
        .select(() => ({
          username: schema.Users.username,
          bumped: add(
            db
              .from(schema.Users)
              .select(() => ({ score: schema.Users.score }))
              .where(() => eq(schema.Users.username, "scalar-compose-b"))
              .limit(1),
            5,
          ),
          label: caseWhen(
            eq(schema.Users.username, "scalar-compose-a"),
            db
              .from(schema.Users)
              .select(() => ({ username: schema.Users.username }))
              .where(() => eq(schema.Users.username, "scalar-compose-b"))
              .limit(1),
          ).else("other"),
        }))
        .where(() =>
          gt(
            schema.Users.score,
            db
              .from(schema.Users)
              .select(() => ({ score: schema.Users.score }))
              .where(() => eq(schema.Users.username, "scalar-compose-b"))
              .limit(1),
          ),
        );

      expect(rows).toHaveLength(1);
      expect(rows[0].username).toBe("scalar-compose-a");
      expect(rows[0].bumped).toBe(8);
      expect(rows[0].label).toBe("scalar-compose-b");
    });

    it("should bind prepared arguments inside a scalar subquery", async () => {
      const [alice] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "scalar-prepared" }))
        .returning("*");

      await db.insertInto(schema.Posts).values({
        userId: alice.id,
        title: "Prepared Post",
        slug: "scalar-prepared-post",
      });

      const prepared = prepare({ title: schema.Posts.title.arg() }, (args) =>
        db
          .prepare()
          .from(schema.Users)
          .select(() => ({
            id: schema.Users.id,
            matched: db
              .prepare()
              .from(schema.Posts)
              .select(() => ({ id: schema.Posts.id }))
              .where(() => eq(schema.Posts.title, args.title))
              .limit(1),
          })),
      );

      const rows = await prepared.run(db, { title: "Prepared Post" });
      expect(rows).toHaveLength(1);
      expect(rows[0].matched).not.toBeNull();
    });

    it("should support raw Sql scalar subqueries", async () => {
      await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "scalar-raw" }));

      const [row] = await db.from(schema.Users).select(() => ({
        value: sql<number>`(SELECT 42)`,
      }));

      expect(row.value).toBe(42);
    });

    it("should support scalar queries in JSON builders, ORDER BY and INSERT", async () => {
      const [alice] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "scalar-extra" }))
        .returning("*");

      await db.insertInto(schema.Posts).values({
        userId: alice.id,
        title: "Extra",
        slug: "scalar-extra-post",
      });

      const [row] = await db
        .from(schema.Users)
        .select(() => ({
          username: schema.Users.username,
          payload: jsonBuildObject({
            postTotal: db
              .from(schema.Posts)
              .select(() => ({ total: count("*") })),
          }),
        }))
        .orderBy(() =>
          asc(
            db
              .from(schema.Posts)
              .select(() => ({ id: schema.Posts.id }))
              .limit(1),
          ),
        );

      expect(row.payload).toEqual({ postTotal: 1 });

      await db.insertInto(schema.Products).values({
        sku: "scalar-insert-sku",
        name: "Scalar Insert",
        description: db
          .from(schema.Posts)
          .select(() => ({ title: schema.Posts.title }))
          .limit(1),
        price: coalesce(
          db
            .from(schema.Posts)
            .select(() => ({ id: schema.Posts.id }))
            .limit(1),
          0n,
        ),
        createdDate: new Date("2026-01-01"),
      });

      const [product] = await db
        .from(schema.Products)
        .select("*")
        .where(() => eq(schema.Products.sku, "scalar-insert-sku"));

      expect(product.price).toBe(1n);
      expect(product.description).toBe("Extra");
    });
    it("should reject a multi-column scalar query at build time", () => {
      expect(() =>
        db.from(schema.Users).select(() => ({
          bad: db.from(schema.Users).select(() => ({
            id: schema.Users.id,
            username: schema.Users.username,
          })) as never,
        })),
      ).toThrow(/exactly one column/);
    });

    it("should exclude scalar subqueries from automatic GROUP BY", async () => {
      const [groupA] = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "group-a", type: "admin" }),
          createTestUser({ username: "group-b", type: "user" }),
        ])
        .returning("*");

      await db.insertInto(schema.Posts).values({
        userId: groupA.id,
        title: "Grouped",
        slug: "scalar-grouped",
      });

      const rows = await db
        .from(schema.Users)
        .select(() => ({
          type: schema.Users.type,
          total: count("*"),
          postTotal: db
            .from(schema.Posts)
            .select(() => ({ total: count("*") })),
        }))
        .orderBy(() => asc(schema.Users.type));

      expect(rows).toHaveLength(2);
      expect(rows[0].postTotal).toBe(1);
    });
  });
});
