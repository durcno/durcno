import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import { type $Client, database, defineConfig } from "durcno";
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

describe("Raw SQL queries", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("raw");

  beforeAll(async () => {
    containerInfo = await startPostgresContainer({
      image: "postgres:14-alpine",
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

  it("should execute raw SELECT query", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "user1" }),
        createTestUser({ username: "user2" }),
      ]);

    const result = await db.raw<{ username: string }[]>(
      "SELECT username FROM users",
      [],
      (rows) => rows,
    );

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.username).sort()).toEqual(["user1", "user2"]);
  });

  it("should execute raw query with parameters", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "alice", age: 25 }),
        createTestUser({ username: "bob", age: 30 }),
        createTestUser({ username: "charlie", age: 35 }),
      ]);

    const result = await db.raw<{ username: string; age: number }[]>(
      "SELECT username, age FROM users WHERE age >= $1",
      [30],
      (rows) => rows,
    );

    expect(result).toHaveLength(2);
    expect(result.every((r) => r.age >= 30)).toBe(true);
  });

  it("should execute raw INSERT query", async () => {
    await db.raw(
      `INSERT INTO users (username, email, type, status, role) 
       VALUES ($1, $2, $3, $4, $5)`,
      ["rawuser", "raw@example.com", "user", "active", "user"],
      undefined,
    );

    const users = await db.from(schema.Users).select();
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe("rawuser");
  });

  it("should execute raw UPDATE query", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "original" }))
      .returning({ id: true });

    await db.raw(
      "UPDATE users SET username = $1 WHERE id = $2",
      ["updated", user.id.toString()],
      undefined,
    );

    const users = await db.from(schema.Users).select();
    expect(users[0].username).toBe("updated");
  });

  it("should execute raw DELETE query", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await db.raw(
      "DELETE FROM users WHERE id = $1",
      [user.id.toString()],
      undefined,
    );

    const users = await db.from(schema.Users).select();
    expect(users).toHaveLength(0);
  });

  it("should execute aggregate queries", async () => {
    await db
      .insert(schema.Users)
      .values([createTestUser(), createTestUser(), createTestUser()]);

    const result = await db.raw<{ count: string }[]>(
      "SELECT COUNT(*) as count FROM users",
      [],
      (rows) => rows,
    );

    expect(Number.parseInt(result[0].count, 10)).toBe(3);
  });

  it("should execute JOIN queries", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "author" }))
      .returning({ id: true });

    await db.insert(schema.Posts).values({
      userId: user.id,
      title: "Test Post",
      content: "Test Content",
    });

    const result = await db.raw<{ username: string; title: string | null }[]>(
      `SELECT u.username, p.title 
       FROM users u 
       JOIN posts p ON u.id = p."user_id"`,
      [],
      (rows) => rows,
    );

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("author");
    expect(result[0].title).toBe("Test Post");
  });

  it("should handle NULL values in raw queries", async () => {
    // Insert user without email (will be null since it's nullable)
    await db.insert(schema.Users).values({
      username: `user_${Date.now()}`,
      type: "user",
      status: "active",
      role: "user",
      // email is omitted, will be NULL
    });

    const result = await db.raw<{ email: string | null }[]>(
      "SELECT email FROM users",
      [],
      (rows) => rows,
    );

    expect(result[0].email).toBeNull();
  });

  it("should execute complex WHERE clauses", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ type: "admin", age: 30 }),
        createTestUser({ type: "user", age: 25 }),
        createTestUser({ type: "admin", age: 35 }),
      ]);

    const result = await db.raw<{ username: string }[]>(
      `SELECT username FROM users 
       WHERE type = $1 AND age >= $2`,
      ["admin", 30],
      (rows) => rows,
    );

    expect(result).toHaveLength(2);
  });

  it("should handle empty result sets", async () => {
    const result = await db.raw<{ username: string }[]>(
      "SELECT username FROM users WHERE username = $1",
      ["nonexistent"],
      (rows) => rows,
    );

    expect(result).toEqual([]);
  });

  it("should execute DDL statements", async () => {
    await db.raw(
      `CREATE TEMP TABLE temp_test (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100)
      )`,
      [],
      undefined,
    );

    await db.raw(
      "INSERT INTO temp_test (name) VALUES ($1)",
      ["test"],
      undefined,
    );

    const result = await db.raw<{ name: string }[]>(
      "SELECT name FROM temp_test",
      [],
      (rows) => rows,
    );

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("test");
  });

  it("should handle multiple parameters of different types", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "user1", age: 25, isActive: true }),
        createTestUser({ username: "user2", age: 30, isActive: false }),
        createTestUser({ username: "user3", age: 35, isActive: true }),
      ]);

    const result = await db.raw<{ username: string }[]>(
      `SELECT username FROM users 
       WHERE age > $1 AND "is_active" = $2`,
      [25, "true"],
      (rows) => rows,
    );

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("user3");
  });

  it("should work with custom row handlers", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "user1" }),
        createTestUser({ username: "user2" }),
      ]);

    const result = await db.raw("SELECT username FROM users", [], (rows) =>
      rows.map((r) => r.username.toUpperCase()),
    );

    expect(result).toEqual(["USER1", "USER2"]);
  });
});
