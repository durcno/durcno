import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import { type $Client, database, defineConfig, eq } from "durcno";
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

describe("DELETE queries", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("delete");

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

  it("should delete a single row", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await db.delete(schema.Users).where(eq(schema.Users.id, user.id));

    const users = await db.from(schema.Users).select();
    expect(users).toHaveLength(0);
  });

  it("should delete multiple rows with WHERE clause", async () => {
    await db
      .insert(schema.Users)
      .values([
        createTestUser({ type: "user" }),
        createTestUser({ type: "user" }),
        createTestUser({ type: "admin" }),
      ]);

    await db.delete(schema.Users).where(eq(schema.Users.type, "user"));

    const remaining = await db.from(schema.Users).select();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe("admin");
  });

  it("should delete with RETURNING clause", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "todelete" }))
      .returning({ id: true });

    const deleted = await db
      .delete(schema.Users)
      .where(eq(schema.Users.id, user.id))
      .returning({ id: true, username: true });

    await db.delete(schema.Users).where(eq(schema.Users.id, user.id));

    expect(deleted).toHaveLength(1);
    expect(deleted[0].username).toBe("todelete");

    const remaining = await db.from(schema.Users).select();
    expect(remaining).toHaveLength(0);
  });

  it("should not delete rows when WHERE clause matches nothing", async () => {
    await db.insert(schema.Users).values([createTestUser(), createTestUser()]);

    await db
      .delete(schema.Users)
      .where(eq(schema.Users.username, "nonexistent"));

    const users = await db.from(schema.Users).select();
    expect(users).toHaveLength(2);
  });

  it("should delete all rows when no WHERE clause", async () => {
    await db
      .insert(schema.Users)
      .values([createTestUser(), createTestUser(), createTestUser()]);

    await db.delete(schema.Users);

    const users = await db.from(schema.Users).select();
    expect(users).toHaveLength(0);
  });

  it("should cascade delete with foreign keys", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser())
      .returning({ id: true });

    await db.insert(schema.Posts).values([
      {
        userId: user.id,
        title: "Post 1",
        content: "Content 1",
      },
      {
        userId: user.id,
        title: "Post 2",
        content: "Content 2",
      },
    ]);

    // Delete user (should cascade to posts if FK is set up with CASCADE)
    await db.delete(schema.Users).where(eq(schema.Users.id, user.id));

    const users = await db.from(schema.Users).select();
    expect(users).toHaveLength(0);

    // Check if posts were also deleted (depends on FK constraint)
    const posts = await db.from(schema.Posts).select();
    // This will pass if CASCADE is configured, otherwise it would fail
    expect(posts).toHaveLength(0);
  });

  it("should delete and return all fields with RETURNING *", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "fulldelete" }))
      .returning({ id: true });

    const deleted = await db
      .delete(schema.Users)
      .where(eq(schema.Users.id, user.id))
      .returning({
        id: true,
        username: true,
        email: true,
      });

    await db.delete(schema.Users).where(eq(schema.Users.id, user.id));

    expect(deleted).toHaveLength(1);
    expect(deleted[0]).toHaveProperty("id");
    expect(deleted[0].username).toBe("fulldelete");
    expect(deleted[0]).toHaveProperty("email");
  });

  it("should handle deleting from empty table", async () => {
    await db.delete(schema.Users).where(eq(schema.Users.username, "anyone"));

    const users = await db.from(schema.Users).select();
    expect(users).toHaveLength(0);
  });
});
