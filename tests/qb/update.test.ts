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
});
