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
  gte,
  lower,
  mul,
  sql,
  sub,
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

describe("UPDATE queries", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("update");

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

  it("should update a single row", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "oldname" }))
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ username: "newname" })
      .where(eq(schema.Users.id, user.id));

    const updated = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));

    expect(updated[0].username).toBe("newname");
  });

  it("should update multiple columns", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({
        username: "updated",
        email: "updated@example.com",
        score: 100,
      })
      .where(eq(schema.Users.id, user.id));

    const updated = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));

    expect(updated[0]).toMatchObject({
      username: "updated",
      email: "updated@example.com",
      score: 100,
    });
  });

  it("should update multiple rows with WHERE clause", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ type: "user", score: 0 }),
        createTestUser({ type: "user", score: 0 }),
        createTestUser({ type: "admin", score: 0 }),
      ]);

    await db
      .update(schema.Users)
      .set({ score: 50 })
      .where(eq(schema.Users.type, "user"));

    const users = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.type, "user"));

    expect(users).toHaveLength(2);
    expect(users.every((u) => u.score === 50)).toBe(true);

    const admins = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.type, "admin"));

    expect(admins[0].score).toBe(0);
  });

  it("should update with RETURNING clause", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "beforeupdate" }))
      .returning({ id: true });

    const result = await db
      .update(schema.Users)
      .set({ username: "afterupdate" })
      .where(eq(schema.Users.id, user.id))
      .returning({ id: true, username: true });

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("afterupdate");
    expect(result[0].id).toEqual(user.id);
  });

  it("should update and exclude fields from RETURNING", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "exclupdate", type: "user" }))
      .returning({ id: true });

    const result = await db
      .update(schema.Users)
      .set({ username: "excluded_update" })
      .where(eq(schema.Users.id, user.id))
      .returning({ email: false });

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(user.id);
    expect(result[0].username).toBe("excluded_update");
    expect(result[0].type).toBe("user");
    expect(result[0]).not.toHaveProperty("email");
  });

  it("should update to null value", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ email: "test@example.com" }))
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ email: null })
      .where(eq(schema.Users.id, user.id));

    const updated = await db
      .from(schema.Users)
      .select(() => ({ email: schema.Users.email }))
      .where(() => eq(schema.Users.id, user.id));

    expect(updated[0].email).toBeNull();
  });

  it("should update boolean columns", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ isActive: true, isVerified: true })
      .where(eq(schema.Users.id, user.id));

    const updated = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));

    expect(updated[0].isActive).toBe(true);
    expect(updated[0].isVerified).toBe(true);
  });

  it("should update enum columns", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ status: "active" }))
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ status: "inactive" })
      .where(eq(schema.Users.id, user.id));

    const updated = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));

    expect(updated[0].status).toBe("inactive");
  });

  it("should update numeric columns", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ age: 25, score: 10 }))
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ age: 30, score: 100 })
      .where(eq(schema.Users.id, user.id));

    const updated = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));

    expect(updated[0].age).toBe(30);
    expect(updated[0].score).toBe(100);
  });

  it("should not update rows when WHERE clause matches nothing", async () => {
    await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "test" }));

    await db
      .update(schema.Users)
      .set({ username: "updated" })
      .where(eq(schema.Users.username, "nonexistent"));

    const users = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.username, "test"));

    expect(users[0].username).toBe("test");
  });

  it("should update all rows when no WHERE clause", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ score: 0 }),
        createTestUser({ score: 0 }),
        createTestUser({ score: 0 }),
      ]);

    await db.update(schema.Users).set({ score: 100 });

    const users = await db.from(schema.Users).select("*");

    expect(users).toHaveLength(3);
    expect(users.every((u) => u.score === 100)).toBe(true);
  });

  it("should auto-generate values using updateFn on every update", async () => {
    // Insert a row first
    const [inserted] = await db
      .insertInto(schema.AuditLogs)
      .values({
        action: "initial_action",
        message: "Initial message",
        modifiedAt: new Date("2020-01-01T00:00:00.000Z"), // Set an old date
      })
      .returning({ id: true, modifiedAt: true });

    const initialModifiedAt = inserted.modifiedAt;
    expect(initialModifiedAt.getTime()).toBe(
      new Date("2020-01-01T00:00:00.000Z").getTime(),
    );

    const beforeUpdate = new Date();

    // Update the row - updateFn should auto-generate modifiedAt
    const [updated] = await db
      .update(schema.AuditLogs)
      .set({ action: "updated_action" })
      .where(eq(schema.AuditLogs.id, inserted.id))
      .returning({ id: true, action: true, modifiedAt: true });

    const afterUpdate = new Date();

    expect(updated.action).toBe("updated_action");
    expect(updated.modifiedAt).toBeInstanceOf(Date);
    // modifiedAt should be auto-generated by updateFn
    expect(updated.modifiedAt.getTime()).toBeGreaterThanOrEqual(
      beforeUpdate.getTime(),
    );
    expect(updated.modifiedAt.getTime()).toBeLessThanOrEqual(
      afterUpdate.getTime(),
    );
    // modifiedAt should be different from the initial value
    expect(updated.modifiedAt.getTime()).toBeGreaterThan(
      initialModifiedAt.getTime(),
    );
  });

  it("should set every supplied column and refresh the updateFn ones", async () => {
    const [inserted] = await db
      .insertInto(schema.AuditLogs)
      .values({
        action: "multi_column_action",
        message: "Initial message",
        modifiedAt: new Date("2020-01-01T00:00:00.000Z"),
      })
      .returning({ id: true });

    const beforeUpdate = new Date();

    const [updated] = await db
      .update(schema.AuditLogs)
      .set({ action: "multi_column_updated", message: "Updated message" })
      .where(eq(schema.AuditLogs.id, inserted.id))
      .returning("*");

    expect(updated.action).toBe("multi_column_updated");
    expect(updated.message).toBe("Updated message");
    expect(updated.modifiedAt.getTime()).toBeGreaterThanOrEqual(
      beforeUpdate.getTime(),
    );
  });

  it("should allow explicit value to override updateFn", async () => {
    // Insert a row first
    const [inserted] = await db
      .insertInto(schema.AuditLogs)
      .values({
        action: "initial_action",
        modifiedAt: new Date("2020-01-01T00:00:00.000Z"),
      })
      .returning({ id: true });

    const explicitDate = new Date("2025-12-25T00:00:00.000Z");

    // Update with explicit modifiedAt value to override updateFn
    const [updated] = await db
      .update(schema.AuditLogs)
      .set({
        action: "explicit_override",
        modifiedAt: explicitDate, // Override updateFn with explicit value
      })
      .where(eq(schema.AuditLogs.id, inserted.id))
      .returning({ id: true, modifiedAt: true });

    expect(updated.modifiedAt.getTime()).toBe(explicitDate.getTime());
  });

  it("should update with RETURNING * clause", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "returnstar" }))
      .returning({ id: true });

    const result = await db
      .update(schema.Users)
      .set({ username: "returnstarchanged" })
      .where(eq(schema.Users.id, user.id))
      .returning("*");

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("id");
    expect(result[0]).toHaveProperty("username");
    expect(result[0]).toHaveProperty("email");
    expect(result[0]).toHaveProperty("score");
    expect(result[0]).toHaveProperty("age");
    expect(result[0]).toHaveProperty("isActive");
    expect(result[0]).toHaveProperty("isVerified");
    expect(result[0]).toHaveProperty("status");
    expect(result[0].username).toBe("returnstarchanged");
  });

  it("should update column with Sql value", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "mixedCASE" }))
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ username: sql`LOWER('MIXEDCASE')` })
      .where(eq(schema.Users.id, user.id));

    const updated = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));

    expect(updated[0].username).toBe("mixedcase");
  });

  it("should update a column to another column value", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(
        createTestUser({
          bio: "original bio",
          description: "from description",
        }),
      )
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ bio: schema.Users.description })
      .where(eq(schema.Users.id, user.id));

    const [updated] = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));

    expect(updated.bio).toBe("from description");
  });

  it("should update columns using arithmetic scalar SQL functions (add, sub, mul)", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ score: 100 }))
      .returning({ id: true });

    // Test add
    await db
      .update(schema.Users)
      .set({ score: add(schema.Users.score, 25) })
      .where(eq(schema.Users.id, user.id));

    let [updated] = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));
    expect(updated.score).toBe(125);

    // Test sub
    await db
      .update(schema.Users)
      .set({ score: sub(schema.Users.score, 15) })
      .where(eq(schema.Users.id, user.id));

    [updated] = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));
    expect(updated.score).toBe(110);

    // Test mul
    await db
      .update(schema.Users)
      .set({ score: mul(schema.Users.score, 2) })
      .where(eq(schema.Users.id, user.id));

    [updated] = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));
    expect(updated.score).toBe(220);
  });

  it("should update columns using string scalar SQL functions (lower, upper, concat)", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "MixedCaseUser", bio: "profile" }))
      .returning({ id: true });

    // lower
    await db
      .update(schema.Users)
      .set({ username: lower(schema.Users.username) })
      .where(eq(schema.Users.id, user.id));

    let [updated] = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));
    expect(updated.username).toBe("mixedcaseuser");

    // upper
    await db
      .update(schema.Users)
      .set({ username: upper(schema.Users.username) })
      .where(eq(schema.Users.id, user.id));

    [updated] = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));
    expect(updated.username).toBe("MIXEDCASEUSER");

    // concat
    await db
      .update(schema.Users)
      .set({ bio: concat(schema.Users.bio, " - updated") })
      .where(eq(schema.Users.id, user.id));

    [updated] = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));
    expect(updated.bio).toBe("profile - updated");
  });

  it("should update columns using conditional scalar SQL function (coalesce)", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ bio: null }))
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ bio: coalesce(schema.Users.bio, "default bio") })
      .where(eq(schema.Users.id, user.id));

    const [updated] = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));
    expect(updated.bio).toBe("default bio");
  });

  it("should update with mixed values, columns, and scalar functions in a single set", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(
        createTestUser({
          username: "Alice",
          score: 10,
          description: "awesome",
        }),
      )
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({
        username: lower(schema.Users.username),
        score: add(schema.Users.score, 5),
        bio: schema.Users.description,
        isActive: true,
      })
      .where(eq(schema.Users.id, user.id));

    const [updated] = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));

    expect(updated.username).toBe("alice");
    expect(updated.score).toBe(15);
    expect(updated.bio).toBe("awesome");
    expect(updated.isActive).toBe(true);
  });

  it("should update using scalar functions with returning clause", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ score: 50 }))
      .returning({ id: true });

    const [result] = await db
      .update(schema.Users)
      .set({ score: add(schema.Users.score, 10) })
      .where(eq(schema.Users.id, user.id))
      .returning({ id: true, score: true });

    expect(result.score).toBe(60);
    expect(result.id).toEqual(user.id);
  });

  it("should omit undefined properties from SET clause in partial updates", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "orig_name", bio: "orig_bio" }))
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({
        username: "updated_name",
        bio: undefined,
      })
      .where(eq(schema.Users.id, user.id));

    const [updated] = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));

    expect(updated.username).toBe("updated_name");
    expect(updated.bio).toBe("orig_bio"); // Unchanged, not set to 'undefined' string
  });

  it("should throw an error when .set() has no columns to update", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await expect(
      db
        .update(schema.Users)
        .set({ bio: undefined })
        .where(eq(schema.Users.id, user.id))
        .execute(),
    ).rejects.toThrow("No columns to set in UPDATE query.");
  });

  it("should update many rows to different values via UPDATE ... FROM (VALUES ...)", async () => {
    const users = await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "bulk_a", bio: "a_bio" }),
        createTestUser({ username: "bulk_b", bio: "b_bio" }),
        createTestUser({ username: "bulk_c", bio: "c_bio" }),
      ])
      .returning({ id: true, username: true });

    const V = db
      .values("v", { userId: schema.Users.id, bio: schema.Users.bio })
      .as([
        { userId: users[0].id, bio: "new_a" },
        { userId: users[1].id, bio: "new_b" },
        { userId: users[2].id, bio: "new_c" },
      ]);

    const updated = await db
      .update(schema.Users)
      .from(V)
      .set({ bio: V.bio })
      .where(eq(schema.Users.id, V.userId))
      .returning({ id: true, bio: true });

    expect(updated).toHaveLength(3);
    const bioById = new Map(updated.map((row) => [row.id, row.bio]));
    expect(bioById.get(users[0].id)).toBe("new_a");
    expect(bioById.get(users[1].id)).toBe("new_b");
    expect(bioById.get(users[2].id)).toBe("new_c");
  });

  it("should leave rows untouched when a values join key matches nothing", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "noop", bio: "keep" }))
      .returning({ id: true });

    const V = db
      .values("v", { userId: schema.Users.id, bio: schema.Users.bio })
      .as([{ userId: 999999n, bio: "changed" }]);

    const updated = await db
      .update(schema.Users)
      .from(V)
      .set({ bio: V.bio })
      .where(eq(schema.Users.id, V.userId))
      .returning({ id: true });

    expect(updated).toHaveLength(0);

    const [row] = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));
    expect(row.bio).toBe("keep");
  });

  it("should throw when a values alias has no rows", async () => {
    const V = db.values("v", { userId: schema.Users.id }).as([]);
    expect(() =>
      db.update(schema.Users).from(V).set({ points: V.userId }).toQuery(),
    ).toThrow('Values alias "v" has no rows.');
  });

  it("should update from a plain table join", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "join_src", bio: "user_bio" }))
      .returning({ id: true, username: true });

    await db
      .insertInto(schema.UserProfiles)
      .values({ userId: user.id, bio: "old_bio" });

    await db
      .update(schema.UserProfiles)
      .from(schema.Users)
      .set({ bio: schema.Users.username })
      .where(eq(schema.UserProfiles.userId, schema.Users.id));

    const [profile] = await db
      .from(schema.UserProfiles)
      .select("*")
      .where(() => eq(schema.UserProfiles.userId, user.id));
    expect(profile.bio).toBe("join_src");
  });

  it("should combine a WITH clause and an inline VALUES source in one statement", async () => {
    const [rich, poor] = await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "cte_a", score: 10 }),
        createTestUser({ username: "cte_b", score: 0 }),
      ])
      .returning({ id: true, score: true });

    const highScores = db.with("high_scores").as(
      db
        .from(schema.Users)
        .select(() => ({ id: schema.Users.id }))
        .where(() => gte(schema.Users.score, 10)),
    );
    const bonus = db
      .values("bonus", { userId: schema.Users.id, extra: schema.Users.points })
      .as([{ userId: rich.id, extra: 100n }]);

    const updated = await db
      .with(highScores)
      .update(schema.Users)
      .from(highScores, bonus)
      .set({ points: bonus.extra })
      .where(eq(schema.Users.id, highScores.id))
      .returning({ id: true, points: true });

    expect(updated).toHaveLength(1);
    expect(updated[0].id).toEqual(rich.id);
    expect(updated[0].points).toBe(100n);
    expect(poor.id).not.toEqual(rich.id);
  });

  it("should return only the updated table's columns with RETURNING * and a FROM source", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "star_from", bio: "original" }))
      .returning({ id: true });

    const V = db
      .values("v", { userId: schema.Users.id, bio: schema.Users.bio })
      .as([{ userId: user.id, bio: "from_alias" }]);

    const [updated] = await db
      .update(schema.Users)
      .from(V)
      .set({ bio: "explicit" })
      .where(eq(schema.Users.id, V.userId))
      .returning("*");

    expect(updated.id).toBe(user.id);
    expect(updated.bio).toBe("explicit");
    expect("userId" in updated).toBe(false);
  });

  it("should cast NULL cells with the full array column type", async () => {
    const [doc] = await db
      .insertInto(schema.Documents)
      .values({
        title: "array_doc",
        stamps: [new Date("2024-01-01T00:00:00.000Z")],
      })
      .returning({ id: true });

    const V = db
      .values("v", { id: schema.Documents.id, stamps: schema.Documents.stamps })
      .as([
        { id: doc.id, stamps: [new Date("2025-01-01T00:00:00.000Z")] },
        { id: 999999n, stamps: null },
      ]);

    await db
      .update(schema.Documents)
      .from(V)
      .set({ stamps: V.stamps })
      .where(eq(schema.Documents.id, V.id));

    const [row] = await db
      .from(schema.Documents)
      .select("*")
      .where(() => eq(schema.Documents.id, doc.id));
    expect(row.stamps).toEqual([new Date("2025-01-01T00:00:00.000Z")]);
  });

  it("should quote a reserved-word values alias", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "reserved_alias", bio: "before" }))
      .returning({ id: true });

    const V = db
      .values("user", { userId: schema.Users.id })
      .as([{ userId: user.id }]);

    const [updated] = await db
      .update(schema.Users)
      .from(V)
      .set({ bio: "after" })
      .where(eq(schema.Users.id, V.userId))
      .returning({ id: true, bio: true });

    expect(updated).toEqual({ id: user.id, bio: "after" });
  });

  it("should allow a values alias column named rows", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "rows_col", bio: "before" }))
      .returning({ id: true });

    const V = db
      .values("v", { userId: schema.Users.id, rows: schema.Users.bio })
      .as([{ userId: user.id, rows: "from_rows" }]);

    await db
      .update(schema.Users)
      .from(V)
      .set({ bio: V.rows })
      .where(eq(schema.Users.id, V.userId));

    const [row] = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));
    expect(row.bio).toBe("from_rows");
  });

  it("should reject a values alias column named underscore", () => {
    expect(() =>
      db.values("v", { _: schema.Users.id }).as([{ _: 1n }]),
    ).toThrow('cannot declare a column named "_"');
  });

  it("should keep auto-generating updateFn values alongside a VALUES source", async () => {
    const [log] = await db
      .insertInto(schema.AuditLogs)
      .values({ action: "bulk", modifiedAt: new Date() })
      .returning({ id: true, modifiedAt: true });

    const V = db
      .values("v", {
        id: schema.AuditLogs.id,
        message: schema.AuditLogs.message,
      })
      .as([{ id: log.id, message: "from_values" }]);

    await db
      .update(schema.AuditLogs)
      .from(V)
      .set({ message: V.message })
      .where(eq(schema.AuditLogs.id, V.id));

    const [row] = await db
      .from(schema.AuditLogs)
      .select("*")
      .where(() => eq(schema.AuditLogs.id, log.id));
    expect(row.message).toBe("from_values");
    expect(row.modifiedAt.getTime()).toBeGreaterThan(log.modifiedAt.getTime());
  });
});
