import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  add,
  coalesce,
  concat,
  database,
  defineConfig,
  eq,
  gt,
  lower,
  sql,
  upper,
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

describe("INSERT queries", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("insert");

  beforeAll(async () => {
    containerInfo = await startPostgresContainer({
      image: "postgres:17-alpine",
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

  it("should insert a single row", async () => {
    await db.insertInto(schema.Users).values({
      username: "newuser",
      email: "new@example.com",
      type: "user",
      status: "active",
      role: "user",
    });

    const users = await db.from(schema.Users).select("*");
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe("newuser");
    expect(users[0].email).toBe("new@example.com");
  });

  it("should insert multiple rows", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "user1" }),
        createTestUser({ username: "user2" }),
        createTestUser({ username: "user3" }),
      ]);

    const users = await db.from(schema.Users).select("*");
    expect(users).toHaveLength(3);
  });

  it("should insert with default values", async () => {
    await db.insertInto(schema.Users).values({
      username: "defaultuser",
      type: "user",
      status: "active",
      role: "user",
    });

    const users = await db.from(schema.Users).select("*");
    expect(users[0].score).toBe(0);
    expect(users[0].balance).toBe(0n);
    expect(users[0].isActive).toBe(false);
  });

  it("should insert with RETURNING clause", async () => {
    const result = await db
      .insertInto(schema.Users)
      .values({
        username: "returnuser",
        email: "return@example.com",
        type: "admin",
        status: "active",
        role: "admin",
      })
      .returning({ id: true, username: true });

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("id");
    expect(result[0].username).toBe("returnuser");
    expect(result[0]).not.toHaveProperty("email");
  });

  it("should insert with null values", async () => {
    await db.insertInto(schema.Users).values({
      username: "nulluser",
      // email: null, // TODO: null values not supported
      // bio: null, // TODO: null values not supported
      type: "user",
      status: "active",
      role: "user",
    });

    const users = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.username, "nulluser"));

    expect(users[0].email).toBeNull();
    expect(users[0].bio).toBeNull();
  });

  it("should insert with foreign key reference", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await db.insertInto(schema.Posts).values({
      userId: user.id,
      title: "Test Post",
      content: "Test Content",
    });

    const posts = await db.from(schema.Posts).select("*");
    expect(posts).toHaveLength(1);
    expect(posts[0].userId).toEqual(user.id);
  });

  it("should insert with all column types", async () => {
    const testDate = new Date("2024-01-15");

    await db.insertInto(schema.Users).values({
      username: "fulluser",
      email: "full@example.com",
      bio: "A comprehensive bio",
      description: "A detailed description",
      age: 30,
      score: 100,
      points: 5000n,
      balance: 10000n,
      isActive: true,
      isVerified: false,
      birthDate: testDate,
      type: "admin",
      status: "active",
      role: "moderator",
    });

    const users = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.username, "fulluser"));

    expect(users[0]).toMatchObject({
      username: "fulluser",
      email: "full@example.com",
      bio: "A comprehensive bio",
      age: 30,
      score: 100,
      isActive: true,
      isVerified: false,
      type: "admin",
      status: "active",
      role: "moderator",
    });
    expect(users[0].points).toBe(5000n);
    expect(users[0].balance).toBe(10000n);
  });

  it("should auto-generate primary key", async () => {
    const [result1] = await db
      .insertInto(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    const [result2] = await db
      .insertInto(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();
    expect(result2.id).toBeGreaterThan(result1.id);
  });

  it("should insert and return all fields with RETURNING *", async () => {
    const result = await db
      .insertInto(schema.Users)
      .values({
        username: "fullreturn",
        email: "fullreturn@example.com",
        type: "user",
        status: "active",
        role: "user",
      })
      .returning({ id: true, username: true, createdAt: true });

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("username");
    expect(result[0]).toHaveProperty("createdAt");
  });

  it("should auto-generate values using insertFn when column is not provided", async () => {
    const beforeInsert = new Date();

    const result = await db
      .insertInto(schema.AuditLogs)
      .values({
        action: "test_action",
        message: "Test message",
        modifiedAt: new Date(), // modifiedAt is required, updateFn only works on updates
      })
      .returning({ id: true, action: true, createdAt: true });

    const afterInsert = new Date();

    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("test_action");
    expect(result[0].createdAt).toBeInstanceOf(Date);
    // createdAt should be auto-generated by insertFn
    expect(result[0].createdAt.getTime()).toBeGreaterThanOrEqual(
      beforeInsert.getTime(),
    );
    expect(result[0].createdAt.getTime()).toBeLessThanOrEqual(
      afterInsert.getTime(),
    );
  });

  it("should resolve an omitted insertFn value per row of the batch", async () => {
    const beforeInsert = new Date();

    const result = await db
      .insertInto(schema.AuditLogs)
      .values([
        { action: "batch_1", modifiedAt: new Date() },
        { action: "batch_2", modifiedAt: new Date() },
        { action: "batch_3", modifiedAt: new Date() },
      ])
      .returning({ action: true, createdAt: true, publicId: true });

    const afterInsert = new Date();

    expect(result).toHaveLength(3);
    // Every row that omitted the column got its own generated value.
    expect(new Set(result.map((row) => row.publicId)).size).toBe(3);
    for (const row of result) {
      expect(row.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeInsert.getTime(),
      );
      expect(row.createdAt.getTime()).toBeLessThanOrEqual(
        afterInsert.getTime(),
      );
    }
  });

  it("should not repeat an insertFn value that a unique column constrains", async () => {
    // A batch-wide value function would emit one UUID for the whole statement
    // and the unique constraint would reject the second row.
    const result = await db
      .insertInto(schema.AuditLogs)
      .values([
        { action: "unique_1", modifiedAt: new Date() },
        { action: "unique_2", modifiedAt: new Date() },
        { action: "unique_3", modifiedAt: new Date() },
      ])
      .returning({ action: true, publicId: true });

    expect(result).toHaveLength(3);
    expect(new Set(result.map((row) => row.publicId)).size).toBe(3);
  });

  it("should keep a supplied insertFn value per row in a mixed batch", async () => {
    const explicitDate = new Date("2020-01-01T00:00:00.000Z");

    const result = await db
      .insertInto(schema.AuditLogs)
      .values([
        {
          action: "mixed_supplied",
          createdAt: explicitDate,
          modifiedAt: new Date(),
        },
        { action: "mixed_omitted_1", modifiedAt: new Date() },
        { action: "mixed_omitted_2", modifiedAt: new Date() },
      ])
      .returning({ action: true, createdAt: true, publicId: true });

    expect(result).toHaveLength(3);
    expect(result[0].createdAt.getTime()).toBe(explicitDate.getTime());
    expect(result[1].createdAt.getTime()).not.toBe(explicitDate.getTime());
    expect(result[2].createdAt.getTime()).not.toBe(explicitDate.getTime());
    // Only the rows that omitted the column ran the value function.
    expect(new Set(result.map((row) => row.publicId)).size).toBe(3);
  });

  it("should place each row's values in the right columns when others are omitted", async () => {
    const rows = await db
      .insertInto(schema.Users)
      .values([
        {
          username: "partial_email",
          type: "user",
          status: "active",
          role: "user",
          email: "partial@example.com",
        },
        {
          username: "partial_bio",
          type: "user",
          status: "active",
          role: "user",
          bio: "only a bio",
          score: 7,
        },
        {
          username: "partial_none",
          type: "admin",
          status: "pending",
          role: "moderator",
        },
      ])
      .returning("*");

    // Each row kept its own values, and took the column default everywhere else.
    expect(
      [...rows].sort((a, b) => a.username.localeCompare(b.username)),
    ).toEqual([
      expect.objectContaining({
        username: "partial_bio",
        email: null,
        bio: "only a bio",
        score: 7,
        balance: 0n,
      }),
      expect.objectContaining({
        username: "partial_email",
        email: "partial@example.com",
        bio: null,
        score: 0,
        balance: 0n,
      }),
      expect.objectContaining({
        username: "partial_none",
        email: null,
        bio: null,
        score: 0,
        type: "admin",
        role: "moderator",
      }),
    ]);
  });

  it("should insert and exclude fields from RETURNING", async () => {
    const result = await db
      .insertInto(schema.Users)
      .values({
        username: "excluded",
        email: "excluded@example.com",
        type: "user",
        status: "active",
        role: "user",
      })
      .returning({ email: false });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBeDefined();
    expect(result[0].username).toBe("excluded");
    expect(result[0].type).toBe("user");
    expect(result[0].createdAt).toBeInstanceOf(Date);
    expect(result[0]).not.toHaveProperty("email");
  });

  it("should return RETURNING columns in table column order", async () => {
    const result = await db
      .insertInto(schema.Users)
      .values({
        username: "keyorder",
        type: "user",
        status: "active",
        role: "user",
      })
      .returning({ username: true, createdAt: true, id: true });

    // Table column order, not the order the caller listed the keys in.
    expect(Object.keys(result[0])).toEqual(["id", "username", "createdAt"]);
  });

  it("should allow explicit value to override insertFn", async () => {
    const explicitDate = new Date("2020-01-01T00:00:00.000Z");

    const result = await db
      .insertInto(schema.AuditLogs)
      .values({
        action: "override_test",
        createdAt: explicitDate, // Explicitly provide value to override insertFn
        modifiedAt: new Date(),
      })
      .returning({ id: true, createdAt: true });

    expect(result).toHaveLength(1);
    expect(result[0].createdAt.getTime()).toBe(explicitDate.getTime());
  });

  it("should keep supplied insertFn values across a batch and on a re-render", async () => {
    const explicitDate = new Date("2020-01-01T00:00:00.000Z");

    const builder = db
      .insertInto(schema.AuditLogs)
      .values([
        {
          action: "supplied_a",
          createdAt: explicitDate,
          modifiedAt: new Date(),
        },
        {
          action: "supplied_b",
          createdAt: explicitDate,
          modifiedAt: new Date(),
        },
      ])
      .returning({ action: true, createdAt: true, publicId: true });

    const first = await builder;
    const second = await builder;

    // No row ran the createdAt value function: a supplied value is never
    // overwritten, whether or not other rows of the batch omit the column.
    for (const rows of [first, second]) {
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(row.createdAt.getTime()).toBe(explicitDate.getTime());
      }
    }
    // Each render resolved its own publicIds: a value function reused across
    // renders would replay the first render's and trip the unique constraint.
    expect(new Set([...first, ...second].map((row) => row.publicId)).size).toBe(
      4,
    );
  });

  describe("returning('*')", () => {
    it("should return all columns for a single row insert", async () => {
      const result = await db
        .insertInto(schema.Users)
        .values({
          username: "wildcard_user",
          email: "wildcard@example.com",
          type: "user",
          status: "active",
          role: "user",
        })
        .returning("*");

      expect(result).toHaveLength(1);
      expect(result[0].id).toBeDefined();
      expect(result[0].username).toBe("wildcard_user");
      expect(result[0].email).toBe("wildcard@example.com");
      expect(result[0].type).toBe("user");
      expect(result[0].createdAt).toBeInstanceOf(Date);
      expect(result[0].score).toBe(0);
      expect(result[0].balance).toBe(0n);
      expect(result[0].isActive).toBe(false);
    });

    it("should return all columns for a multi-row insert", async () => {
      const result = await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "multi1", type: "user" }),
          createTestUser({ username: "multi2", type: "admin" }),
        ])
        .returning("*");

      expect(result).toHaveLength(2);
      expect(result[0].username).toBe("multi1");
      expect(result[1].username).toBe("multi2");
      expect(result[0].id).toBeDefined();
      expect(result[1].id).toBeDefined();
      expect(result[1].id).toBeGreaterThan(result[0].id);
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });

    it("should include auto-generated values in returned columns", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "autogen_user" }))
        .returning("*");

      // Use the returned id to seed a related row
      await db.insertInto(schema.Posts).values({
        userId: user.id,
        title: "Post using returned id",
      });

      const posts = await db
        .from(schema.Posts)
        .select("*")
        .where(() => eq(schema.Posts.userId, user.id));

      expect(posts).toHaveLength(1);
      expect(posts[0].userId).toEqual(user.id);
    });
  });

  describe("table-level foreignKeys (self-reference)", () => {
    it("should insert a reply with a valid parentId", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser())
        .returning({ id: true });

      const [post] = await db
        .insertInto(schema.Posts)
        .values({ userId: user.id, title: "Post" })
        .returning({ id: true });

      const [parent] = await db
        .insertInto(schema.Comments)
        .values({ postId: post.id, userId: user.id, body: "Parent comment" })
        .returning({ id: true });

      await db.insertInto(schema.Comments).values({
        postId: post.id,
        userId: user.id,
        parentId: parent.id,
        body: "Reply comment",
      });

      const comments = await db.from(schema.Comments).select("*");
      expect(comments).toHaveLength(2);
      const reply = comments.find((c) => c.body === "Reply comment");
      expect(reply?.parentId).toEqual(parent.id);
    });

    it("should reject insert with a non-existent parentId", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser())
        .returning({ id: true });

      const [post] = await db
        .insertInto(schema.Posts)
        .values({ userId: user.id, title: "Post" })
        .returning({ id: true });

      await expect(
        db.insertInto(schema.Comments).values({
          postId: post.id,
          userId: user.id,
          parentId: 999999n,
          body: "Invalid reply",
        }),
      ).rejects.toThrow();
    });
  });

  describe("ON CONFLICT", () => {
    it("doNothing: should silently skip on unique violation", async () => {
      const user = createTestUser({ username: "conflictuser" });
      await db.insertInto(schema.Users).values(user);

      // Second insert on same unique username — should not throw
      await db
        .insertInto(schema.Users)
        .values({ ...user, type: "admin" })
        .onConflict(schema.Users.username)
        .doNothing();

      const users = await db.from(schema.Users).select("*");
      expect(users).toHaveLength(1);
      expect(users[0].type).toBe("user"); // original row unchanged
    });

    it("doNothing: no target — silently skip on any conflict", async () => {
      const user = createTestUser({ username: "noTargetConflict" });
      await db.insertInto(schema.Users).values(user);

      await db.insertInto(schema.Users).values(user).onConflict().doNothing();

      const users = await db.from(schema.Users).select("*");
      expect(users).toHaveLength(1);
    });

    it("doUpdateSet: should update column from EXCLUDED on conflict", async () => {
      const user = createTestUser({ username: "upsertuser" });
      await db.insertInto(schema.Users).values(user);

      await db
        .insertInto(schema.Users)
        .values({ ...user, email: "newemail@example.com" })
        .onConflict(schema.Users.username)
        .doUpdateSet(({ excluded }) => ({
          email: excluded.email,
        }));

      const users = await db.from(schema.Users).select("*");
      expect(users).toHaveLength(1);
      expect(users[0].email).toBe("newemail@example.com");
    });

    it("doUpdateSet: should set a literal value on conflict", async () => {
      const user = createTestUser({ username: "literalUpdate" });
      await db.insertInto(schema.Users).values(user);

      await db
        .insertInto(schema.Users)
        .values(user)
        .onConflict(schema.Users.username)
        .doUpdateSet(() => ({
          score: 999,
        }));

      const users = await db.from(schema.Users).select("*");
      expect(users).toHaveLength(1);
      expect(users[0].score).toBe(999);
    });

    it("doUpdateSet: should chain with returning()", async () => {
      const user = createTestUser({ username: "upsertReturn" });
      await db.insertInto(schema.Users).values(user);

      const result = await db
        .insertInto(schema.Users)
        .values({ ...user, email: "updated@example.com" })
        .onConflict(schema.Users.username)
        .doUpdateSet(({ excluded }) => ({
          email: excluded.email,
        }))
        .returning({ id: true, username: true, email: true });

      expect(result).toHaveLength(1);
      expect(result[0].username).toBe("upsertReturn");
      expect(result[0].email).toBe("updated@example.com");
    });

    it("doNothing: should chain with returning() and return nothing on conflict", async () => {
      const user = createTestUser({ username: "doNothingReturn" });
      await db.insertInto(schema.Users).values(user);

      const result = await db
        .insertInto(schema.Users)
        .values(user)
        .onConflict(schema.Users.username)
        .doNothing()
        .returning({ id: true });

      // PostgreSQL returns no rows when DO NOTHING fires
      expect(result).toHaveLength(0);
    });

    it("doUpdateSet: should update when where condition matches", async () => {
      const user = createTestUser({ username: "conditionalUpdate" });
      await db.insertInto(schema.Users).values(user);

      await db
        .insertInto(schema.Users)
        .values({ ...user, score: 100 }) // new score is greater
        .onConflict(schema.Users.username)
        .doUpdateSet(
          ({ excluded }) => ({ score: excluded.score }),
          ({ excluded }) => gt(excluded.score, schema.Users.score),
        );

      const users = await db
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.username, "conditionalUpdate"));
      expect(users).toHaveLength(1);
      expect(users[0].score).toBe(100);
    });

    it("doUpdateSet: should skip update when where condition does not match", async () => {
      const user = createTestUser({ username: "conditionalSkip", score: 50 });
      await db.insertInto(schema.Users).values(user);

      await db
        .insertInto(schema.Users)
        .values({ ...user, score: 20 }) // new score is smaller
        .onConflict(schema.Users.username)
        .doUpdateSet(
          ({ excluded }) => ({ score: excluded.score }),
          ({ excluded }) => gt(excluded.score, schema.Users.score),
        );

      const users = await db
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.username, "conditionalSkip"));
      expect(users).toHaveLength(1);
      expect(users[0].score).toBe(50); // should not be updated to 20
    });

    it("doUpdateSet: should update with scalar SQL functions referencing table columns and excluded", async () => {
      const user = createTestUser({
        username: "upsertFnUser",
        score: 10,
        bio: "initial_bio",
      });
      await db.insertInto(schema.Users).values(user);

      await db
        .insertInto(schema.Users)
        .values({ ...user, score: 5 })
        .onConflict(schema.Users.username)
        .doUpdateSet(({ excluded }) => ({
          score: add(schema.Users.score, excluded.score),
          bio: concat(schema.Users.bio, " - incremented"),
        }));

      const [updated] = await db
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.username, "upsertFnUser"));

      expect(updated.score).toBe(15);
      expect(updated.bio).toBe(`${user.bio} - incremented`);
    });

    it("doUpdateSet: should update with raw Sql expression and table column reference", async () => {
      const user = createTestUser({
        username: "upsertSqlUser",
        description: "table description",
      });
      await db.insertInto(schema.Users).values(user);

      await db
        .insertInto(schema.Users)
        .values({ ...user, score: 5 })
        .onConflict(schema.Users.username)
        .doUpdateSet(() => ({
          bio: schema.Users.description,
          score: sql`99 + 1`,
        }));

      const [updated] = await db
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.username, "upsertSqlUser"));

      expect(updated.bio).toBe("table description");
      expect(updated.score).toBe(100);
    });
  });

  describe("scalar SQL functions in values", () => {
    it("should insert a row using string and arithmetic scalar SQL functions", async () => {
      const user = createTestUser({
        username: "initial_user",
      });

      await db.insertInto(schema.Users).values({
        ...user,
        username: lower("MIXEDCASE_USER"),
        bio: concat("hello", " world"),
        score: add(50, 25),
      });

      const [inserted] = await db
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.username, "mixedcase_user"));

      expect(inserted).toBeDefined();
      expect(inserted.username).toBe("mixedcase_user");
      expect(inserted.bio).toBe("hello world");
      expect(inserted.score).toBe(75);
    });

    it("should insert with coalesce scalar SQL function", async () => {
      const user = createTestUser({ username: "coalesce_user" });

      await db.insertInto(schema.Users).values({
        ...user,
        bio: coalesce(null, "fallback_bio"),
      });

      const [inserted] = await db
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.username, "coalesce_user"));

      expect(inserted.bio).toBe("fallback_bio");
    });

    it("should insert multi-row with scalar SQL functions and literal values", async () => {
      const user1 = createTestUser({ username: "unused1" });
      const user2 = createTestUser({ username: "unused2" });

      await db.insertInto(schema.Users).values([
        {
          ...user1,
          username: lower("MULTI_ROW_1"),
          score: add(10, 5),
        },
        {
          ...user2,
          username: upper("multi_row_2"),
          score: 100,
        },
      ]);

      const [row1] = await db
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.username, "multi_row_1"));
      const [row2] = await db
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.username, "MULTI_ROW_2"));

      expect(row1.score).toBe(15);
      expect(row2.score).toBe(100);
    });

    it("should insert using scalar SQL functions with returning clause", async () => {
      const user = createTestUser({ username: "unused_returning" });

      const [result] = await db
        .insertInto(schema.Users)
        .values({
          ...user,
          username: lower("RETURNING_USER"),
          score: add(40, 2),
        })
        .returning({ id: true, username: true, score: true });

      expect(result.username).toBe("returning_user");
      expect(result.score).toBe(42);
      expect(result.id).toBeDefined();
    });
  });
});
