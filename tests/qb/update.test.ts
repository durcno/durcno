import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import { database, defineConfig, eq } from "durcno";
import { PgConnector } from "durcno/connectors/pg";
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

describe("UPDATE queries", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  const migrationsDirName = generateMigrationsDirPath("update");

  beforeAll(async () => {
    containerInfo = await startPostgresContainer();
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
      defineConfig(PgConnector, {
        schema: "./schema.ts",
        pool: { max: 5 },
        dbCredentials: {
          host: "localhost",
          port: containerInfo.port,
          user: "testuser",
          password: "testpassword",
          database: containerInfo.dbName,
        },
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

  it("should update a single row", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "oldname" }))
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ username: "newname" })
      .where(eq(schema.Users.id, user.id));

    const updated = await db
      .from(schema.Users)
      .select()
      .where(eq(schema.Users.id, user.id));

    expect(updated[0].username).toBe("newname");
  });

  it("should update multiple columns", async () => {
    const [user] = await db
      .insert(schema.Users)
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
      .select()
      .where(eq(schema.Users.id, user.id));

    expect(updated[0]).toMatchObject({
      username: "updated",
      email: "updated@example.com",
      score: 100,
    });
  });

  it("should update multiple rows with WHERE clause", async () => {
    await db
      .insert(schema.Users)
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
      .select()
      .where(eq(schema.Users.type, "user"));

    expect(users).toHaveLength(2);
    expect(users.every((u) => u.score === 50)).toBe(true);

    const admins = await db
      .from(schema.Users)
      .select()
      .where(eq(schema.Users.type, "admin"));

    expect(admins[0].score).toBe(0);
  });

  it("should update with RETURNING clause", async () => {
    const [user] = await db
      .insert(schema.Users)
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

  it("should update to null value", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ email: "test@example.com" }))
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ email: null })
      .where(eq(schema.Users.id, user.id));

    const updated = await db
      .from(schema.Users)
      .select({ email: schema.Users.email })
      .where(eq(schema.Users.id, user.id));

    expect(updated[0].email).toBeNull();
  });

  it("should update boolean columns", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ isActive: true, isVerified: true })
      .where(eq(schema.Users.id, user.id));

    const updated = await db
      .from(schema.Users)
      .select()
      .where(eq(schema.Users.id, user.id));

    expect(updated[0].isActive).toBe(true);
    expect(updated[0].isVerified).toBe(true);
  });

  it("should update enum columns", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ status: "active" }))
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ status: "inactive" })
      .where(eq(schema.Users.id, user.id));

    const updated = await db
      .from(schema.Users)
      .select()
      .where(eq(schema.Users.id, user.id));

    expect(updated[0].status).toBe("inactive");
  });

  it("should update numeric columns", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ age: 25, score: 10 }))
      .returning({ id: true });

    await db
      .update(schema.Users)
      .set({ age: 30, score: 100 })
      .where(eq(schema.Users.id, user.id));

    const updated = await db
      .from(schema.Users)
      .select()
      .where(eq(schema.Users.id, user.id));

    expect(updated[0].age).toBe(30);
    expect(updated[0].score).toBe(100);
  });

  it("should not update rows when WHERE clause matches nothing", async () => {
    await db.insert(schema.Users).values(createTestUser({ username: "test" }));

    await db
      .update(schema.Users)
      .set({ username: "updated" })
      .where(eq(schema.Users.username, "nonexistent"));

    const users = await db
      .from(schema.Users)
      .select()
      .where(eq(schema.Users.username, "test"));

    expect(users[0].username).toBe("test");
  });

  it("should update all rows when no WHERE clause", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ score: 0 }),
        createTestUser({ score: 0 }),
        createTestUser({ score: 0 }),
      ]);

    await db.update(schema.Users).set({ score: 100 });

    const users = await db.from(schema.Users).select();

    expect(users).toHaveLength(3);
    expect(users.every((u) => u.score === 100)).toBe(true);
  });

  it("should auto-generate values using updateFn on every update", async () => {
    // Insert a row first
    const [inserted] = await db
      .insert(schema.AuditLogs)
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

    // Wait a bit to ensure time difference
    await new Promise((resolve) => setTimeout(resolve, 10));

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
      .insert(schema.AuditLogs)
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
});
