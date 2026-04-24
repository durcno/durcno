import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import { asc, database, defineConfig, desc, eq } from "durcno";
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

describe("SELECT queries", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  const migrationsDirName = generateMigrationsDirPath("select");

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
          pool: { max: 5 },
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
  }, 120000);

  beforeEach(async () => {
    await cleanDatabase(containerInfo.connectionString);
  });

  afterAll(async () => {
    if (db) await db.close();
    if (container) await stopPostgresContainer(container);
  });

  it("should select all columns from Users", async () => {
    // Insert test data
    await db.insert(schema.Users).values({
      username: "testuser",
      email: "test@example.com",
      type: "user",
      status: "active",
      role: "user",
    });

    // Select all columns
    const users = await db.from(schema.Users).select();

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      username: "testuser",
      email: "test@example.com",
      type: "user",
      status: "active",
      role: "user",
    });
    expect(users[0].id).toBeDefined();
    expect(users[0].createdAt).toBeInstanceOf(Date);
  });

  it("should select specific columns", async () => {
    await db.insert(schema.Users).values({
      username: "specificuser",
      email: "specific@example.com",
      type: "admin",
      status: "active",
      role: "admin",
    });

    const result = await db
      .from(schema.Users)
      .select({ username: schema.Users.username, type: schema.Users.type });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      username: "specificuser",
      type: "admin",
    });
    expect(result[0]).not.toHaveProperty("email");
    expect(result[0]).not.toHaveProperty("id");
  });

  it("should select with WHERE clause", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "alice", type: "admin" }),
        createTestUser({ username: "bob", type: "user" }),
        createTestUser({ username: "charlie", type: "user" }),
      ]);

    const admins = await db
      .from(schema.Users)
      .select({ username: schema.Users.username })
      .where(eq(schema.Users.type, "admin"));

    expect(admins).toHaveLength(1);
    expect(admins[0].username).toBe("alice");
  });

  it("should select with LIMIT", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "user1" }),
        createTestUser({ username: "user2" }),
        createTestUser({ username: "user3" }),
        createTestUser({ username: "user4" }),
      ]);

    const limited = await db
      .from(schema.Users)
      .select({ username: schema.Users.username })
      .limit(2);

    expect(limited).toHaveLength(2);
  });

  it("should select with OFFSET", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "user1" }),
        createTestUser({ username: "user2" }),
        createTestUser({ username: "user3" }),
      ]);

    const offset = await db
      .from(schema.Users)
      .select({ username: schema.Users.username })
      .limit(2)
      .offset(1);

    expect(offset).toHaveLength(2);
  });

  it("should select with ORDER BY ASC", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "charlie" }),
        createTestUser({ username: "alice" }),
        createTestUser({ username: "bob" }),
      ]);

    const ordered = await db
      .from(schema.Users)
      .select({ username: schema.Users.username })
      .orderBy(asc(schema.Users.username));

    expect(ordered.map((u) => u.username)).toEqual(["alice", "bob", "charlie"]);
  });

  it("should select with ORDER BY DESC", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "alice" }),
        createTestUser({ username: "charlie" }),
        createTestUser({ username: "bob" }),
      ]);

    const ordered = await db
      .from(schema.Users)
      .select({ username: schema.Users.username })
      .orderBy(desc(schema.Users.username));

    expect(ordered.map((u) => u.username)).toEqual(["charlie", "bob", "alice"]);
  });

  it("should select with multi-column ORDER BY (array syntax)", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "alice", type: "user" }),
        createTestUser({ username: "bob", type: "admin" }),
        createTestUser({ username: "charlie", type: "user" }),
        createTestUser({ username: "diana", type: "admin" }),
      ]);

    // Order by type ASC, then username ASC
    const ordered = await db
      .from(schema.Users)
      .select({ username: schema.Users.username, type: schema.Users.type })
      .orderBy([asc(schema.Users.type), asc(schema.Users.username)]);

    expect(ordered.map((u) => u.username)).toEqual([
      "bob",
      "diana",
      "alice",
      "charlie",
    ]);
  });

  it("should select with multi-column ORDER BY mixed directions", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "alice", type: "user" }),
        createTestUser({ username: "bob", type: "admin" }),
        createTestUser({ username: "charlie", type: "user" }),
        createTestUser({ username: "diana", type: "admin" }),
      ]);

    // Order by type ASC, then username DESC
    const ordered = await db
      .from(schema.Users)
      .select({ username: schema.Users.username, type: schema.Users.type })
      .orderBy([asc(schema.Users.type), desc(schema.Users.username)]);

    expect(ordered.map((u) => u.username)).toEqual([
      "diana",
      "bob",
      "charlie",
      "alice",
    ]);
  });

  it("should return empty array when no rows match", async () => {
    const result = await db
      .from(schema.Users)
      .select()
      .where(eq(schema.Users.username, "nonexistent"));

    expect(result).toEqual([]);
  });

  it("should handle nullable columns correctly", async () => {
    await db.insert(schema.Users).values({
      username: "nulltest",
      email: null,
      type: "user",
      status: "active",
      role: "user",
    });

    const result = await db
      .from(schema.Users)
      .select({ email: schema.Users.email })
      .where(eq(schema.Users.username, "nulltest"));

    expect(result).toHaveLength(1);
    expect(result[0].email).toBeNull();
  });

  it("should select from multiple tables independently", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await db.insert(schema.Posts).values({
      userId: user.id,
      title: "Test Post",
      content: "Test Content",
    });

    const users = await db.from(schema.Users).select();
    const posts = await db.from(schema.Posts).select();

    expect(users).toHaveLength(1);
    expect(posts).toHaveLength(1);
    expect(posts[0].userId).toEqual(user.id);
  });

  // =========================================================================
  // DISTINCT ON tests
  // =========================================================================

  describe("distinctOn", () => {
    it("should return distinct rows based on a single column", async () => {
      // Insert users with duplicate types
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "admin1", type: "admin" }),
          createTestUser({ username: "admin2", type: "admin" }),
          createTestUser({ username: "user1", type: "user" }),
          createTestUser({ username: "user2", type: "user" }),
        ]);

      const result = await db
        .from(schema.Users)
        .distinctOn(schema.Users.type)
        .select({ type: schema.Users.type, username: schema.Users.username })
        .orderBy([asc(schema.Users.type), asc(schema.Users.username)]);

      // DISTINCT ON (type) should return one row per type
      expect(result).toHaveLength(2);
      const types = result.map((r) => r.type);
      expect(types.sort()).toEqual(["admin", "user"]);
    });

    it("should return distinct rows based on multiple columns", async () => {
      await db.insert(schema.Users).values([
        createTestUser({ username: "alice", type: "admin", status: "active" }),
        createTestUser({ username: "bob", type: "admin", status: "active" }),
        createTestUser({
          username: "charlie",
          type: "admin",
          status: "inactive",
        }),
        createTestUser({ username: "dave", type: "user", status: "active" }),
      ]);

      const result = await db
        .from(schema.Users)
        .distinctOn([schema.Users.type, schema.Users.status])
        .select({
          type: schema.Users.type,
          status: schema.Users.status,
          username: schema.Users.username,
        })
        .orderBy([
          asc(schema.Users.type),
          asc(schema.Users.status),
          asc(schema.Users.username),
        ]);

      // DISTINCT ON (type, status) should return one row per (type, status) combo
      expect(result).toHaveLength(3);
    });

    it("should work with where clause", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "admin1", type: "admin" }),
          createTestUser({ username: "admin2", type: "admin" }),
          createTestUser({ username: "user1", type: "user" }),
        ]);

      const result = await db
        .from(schema.Users)
        .distinctOn(schema.Users.type)
        .select({ type: schema.Users.type, username: schema.Users.username })
        .where(eq(schema.Users.type, "admin"))
        .orderBy(asc(schema.Users.type));

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("admin");
    });

    it("should return empty array when no rows match", async () => {
      const result = await db
        .from(schema.Users)
        .distinctOn(schema.Users.type)
        .select()
        .orderBy(asc(schema.Users.type));

      expect(result).toEqual([]);
    });
  });
});
