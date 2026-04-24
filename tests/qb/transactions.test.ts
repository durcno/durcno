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

describe("Transactions", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  const migrationsDirName = generateMigrationsDirPath("transactions");

  beforeAll(async () => {
    containerInfo = await startPostgresContainer({
      image: "postgres:18-alpine",
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

  it("should commit successful transaction", async () => {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.Users)
        .values(createTestUser({ username: "txuser" }))
        .returning({ id: true });

      await tx.insert(schema.Posts).values({
        userId: user.id,
        title: "Transaction Post",
        content: "Transaction Content",
      });

      return user.id;
    });

    expect(result).toBeDefined();

    // Verify data was committed
    const users = await db.from(schema.Users).select();
    const posts = await db.from(schema.Posts).select();

    expect(users).toHaveLength(1);
    expect(posts).toHaveLength(1);
    expect(users[0].username).toBe("txuser");
  });

  it("should rollback transaction on error", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx
          .insert(schema.Users)
          .values(createTestUser({ username: "rollbackuser" }));

        // Force an error
        throw new Error("Intentional rollback");
      }),
    ).rejects.toThrow("Intentional rollback");

    // Verify no data was committed
    const users = await db.from(schema.Users).select();
    expect(users).toHaveLength(0);
  });

  it("should rollback on constraint violation", async () => {
    const [existingUser] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "uniqueuser" }))
      .returning({ id: true });

    await expect(
      db.transaction(async (tx) => {
        // Try to insert duplicate username (violates unique constraint)
        await tx.insert(schema.Users).values({
          username: "uniqueuser", // Duplicate!
          type: "user",
          status: "active",
          role: "user",
        });
      }),
    ).rejects.toThrow();

    // Verify original user still exists
    const users = await db.from(schema.Users).select();
    expect(users).toHaveLength(1);
    expect(users[0].id).toEqual(existingUser.id);
  });

  it("should support multiple operations in transaction", async () => {
    await db.transaction(async (tx) => {
      const [user1] = await tx
        .insert(schema.Users)
        .values(createTestUser({ username: "user1" }))
        .returning({ id: true });

      const [user2] = await tx
        .insert(schema.Users)
        .values(createTestUser({ username: "user2" }))
        .returning({ id: true });

      await tx.insert(schema.Posts).values([
        { userId: user1.id, title: "Post 1", content: "Content 1" },
        { userId: user2.id, title: "Post 2", content: "Content 2" },
      ]);

      await tx
        .update(schema.Users)
        .set({ score: 100 })
        .where(eq(schema.Users.id, user1.id));
    });

    const users = await db.from(schema.Users).select();
    const posts = await db.from(schema.Posts).select();

    expect(users).toHaveLength(2);
    expect(posts).toHaveLength(2);
    expect(users.find((u) => u.username === "user1")?.score).toBe(100);
  });

  it("should support SELECT queries in transaction", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await db.transaction(async (tx) => {
      const users = await tx.from(schema.Users).select();
      expect(users).toHaveLength(1);

      await tx.insert(schema.Posts).values({
        userId: user.id,
        title: "Test",
        content: "Test",
      });

      const posts = await tx.from(schema.Posts).select();
      expect(posts).toHaveLength(1);
    });
  });

  it("should support DELETE in transaction", async () => {
    const [user1] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "delete1" }))
      .returning({ id: true });

    const [user2] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "delete2" }))
      .returning({ id: true });

    await db.transaction(async (tx) => {
      await tx.delete(schema.Users).where(eq(schema.Users.id, user1.id));

      const remaining = await tx.from(schema.Users).select();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toEqual(user2.id);
    });

    // Verify deletion was committed
    const users = await db.from(schema.Users).select();
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe("delete2");
  });

  it("should return value from transaction", async () => {
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.Users)
        .values(createTestUser())
        .returning({ id: true, username: true });

      return {
        userId: user.id,
        userName: user.username,
      };
    });

    expect(result).toHaveProperty("userId");
    expect(result).toHaveProperty("userName");
  });

  it("should isolate transaction from main connection", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await db.transaction(async (tx) => {
      // Insert in transaction
      await tx.insert(schema.Posts).values({
        userId: user.id,
        title: "TX Post",
        content: "TX Content",
      });

      // Query from main connection (should not see uncommitted data from tx)
      const mainPosts = await db.from(schema.Posts).select();
      expect(mainPosts).toHaveLength(0);

      // Query from transaction (should see its own changes)
      const txPosts = await tx.from(schema.Posts).select();
      expect(txPosts).toHaveLength(1);
    });

    // After commit, main connection should see the data
    const posts = await db.from(schema.Posts).select();
    expect(posts).toHaveLength(1);
  });

  it("should handle nested inserts in transaction", async () => {
    await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.Users)
        .values(createTestUser())
        .returning({ id: true });

      const [post] = await tx
        .insert(schema.Posts)
        .values({
          userId: user.id,
          title: "Post",
          content: "Content",
        })
        .returning({ id: true });

      await tx.insert(schema.Comments).values({
        postId: post.id,
        userId: user.id,
        body: "Comment",
      });
    });

    const users = await db.from(schema.Users).select();
    const posts = await db.from(schema.Posts).select();
    const comments = await db.from(schema.Comments).select();

    expect(users).toHaveLength(1);
    expect(posts).toHaveLength(1);
    expect(comments).toHaveLength(1);
  });

  it("should rollback all changes on partial failure", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await expect(
      db.transaction(async (tx) => {
        await tx.insert(schema.Posts).values([
          { userId: user.id, title: "Post 1", content: "Content 1" },
          { userId: user.id, title: "Post 2", content: "Content 2" },
        ]);

        // Insert one more post
        await tx.insert(schema.Posts).values({
          userId: user.id,
          title: "Post 3",
          content: "Content 3",
        });

        // Now cause an error
        throw new Error("Rollback all posts");
      }),
    ).rejects.toThrow("Rollback all posts");

    // Verify no posts were committed
    const posts = await db.from(schema.Posts).select();
    expect(posts).toHaveLength(0);
  });
});
