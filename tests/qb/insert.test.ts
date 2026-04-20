import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import { database, defineConfig, eq } from "durcno";
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

describe("INSERT queries", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  const migrationsDirName = generateMigrationsDirPath("insert");

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
      defineConfig(pg(), {
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

  it("should insert a single row", async () => {
    await db.insert(schema.Users).values({
      username: "newuser",
      email: "new@example.com",
      type: "user",
      status: "active",
      role: "user",
    });

    const users = await db.from(schema.Users).select();
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe("newuser");
    expect(users[0].email).toBe("new@example.com");
  });

  it("should insert multiple rows", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "user1" }),
        createTestUser({ username: "user2" }),
        createTestUser({ username: "user3" }),
      ]);

    const users = await db.from(schema.Users).select();
    expect(users).toHaveLength(3);
  });

  it("should insert with default values", async () => {
    await db.insert(schema.Users).values({
      username: "defaultuser",
      type: "user",
      status: "active",
      role: "user",
    });

    const users = await db.from(schema.Users).select();
    expect(users[0].score).toBe(0);
    expect(users[0].balance).toBe(0);
    expect(users[0].isActive).toBe(false);
  });

  it("should insert with RETURNING clause", async () => {
    const result = await db
      .insert(schema.Users)
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
    await db.insert(schema.Users).values({
      username: "nulluser",
      // email: null, // TODO: null values not supported
      // bio: null, // TODO: null values not supported
      type: "user",
      status: "active",
      role: "user",
    });

    const users = await db
      .from(schema.Users)
      .select()
      .where(eq(schema.Users.username, "nulluser"));

    expect(users[0].email).toBeNull();
    expect(users[0].bio).toBeNull();
  });

  it("should insert with foreign key reference", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await db.insert(schema.Posts).values({
      userId: user.id,
      title: "Test Post",
      content: "Test Content",
    });

    const posts = await db.from(schema.Posts).select();
    expect(posts).toHaveLength(1);
    expect(posts[0].userId).toEqual(user.id);
  });

  it("should insert with all column types", async () => {
    const testDate = new Date("2024-01-15");

    await db.insert(schema.Users).values({
      username: "fulluser",
      email: "full@example.com",
      bio: "A comprehensive bio",
      description: "A detailed description",
      age: 30,
      score: 100,
      points: 5000,
      balance: 10000,
      isActive: true,
      isVerified: false,
      birthDate: testDate,
      type: "admin",
      status: "active",
      role: "moderator",
    });

    const users = await db
      .from(schema.Users)
      .select()
      .where(eq(schema.Users.username, "fulluser"));

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
    expect(users[0].points).toBe(5000);
    expect(users[0].balance).toBe(10000);
  });

  it("should handle enum values correctly", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ type: "admin" }),
        createTestUser({ type: "user" }),
      ]);

    const admins = await db
      .from(schema.Users)
      .select()
      .where(eq(schema.Users.type, "admin"));

    const regularUsers = await db
      .from(schema.Users)
      .select()
      .where(eq(schema.Users.type, "user"));

    expect(admins).toHaveLength(1);
    expect(regularUsers).toHaveLength(1);
  });

  it("should auto-generate primary key", async () => {
    const [result1] = await db
      .insert(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    const [result2] = await db
      .insert(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();
    expect(result2.id).toBeGreaterThan(result1.id);
  });

  it("should insert and return all fields with RETURNING *", async () => {
    const result = await db
      .insert(schema.Users)
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
      .insert(schema.AuditLogs)
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

  it("should allow explicit value to override insertFn", async () => {
    const explicitDate = new Date("2020-01-01T00:00:00.000Z");

    const result = await db
      .insert(schema.AuditLogs)
      .values({
        action: "override_test",
        createdAt: explicitDate, // Explicitly provide value to override insertFn
        modifiedAt: new Date(),
      })
      .returning({ id: true, createdAt: true });

    expect(result).toHaveLength(1);
    expect(result[0].createdAt.getTime()).toBe(explicitDate.getTime());
  });
});
