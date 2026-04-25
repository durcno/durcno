import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import { type $Client, database, defineConfig, eq } from "durcno";
import { pg } from "durcno/connectors/pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  cleanDatabase,
  createTestComment,
  createTestPost,
  createTestUser,
  generateMigrationsDirPath,
  runDurcnoCli,
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
} from "./setup";

describe("SELECT with INNER JOIN", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("joins");

  beforeAll(async () => {
    containerInfo = await startPostgresContainer({
      image: "postgres:16-alpine",
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
    await cleanDatabase(client);
  });

  afterAll(async () => {
    if (client) await client.close();
    if (db) await db.close();
    if (container) await stopPostgresContainer(container);
  });

  it("should select with inner join between Users and Posts", async () => {
    // Insert test user
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "author1" }))
      .returning({ id: true });

    // Insert test post for the user
    await db
      .insert(schema.Posts)
      .values(createTestPost(user.id, { title: "My First Post" }));

    // Select with inner join
    const result = await db
      .from(schema.Users)
      .innerJoin(schema.Posts, eq(schema.Posts.userId, schema.Users.id))
      .select({
        username: schema.Users.username,
        postTitle: schema.Posts.title,
      });

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("author1");
    expect(result[0].postTitle).toBe("My First Post");
  });

  it("should return multiple rows when user has multiple posts", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "prolific_author" }))
      .returning({ id: true });

    await db
      .insert(schema.Posts)
      .values([
        createTestPost(user.id, { title: "Post One" }),
        createTestPost(user.id, { title: "Post Two" }),
        createTestPost(user.id, { title: "Post Three" }),
      ]);

    const result = await db
      .from(schema.Users)
      .innerJoin(schema.Posts, eq(schema.Posts.userId, schema.Users.id))
      .select({
        username: schema.Users.username,
        postTitle: schema.Posts.title,
      });

    expect(result).toHaveLength(3);
    expect(result.every((r) => r.username === "prolific_author")).toBe(true);
  });

  it("should exclude users without posts in inner join", async () => {
    // Insert user with post
    const [userWithPost] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "has_posts" }))
      .returning({ id: true });

    // Insert user without post
    await db
      .insert(schema.Users)
      .values(createTestUser({ username: "no_posts" }));

    await db
      .insert(schema.Posts)
      .values(createTestPost(userWithPost.id, { title: "A Post" }));

    const result = await db
      .from(schema.Users)
      .innerJoin(schema.Posts, eq(schema.Posts.userId, schema.Users.id))
      .select({
        username: schema.Users.username,
      });

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("has_posts");
  });

  it("should work with WHERE clause after inner join", async () => {
    const [user1] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "user_active", type: "admin" }))
      .returning({ id: true });

    const [user2] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "user_regular", type: "user" }))
      .returning({ id: true });

    await db
      .insert(schema.Posts)
      .values([
        createTestPost(user1.id, { title: "Admin Post" }),
        createTestPost(user2.id, { title: "User Post" }),
      ]);

    const result = await db
      .from(schema.Users)
      .innerJoin(schema.Posts, eq(schema.Posts.userId, schema.Users.id))
      .select({
        username: schema.Users.username,
        postTitle: schema.Posts.title,
      })
      .where(eq(schema.Users.type, "admin"));

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("user_active");
    expect(result[0].postTitle).toBe("Admin Post");
  });

  it("should select columns from both tables in join", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "full_select_user" }))
      .returning({ id: true });

    await db
      .insert(schema.Posts)
      .values(
        createTestPost(user.id, { title: "Full Select Post", viewCount: 42 }),
      );

    const result = await db
      .from(schema.Users)
      .innerJoin(schema.Posts, eq(schema.Posts.userId, schema.Users.id))
      .select({
        username: schema.Users.username,
        email: schema.Users.email,
        postTitle: schema.Posts.title,
        viewCount: schema.Posts.viewCount,
      });

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("full_select_user");
    expect(result[0].postTitle).toBe("Full Select Post");
    expect(result[0].viewCount).toBe(42);
  });

  it("should handle inner join with Posts and Comments", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "commenter" }))
      .returning({ id: true });

    const [post] = await db
      .insert(schema.Posts)
      .values(createTestPost(user.id, { title: "Post with Comments" }))
      .returning({ id: true });

    await db
      .insert(schema.Comments)
      .values(createTestComment(post.id, user.id, { body: "Great post!" }));

    const result = await db
      .from(schema.Posts)
      .innerJoin(schema.Comments, eq(schema.Comments.postId, schema.Posts.id))
      .select({
        postTitle: schema.Posts.title,
        commentBody: schema.Comments.body,
      });

    expect(result).toHaveLength(1);
    expect(result[0].postTitle).toBe("Post with Comments");
    expect(result[0].commentBody).toBe("Great post!");
  });

  it("should return empty array when no matching rows exist", async () => {
    // Insert user without any posts
    await db
      .insert(schema.Users)
      .values(createTestUser({ username: "lonely_user" }));

    const result = await db
      .from(schema.Users)
      .innerJoin(schema.Posts, eq(schema.Posts.userId, schema.Users.id))
      .select();

    expect(result).toEqual([]);
  });

  // Double inner join tests
  it("should select with double inner join: Users -> Posts -> Comments", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "blogger" }))
      .returning({ id: true });

    const [post] = await db
      .insert(schema.Posts)
      .values(createTestPost(user.id, { title: "Interesting Article" }))
      .returning({ id: true });

    await db
      .insert(schema.Comments)
      .values(createTestComment(post.id, user.id, { body: "Nice article!" }));

    const result = await db
      .from(schema.Users)
      .innerJoin(schema.Posts, eq(schema.Posts.userId, schema.Users.id))
      .innerJoin(schema.Comments, eq(schema.Comments.postId, schema.Posts.id))
      .select({
        username: schema.Users.username,
        postTitle: schema.Posts.title,
        commentBody: schema.Comments.body,
      });

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("blogger");
    expect(result[0].postTitle).toBe("Interesting Article");
    expect(result[0].commentBody).toBe("Nice article!");
  });

  it("should return multiple rows with double inner join when post has multiple comments", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "popular_author" }))
      .returning({ id: true });

    const [post] = await db
      .insert(schema.Posts)
      .values(createTestPost(user.id, { title: "Viral Post" }))
      .returning({ id: true });

    await db
      .insert(schema.Comments)
      .values([
        createTestComment(post.id, user.id, { body: "Comment 1" }),
        createTestComment(post.id, user.id, { body: "Comment 2" }),
        createTestComment(post.id, user.id, { body: "Comment 3" }),
      ]);

    const result = await db
      .from(schema.Users)
      .innerJoin(schema.Posts, eq(schema.Posts.userId, schema.Users.id))
      .innerJoin(schema.Comments, eq(schema.Comments.postId, schema.Posts.id))
      .select({
        username: schema.Users.username,
        postTitle: schema.Posts.title,
        commentBody: schema.Comments.body,
      });

    expect(result).toHaveLength(3);
    expect(result.every((r) => r.username === "popular_author")).toBe(true);
    expect(result.every((r) => r.postTitle === "Viral Post")).toBe(true);
  });

  it("should filter double inner join results with WHERE clause", async () => {
    const [admin] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "admin_poster", type: "admin" }))
      .returning({ id: true });

    const [regularUser] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "regular_poster", type: "user" }))
      .returning({ id: true });

    const [adminPost] = await db
      .insert(schema.Posts)
      .values(createTestPost(admin.id, { title: "Admin Announcement" }))
      .returning({ id: true });

    const [regularPost] = await db
      .insert(schema.Posts)
      .values(createTestPost(regularUser.id, { title: "Regular Post" }))
      .returning({ id: true });

    await db.insert(schema.Comments).values([
      createTestComment(adminPost.id, admin.id, { body: "Admin comment" }),
      createTestComment(regularPost.id, regularUser.id, {
        body: "User comment",
      }),
    ]);

    const result = await db
      .from(schema.Users)
      .innerJoin(schema.Posts, eq(schema.Posts.userId, schema.Users.id))
      .innerJoin(schema.Comments, eq(schema.Comments.postId, schema.Posts.id))
      .select({
        username: schema.Users.username,
        postTitle: schema.Posts.title,
        commentBody: schema.Comments.body,
      })
      .where(eq(schema.Users.type, "admin"));

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("admin_poster");
    expect(result[0].postTitle).toBe("Admin Announcement");
    expect(result[0].commentBody).toBe("Admin comment");
  });

  it("should exclude rows in double inner join when intermediate table has no match", async () => {
    const [userWithFullChain] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "full_chain" }))
      .returning({ id: true });

    const [userWithPostOnly] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "post_only" }))
      .returning({ id: true });

    const [postWithComment] = await db
      .insert(schema.Posts)
      .values(
        createTestPost(userWithFullChain.id, { title: "Post With Comment" }),
      )
      .returning({ id: true });

    // This post has no comments, so it won't appear in double inner join
    await db
      .insert(schema.Posts)
      .values(
        createTestPost(userWithPostOnly.id, { title: "Post Without Comment" }),
      );

    await db.insert(schema.Comments).values(
      createTestComment(postWithComment.id, userWithFullChain.id, {
        body: "A comment",
      }),
    );

    const result = await db
      .from(schema.Users)
      .innerJoin(schema.Posts, eq(schema.Posts.userId, schema.Users.id))
      .innerJoin(schema.Comments, eq(schema.Comments.postId, schema.Posts.id))
      .select({
        username: schema.Users.username,
        postTitle: schema.Posts.title,
      });

    expect(result).toHaveLength(1);
    expect(result[0].username).toBe("full_chain");
    expect(result[0].postTitle).toBe("Post With Comment");
  });
});
