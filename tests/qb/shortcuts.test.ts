import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import { database, defineConfig, eq } from "durcno";
import { PgConnector } from "durcno/connectors/pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  cleanDatabase,
  createTestPost,
  createTestUser,
  generateMigrationsDirPath,
  runDurcnoCli,
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
} from "./setup";

describe("Shortcuts ($count, $exists, $first, $sum, $avg, $min, $max, $distinct, $insertReturning)", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  const migrationsDirName = generateMigrationsDirPath("shortcuts");

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

  // ==========================================================
  // $count tests
  // ==========================================================
  describe("$count", () => {
    it("should count all rows in an empty table", async () => {
      const count = await db.$count(schema.Users);
      expect(count).toBe(0);
    });

    it("should count all rows in a table", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "user1" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "user2" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "user3" }));

      const count = await db.$count(schema.Users);
      expect(count).toBe(3);
    });

    it("should count rows with where clause", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "Dan", email: "dan@test.com" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "Alice", email: "alice@test.com" }));

      const count = await db.$count(
        schema.Users,
        eq(schema.Users.email, "dan@test.com"),
      );
      expect(count).toBe(1);
    });

    it("should count rows filtered by enum column", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "admin1", type: "admin" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "user1", type: "user" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "user2", type: "user" }));

      const adminCount = await db.$count(
        schema.Users,
        eq(schema.Users.type, "admin"),
      );
      expect(adminCount).toBe(1);

      const userCount = await db.$count(
        schema.Users,
        eq(schema.Users.type, "user"),
      );
      expect(userCount).toBe(2);
    });
  });

  // ==========================================================
  // $exists tests
  // ==========================================================
  describe("$exists", () => {
    it("should return false for empty table", async () => {
      const exists = await db.$exists(schema.Users);
      expect(exists).toBe(false);
    });

    it("should return true when rows exist", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "test" }));
      const exists = await db.$exists(schema.Users);
      expect(exists).toBe(true);
    });

    it("should return true when rows match where clause", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "admin1", type: "admin" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "user1", type: "user" }));

      const adminExists = await db.$exists(
        schema.Users,
        eq(schema.Users.type, "admin"),
      );
      expect(adminExists).toBe(true);
    });

    it("should return false when no rows match where clause", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "user1", type: "user" }));

      const adminExists = await db.$exists(
        schema.Users,
        eq(schema.Users.type, "admin"),
      );
      expect(adminExists).toBe(false);
    });

    it("should work with then/catch pattern", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "test" }));

      const exists = await new Promise<boolean>((resolve, reject) => {
        db.$exists(schema.Users).then(resolve, reject);
      });

      expect(exists).toBe(true);
    });
  });

  // ==========================================================
  // $first tests
  // ==========================================================
  describe("$first", () => {
    it("should return null for empty table", async () => {
      const first = await db.$first(schema.Users);
      expect(first).toBeNull();
    });

    it("should return first row", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "first_user" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "second_user" }));

      const first = await db.$first(schema.Users);
      expect(first).not.toBeNull();
      expect(first?.username).toBe("first_user");
    });

    it("should return first matching row with where clause", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "admin1", type: "admin" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "user1", type: "user" }));

      const firstAdmin = await db.$first(
        schema.Users,
        eq(schema.Users.type, "admin"),
      );
      expect(firstAdmin).not.toBeNull();
      expect(firstAdmin?.username).toBe("admin1");
      expect(firstAdmin?.type).toBe("admin");
    });

    it("should return null when no rows match where clause", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "user1", type: "user" }));

      const firstAdmin = await db.$first(
        schema.Users,
        eq(schema.Users.type, "admin"),
      );
      expect(firstAdmin).toBeNull();
    });

    it("should include all columns in result", async () => {
      await db.insert(schema.Users).values(
        createTestUser({
          username: "test",
          email: "test@example.com",
          type: "admin",
        }),
      );

      const first = await db.$first(schema.Users);
      expect(first).toHaveProperty("id");
      expect(first).toHaveProperty("username");
      expect(first).toHaveProperty("email");
      expect(first).toHaveProperty("type");
      expect(first).toHaveProperty("createdAt");
    });
  });

  // ==========================================================
  // $sum tests
  // ==========================================================
  describe("$sum", () => {
    it("should return null for empty table", async () => {
      const sum = await db.$sum(schema.Posts, schema.Posts.viewCount);
      expect(sum).toBeNull();
    });

    it("should sum column values", async () => {
      const user = await db.$insertReturning(
        schema.Users,
        createTestUser({ username: "test" }),
      );
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 10 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 20 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 30 }));

      const sum = await db.$sum(schema.Posts, schema.Posts.viewCount);
      expect(sum).toBe(60);
    });

    it("should sum with where clause", async () => {
      const user = await db.$insertReturning(
        schema.Users,
        createTestUser({ username: "test" }),
      );
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "A", viewCount: 10 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "A", viewCount: 20 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "B", viewCount: 100 }));

      const sum = await db.$sum(
        schema.Posts,
        schema.Posts.viewCount,
        eq(schema.Posts.title, "A"),
      );
      expect(sum).toBe(30);
    });
  });

  // ==========================================================
  // $avg tests
  // ==========================================================
  describe("$avg", () => {
    it("should return null for empty table", async () => {
      const avg = await db.$avg(schema.Posts, schema.Posts.viewCount);
      expect(avg).toBeNull();
    });

    it("should calculate average", async () => {
      const user = await db.$insertReturning(
        schema.Users,
        createTestUser({ username: "test" }),
      );
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 10 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 20 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 30 }));

      const avg = await db.$avg(schema.Posts, schema.Posts.viewCount);
      expect(avg).toBe(20);
    });

    it("should calculate average with where clause", async () => {
      const user = await db.$insertReturning(
        schema.Users,
        createTestUser({ username: "test" }),
      );
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "A", viewCount: 10 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "A", viewCount: 30 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "B", viewCount: 1000 }));

      const avg = await db.$avg(
        schema.Posts,
        schema.Posts.viewCount,
        eq(schema.Posts.title, "A"),
      );
      expect(avg).toBe(20);
    });
  });

  // ==========================================================
  // $min tests
  // ==========================================================
  describe("$min", () => {
    it("should return null for empty table", async () => {
      const min = await db.$min(schema.Posts, schema.Posts.viewCount);
      expect(min).toBeNull();
    });

    it("should find minimum value", async () => {
      const user = await db.$insertReturning(
        schema.Users,
        createTestUser({ username: "test" }),
      );
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 50 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 10 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 100 }));

      const min = await db.$min(schema.Posts, schema.Posts.viewCount);
      expect(min).toBe(10);
    });

    it("should find minimum with where clause", async () => {
      const user = await db.$insertReturning(
        schema.Users,
        createTestUser({ username: "test" }),
      );
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "A", viewCount: 50 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "A", viewCount: 30 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "B", viewCount: 1 }));

      const min = await db.$min(
        schema.Posts,
        schema.Posts.viewCount,
        eq(schema.Posts.title, "A"),
      );
      expect(min).toBe(30);
    });
  });

  // ==========================================================
  // $max tests
  // ==========================================================
  describe("$max", () => {
    it("should return null for empty table", async () => {
      const max = await db.$max(schema.Posts, schema.Posts.viewCount);
      expect(max).toBeNull();
    });

    it("should find maximum value", async () => {
      const user = await db.$insertReturning(
        schema.Users,
        createTestUser({ username: "test" }),
      );
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 50 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 10 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 100 }));

      const max = await db.$max(schema.Posts, schema.Posts.viewCount);
      expect(max).toBe(100);
    });

    it("should find maximum with where clause", async () => {
      const user = await db.$insertReturning(
        schema.Users,
        createTestUser({ username: "test" }),
      );
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "A", viewCount: 50 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "A", viewCount: 30 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "B", viewCount: 1000 }));

      const max = await db.$max(
        schema.Posts,
        schema.Posts.viewCount,
        eq(schema.Posts.title, "A"),
      );
      expect(max).toBe(50);
    });
  });

  // ==========================================================
  // $distinct tests
  // ==========================================================
  describe("$distinct", () => {
    it("should return empty array for empty table", async () => {
      const distinct = await db.$distinct(schema.Users, schema.Users.username);
      expect(distinct).toEqual([]);
    });

    it("should return distinct values", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "Alice", type: "user" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "Bob", type: "user" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "Charlie", type: "admin" }));

      const distinctUsernames = await db.$distinct(
        schema.Users,
        schema.Users.username,
      );
      expect(distinctUsernames.sort()).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it("should return distinct enum values", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "user1", type: "user" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "user2", type: "user" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "admin1", type: "admin" }));

      const distinctTypes = await db.$distinct(schema.Users, schema.Users.type);
      expect(distinctTypes.sort()).toEqual(["admin", "user"]);
    });

    it("should return distinct values with where clause", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "admin1", type: "admin" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "admin2", type: "admin" }));
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "user1", type: "user" }));

      const distinctAdminUsernames = await db.$distinct(
        schema.Users,
        schema.Users.username,
        eq(schema.Users.type, "admin"),
      );
      expect(distinctAdminUsernames.sort()).toEqual(["admin1", "admin2"]);
    });

    it("should return distinct numeric values", async () => {
      const user = await db.$insertReturning(
        schema.Users,
        createTestUser({ username: "test" }),
      );
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 10 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 20 }));
      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { viewCount: 10 })); // duplicate

      const distinctViewCounts = await db.$distinct(
        schema.Posts,
        schema.Posts.viewCount,
      );
      expect(distinctViewCounts.sort((a, b) => a - b)).toEqual([10, 20]);
    });
  });

  // ==========================================================
  // $insertReturning tests
  // ==========================================================
  describe("$insertReturning", () => {
    it("should insert and return the row with generated id", async () => {
      const inserted = await db.$insertReturning(
        schema.Users,
        createTestUser({ username: "newuser", email: "new@test.com" }),
      );

      expect(inserted.id).toBeDefined();
      expect(typeof inserted.id).toBe("number");
      expect(inserted.username).toBe("newuser");
      expect(inserted.email).toBe("new@test.com");
    });

    it("should return all columns including defaults", async () => {
      const inserted = await db.$insertReturning(
        schema.Users,
        createTestUser({ username: "test", type: "admin" }),
      );

      expect(inserted.id).toBeDefined();
      expect(inserted.username).toBe("test");
      expect(inserted.type).toBe("admin");
      expect(inserted.createdAt).toBeInstanceOf(Date);
    });

    it("should work with Posts table", async () => {
      const user = await db.$insertReturning(
        schema.Users,
        createTestUser({ username: "test" }),
      );

      const post = await db.$insertReturning(
        schema.Posts,
        createTestPost(user.id, { title: "Test Post", viewCount: 5 }),
      );

      expect(post.id).toBeDefined();
      expect(post.userId).toBe(user.id);
      expect(post.title).toBe("Test Post");
      expect(post.viewCount).toBe(5);
      expect(post.createdAt).toBeInstanceOf(Date);
    });

    it("should handle nullable columns correctly", async () => {
      const inserted = await db.$insertReturning(schema.Users, {
        username: "nulltest",
        status: "active",
        role: "user",
        type: "user",
        // email is not provided, should be null
      });

      expect(inserted.email).toBeNull();
    });

    it("should work with then/catch pattern", async () => {
      const inserted = await new Promise<
        Awaited<ReturnType<typeof db.$insertReturning<typeof schema.Users>>>
      >((resolve, reject) => {
        db.$insertReturning(
          schema.Users,
          createTestUser({ username: "promisetest" }),
        ).then(resolve, reject);
      });

      expect(inserted.username).toBe("promisetest");
    });
  });
});
