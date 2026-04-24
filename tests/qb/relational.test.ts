import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import { asc, database, defineConfig, desc, eq } from "durcno";
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

describe("Relational queries", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  const migrationsDirName = generateMigrationsDirPath("relational");

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

  describe("findMany", () => {
    it("should find all records without filters", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "user1" }),
          createTestUser({ username: "user2" }),
          createTestUser({ username: "user3" }),
        ]);

      const users = await db.query(schema.Users).findMany({});

      expect(users).toHaveLength(3);
      expect(users.every((u) => u.id && u.username)).toBe(true);
    });

    it("should select specific columns", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "testuser" }));

      const users = await db.query(schema.Users).findMany({
        columns: {
          id: true,
          username: true,
        },
      });

      expect(users).toHaveLength(1);
      expect(users[0]).toHaveProperty("id");
      expect(users[0]).toHaveProperty("username");
      expect(users[0]).not.toHaveProperty("email");
      expect(users[0]).not.toHaveProperty("type");
    });

    it("should exclude columns using false", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "testuser" }));

      const users = await db.query(schema.Users).findMany({
        columns: {
          createdAt: false,
          updatedAt: false,
        },
      });

      expect(users).toHaveLength(1);
      expect(users[0]).not.toHaveProperty("createdAt");
      expect(users[0]).not.toHaveProperty("updatedAt");
      expect(users[0]).toHaveProperty("id");
      expect(users[0]).toHaveProperty("username");
    });

    it("should filter with WHERE clause", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ type: "admin" }),
          createTestUser({ type: "user" }),
          createTestUser({ type: "user" }),
        ]);

      const admins = await db.query(schema.Users).findMany({
        where: eq(schema.Users.type, "admin"),
      });

      expect(admins).toHaveLength(1);
      expect(admins[0].type).toBe("admin");
    });

    it("should load one-to-one relation (profile)", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser())
        .returning({ id: true });

      await db.insert(schema.UserProfiles).values({
        userId: user.id,
        bio: "Test bio",
        avatarUrl: "https://example.com/avatar.jpg",
      });

      const users = await db.query(schema.Users).findMany({
        columns: {
          id: true,
          username: true,
        },
        with: {
          profile: {
            columns: {
              bio: true,
              avatarUrl: true,
            },
          },
        },
      });

      expect(users).toHaveLength(1);
      expect(users[0].profile).toBeDefined();
      expect(users[0].profile?.bio).toBe("Test bio");
      expect(users[0].profile?.avatarUrl).toBe(
        "https://example.com/avatar.jpg",
      );
    });

    it("should load one-to-many relation (posts)", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser())
        .returning({ id: true });

      await db
        .insert(schema.Posts)
        .values([
          createTestPost(user.id, { title: "Post 1" }),
          createTestPost(user.id, { title: "Post 2" }),
          createTestPost(user.id, { title: "Post 3" }),
        ]);

      const users = await db.query(schema.Users).findMany({
        columns: {
          id: true,
          username: true,
        },
        with: {
          posts: {
            columns: {
              id: true,
              title: true,
            },
          },
        },
      });

      expect(users).toHaveLength(1);
      expect(users[0].posts).toHaveLength(3);
      expect(users[0].posts.map((p) => p.title)).toContain("Post 1");
    });

    it("should load nested relations", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser())
        .returning({ id: true });

      const [post] = await db
        .insert(schema.Posts)
        .values(createTestPost(user.id))
        .returning({ id: true });

      await db
        .insert(schema.Comments)
        .values([
          createTestComment(post.id, user.id, { body: "Comment 1" }),
          createTestComment(post.id, user.id, { body: "Comment 2" }),
        ]);

      const posts = await db.query(schema.Posts).findMany({
        columns: {
          id: true,
          title: true,
        },
        with: {
          comments: {
            columns: {
              id: true,
              body: true,
            },
          },
        },
      });

      expect(posts).toHaveLength(1);
      expect(posts[0].comments).toHaveLength(2);
      expect(posts[0].comments.map((c) => c.body)).toContain("Comment 1");
    });

    it("should handle empty relations", async () => {
      await db.insert(schema.Users).values(createTestUser());

      const users = await db.query(schema.Users).findMany({
        with: {
          posts: {},
        },
      });

      expect(users).toHaveLength(1);
      expect(users[0].posts).toEqual([]);
    });

    it("should handle missing one-to-one relation", async () => {
      await db.insert(schema.Users).values(createTestUser());

      const users = await db.query(schema.Users).findMany({
        with: {
          profile: {},
        },
      });

      expect(users).toHaveLength(1);
      expect(users[0].profile).toBeNull();
    });

    it("should support limit and offset", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser(),
          createTestUser(),
          createTestUser(),
          createTestUser(),
        ]);

      const limited = await db.query(schema.Users).findMany({
        limit: 2,
      });

      expect(limited).toHaveLength(2);

      const offset = await db.query(schema.Users).findMany({
        limit: 2,
        offset: 2,
      });

      expect(offset).toHaveLength(2);
    });

    it("should support single column orderBy", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "charlie" }),
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
        ]);

      const users = await db.query(schema.Users).findMany({
        columns: { username: true },
        orderBy: asc(schema.Users.username),
      });

      expect(users.map((u) => u.username)).toEqual(["alice", "bob", "charlie"]);
    });

    it("should support single column orderBy DESC", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "charlie" }),
          createTestUser({ username: "bob" }),
        ]);

      const users = await db.query(schema.Users).findMany({
        columns: { username: true },
        orderBy: desc(schema.Users.username),
      });

      expect(users.map((u) => u.username)).toEqual(["charlie", "bob", "alice"]);
    });

    it("should support multi-column orderBy (array syntax)", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "user" }),
          createTestUser({ username: "bob", type: "admin" }),
          createTestUser({ username: "charlie", type: "user" }),
          createTestUser({ username: "diana", type: "admin" }),
        ]);

      const users = await db.query(schema.Users).findMany({
        columns: { username: true, type: true },
        orderBy: [asc(schema.Users.type), asc(schema.Users.username)],
      });

      expect(users.map((u) => u.username)).toEqual([
        "bob",
        "diana",
        "alice",
        "charlie",
      ]);
    });

    it("should support multi-column orderBy with mixed directions", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "user" }),
          createTestUser({ username: "bob", type: "admin" }),
          createTestUser({ username: "charlie", type: "user" }),
          createTestUser({ username: "diana", type: "admin" }),
        ]);

      const users = await db.query(schema.Users).findMany({
        columns: { username: true, type: true },
        orderBy: [asc(schema.Users.type), desc(schema.Users.username)],
      });

      expect(users.map((u) => u.username)).toEqual([
        "diana",
        "bob",
        "charlie",
        "alice",
      ]);
    });
  });

  describe("findFirst", () => {
    it("should find first record", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "first" }),
          createTestUser({ username: "second" }),
        ]);

      const user = await db.query(schema.Users).findFirst({});

      expect(user).toBeDefined();
      expect(user?.username).toBe("first");
    });

    it("should return null when no records found", async () => {
      const user = await db.query(schema.Users).findFirst({});

      expect(user).toBeNull();
    });

    it("should filter with WHERE clause", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "alice" }),
          createTestUser({ username: "bob" }),
          createTestUser({ username: "charlie" }),
        ]);

      const user = await db.query(schema.Users).findFirst({
        where: eq(schema.Users.username, "bob"),
      });

      expect(user).toBeDefined();
      expect(user?.username).toBe("bob");
    });

    it("should load relations", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser())
        .returning({ id: true });

      await db
        .insert(schema.Posts)
        .values([
          createTestPost(user.id, { title: "Post 1" }),
          createTestPost(user.id, { title: "Post 2" }),
        ]);

      const result = await db.query(schema.Users).findFirst({
        with: {
          posts: {},
        },
      });

      expect(result).toBeDefined();
      expect(result?.posts).toHaveLength(2);
    });

    it("should select specific columns", async () => {
      await db
        .insert(schema.Users)
        .values(createTestUser({ username: "testuser" }));

      const user = await db.query(schema.Users).findFirst({
        columns: {
          id: true,
          username: true,
        },
      });

      expect(user).toBeDefined();
      expect(user).toHaveProperty("id");
      expect(user).toHaveProperty("username");
      expect(user).not.toHaveProperty("email");
    });

    it("should return first matching record when multiple exist", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ type: "admin" }),
          createTestUser({ type: "admin" }),
          createTestUser({ type: "user" }),
        ]);

      const admin = await db.query(schema.Users).findFirst({
        where: eq(schema.Users.type, "admin"),
      });

      expect(admin).toBeDefined();
      expect(admin?.type).toBe("admin");
    });
  });

  describe("Complex relational scenarios", () => {
    it("should load multiple relations on the same query", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser())
        .returning({ id: true });

      await db.insert(schema.UserProfiles).values({
        userId: user.id,
        bio: "Bio",
      });

      await db.insert(schema.Posts).values(createTestPost(user.id));
      await db.insert(schema.Comments).values({
        postId: 1, // bigint columns use number in Durcno
        userId: user.id,
        body: "Comment",
      });

      const users = await db.query(schema.Users).findMany({
        with: {
          profile: {},
          posts: {},
          comments: {},
        },
      });

      expect(users).toHaveLength(1);
      expect(users[0].profile).toBeDefined();
      expect(users[0].posts).toHaveLength(1);
      expect(users[0].comments).toHaveLength(1);
    });

    it("should filter parent and load relations", async () => {
      const [admin] = await db
        .insert(schema.Users)
        .values(createTestUser({ type: "admin" }))
        .returning({ id: true });

      const [regularUser] = await db
        .insert(schema.Users)
        .values(createTestUser({ type: "user" }))
        .returning({ id: true });

      await db
        .insert(schema.Posts)
        .values([
          createTestPost(admin.id, { title: "Admin Post" }),
          createTestPost(regularUser.id, { title: "User Post" }),
        ]);

      const admins = await db.query(schema.Users).findMany({
        where: eq(schema.Users.type, "admin"),
        with: {
          posts: {},
        },
      });

      expect(admins).toHaveLength(1);
      expect(admins[0].posts).toHaveLength(1);
      expect(admins[0].posts[0].title).toBe("Admin Post");
    });
  });

  describe("fk relations", () => {
    it("should load fk relation (author from post)", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "author1" }))
        .returning({ id: true });

      await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "Test Post" }));

      const posts = await db.query(schema.Posts).findMany({
        columns: {
          id: true,
          title: true,
        },
        with: {
          author: {
            columns: {
              id: true,
              username: true,
            },
          },
        },
      });

      expect(posts).toHaveLength(1);
      expect(posts[0].author).toBeDefined();
      expect(posts[0].author?.username).toBe("author1");
    });

    it("should load fk relation with notNull FK column (non-nullable result)", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "article_author" }))
        .returning({ id: true });

      await db.insert(schema.Articles).values({
        title: "Test Article",
        authorId: user.id,
        categoryId: null,
      });

      const articles = await db.query(schema.Articles).findMany({
        with: {
          author: {},
        },
      });

      expect(articles).toHaveLength(1);
      // author should always be defined since authorId is notNull
      expect(articles[0].author).toBeDefined();
      expect(articles[0].author?.username).toBe("article_author");
    });

    it("should load fk relation with nullable FK column (nullable result)", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser())
        .returning({ id: true });

      // Article without category (categoryId is nullable)
      await db.insert(schema.Articles).values({
        title: "Article without category",
        authorId: user.id,
        categoryId: null,
      });

      const articles = await db.query(schema.Articles).findMany({
        with: {
          category: {},
        },
      });

      expect(articles).toHaveLength(1);
      // category should be null since categoryId is null
      expect(articles[0].category).toBeNull();
    });

    it("should load fk relation when nullable FK has a value", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser())
        .returning({ id: true });

      const [category] = await db
        .insert(schema.Categories)
        .values({ name: "Tech" })
        .returning({ id: true });

      await db.insert(schema.Articles).values({
        title: "Article with category",
        authorId: user.id,
        categoryId: category.id,
      });

      const articles = await db.query(schema.Articles).findMany({
        with: {
          category: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      expect(articles).toHaveLength(1);
      expect(articles[0].category).toBeDefined();
      expect(articles[0].category?.name).toBe("Tech");
    });

    it("should load multiple fk relations on the same query", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "multi_fk_author" }))
        .returning({ id: true });

      const [category] = await db
        .insert(schema.Categories)
        .values({ name: "Science" })
        .returning({ id: true });

      await db.insert(schema.Articles).values({
        title: "Multi FK Article",
        authorId: user.id,
        categoryId: category.id,
      });

      const articles = await db.query(schema.Articles).findMany({
        columns: {
          id: true,
          title: true,
        },
        with: {
          author: {
            columns: {
              id: true,
              username: true,
            },
          },
          category: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      expect(articles).toHaveLength(1);
      expect(articles[0].author?.username).toBe("multi_fk_author");
      expect(articles[0].category?.name).toBe("Science");
    });

    it("should load nested fk relations (comment -> post -> author)", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "nested_author" }))
        .returning({ id: true });

      const [post] = await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "Nested Post" }))
        .returning({ id: true });

      await db
        .insert(schema.Comments)
        .values(
          createTestComment(post.id, user.id, { body: "Nested Comment" }),
        );

      const comments = await db.query(schema.Comments).findMany({
        columns: {
          id: true,
          body: true,
        },
        with: {
          post: {
            columns: {
              id: true,
              title: true,
            },
            with: {
              author: {
                columns: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      expect(comments).toHaveLength(1);
      expect(comments[0].post?.title).toBe("Nested Post");
      expect(comments[0].post?.author?.username).toBe("nested_author");
    });
  });

  describe("one relation from FK-owning side (fk-style)", () => {
    it("should load user from UserProfiles via fk relation", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "profile_user" }))
        .returning({ id: true });

      await db.insert(schema.UserProfiles).values({
        userId: user.id,
        bio: "My bio",
        avatarUrl: "https://example.com/avatar.jpg",
      });

      const profiles = await db.query(schema.UserProfiles).findMany({
        columns: {
          id: true,
          bio: true,
        },
        with: {
          user: {
            columns: {
              id: true,
              username: true,
            },
          },
        },
      });

      expect(profiles).toHaveLength(1);
      expect(profiles[0].bio).toBe("My bio");
      expect(profiles[0].user).toBeDefined();
      expect(profiles[0].user?.username).toBe("profile_user");
    });
  });

  describe("Nested with relations", () => {
    it("should load 2-level nested with (posts -> comments -> author)", async () => {
      const [user1] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "post_author" }))
        .returning({ id: true });

      const [user2] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "comment_author" }))
        .returning({ id: true });

      const [post] = await db
        .insert(schema.Posts)
        .values(createTestPost(user1.id, { title: "Test Post" }))
        .returning({ id: true });

      await db
        .insert(schema.Comments)
        .values([
          createTestComment(post.id, user2.id, { body: "Comment 1" }),
          createTestComment(post.id, user2.id, { body: "Comment 2" }),
        ]);

      const posts = await db.query(schema.Posts).findMany({
        columns: {
          id: true,
          title: true,
        },
        with: {
          comments: {
            columns: {
              id: true,
              body: true,
            },
            with: {
              author: {
                columns: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("Test Post");
      expect(posts[0].comments).toHaveLength(2);
      expect(posts[0].comments[0].author.username).toBe("comment_author");
      expect(posts[0].comments[1].author.username).toBe("comment_author");
    });

    it("should load 3-level nested with (users -> posts -> comments -> author)", async () => {
      const [mainUser] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "main_user" }))
        .returning({ id: true });

      const [commentUser] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "commenter" }))
        .returning({ id: true });

      const [post] = await db
        .insert(schema.Posts)
        .values(createTestPost(mainUser.id, { title: "Deep Nested Post" }))
        .returning({ id: true });

      await db
        .insert(schema.Comments)
        .values(
          createTestComment(post.id, commentUser.id, { body: "Deep Comment" }),
        );

      const users = await db.query(schema.Users).findMany({
        columns: {
          id: true,
          username: true,
        },
        with: {
          posts: {
            columns: {
              id: true,
              title: true,
            },
            with: {
              comments: {
                columns: {
                  id: true,
                  body: true,
                },
                with: {
                  author: {
                    columns: {
                      id: true,
                      username: true,
                    },
                  },
                },
              },
            },
          },
        },
        where: eq(schema.Users.username, "main_user"),
      });

      expect(users).toHaveLength(1);
      expect(users[0].username).toBe("main_user");
      expect(users[0].posts).toHaveLength(1);
      expect(users[0].posts[0].title).toBe("Deep Nested Post");
      expect(users[0].posts[0].comments).toHaveLength(1);
      expect(users[0].posts[0].comments[0].body).toBe("Deep Comment");
      expect(users[0].posts[0].comments[0].author.username).toBe("commenter");
    });

    it("should load multiple nested branches (posts with author AND comments.author)", async () => {
      const [postAuthor] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "post_writer" }))
        .returning({ id: true });

      const [commentAuthor] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "comment_writer" }))
        .returning({ id: true });

      const [post] = await db
        .insert(schema.Posts)
        .values(createTestPost(postAuthor.id, { title: "Multi Branch Post" }))
        .returning({ id: true });

      await db.insert(schema.Comments).values(
        createTestComment(post.id, commentAuthor.id, {
          body: "Branch Comment",
        }),
      );

      const posts = await db.query(schema.Posts).findMany({
        columns: {
          id: true,
          title: true,
        },
        with: {
          author: {
            columns: {
              id: true,
              username: true,
            },
          },
          comments: {
            columns: {
              id: true,
              body: true,
            },
            with: {
              author: {
                columns: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("Multi Branch Post");
      expect(posts[0].author.username).toBe("post_writer");
      expect(posts[0].comments).toHaveLength(1);
      expect(posts[0].comments[0].body).toBe("Branch Comment");
      expect(posts[0].comments[0].author.username).toBe("comment_writer");
    });

    it("should handle empty nested relations", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "lonely_user" }))
        .returning({ id: true });

      const [_] = await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "No Comments Post" }))
        .returning({ id: true });

      // No comments inserted

      const posts = await db.query(schema.Posts).findMany({
        columns: {
          id: true,
          title: true,
        },
        with: {
          comments: {
            columns: {
              id: true,
              body: true,
            },
            with: {
              author: {
                columns: {
                  id: true,
                  username: true,
                },
              },
            },
          },
        },
      });

      expect(posts).toHaveLength(1);
      expect(posts[0].title).toBe("No Comments Post");
      expect(posts[0].comments).toEqual([]);
    });

    it("should load nested with all columns (no column selection)", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "all_cols_user" }))
        .returning({ id: true });

      const [post] = await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "All Cols Post" }))
        .returning({ id: true });

      await db
        .insert(schema.Comments)
        .values(
          createTestComment(post.id, user.id, { body: "All Cols Comment" }),
        );

      const posts = await db.query(schema.Posts).findMany({
        columns: {
          id: true,
          title: true,
        },
        with: {
          comments: {
            with: {
              author: {},
            },
          },
        },
      });

      expect(posts).toHaveLength(1);
      expect(posts[0].comments).toHaveLength(1);
      // All columns should be present on author
      expect(posts[0].comments[0].author).toHaveProperty("id");
      expect(posts[0].comments[0].author).toHaveProperty("username");
      expect(posts[0].comments[0].author).toHaveProperty("email");
      expect(posts[0].comments[0].author).toHaveProperty("type");
      expect(posts[0].comments[0].author).toHaveProperty("createdAt");
      // All columns should be present on comments
      expect(posts[0].comments[0]).toHaveProperty("id");
      expect(posts[0].comments[0]).toHaveProperty("postId");
      expect(posts[0].comments[0]).toHaveProperty("userId");
      expect(posts[0].comments[0]).toHaveProperty("body");
    });

    it("should handle multiple levels with different relation types (Many -> Fk)", async () => {
      const [user] = await db
        .insert(schema.Users)
        .values(createTestUser({ username: "mixed_rel_user" }))
        .returning({ id: true });

      const [post] = await db
        .insert(schema.Posts)
        .values(createTestPost(user.id, { title: "Mixed Relations Post" }))
        .returning({ id: true });

      await db
        .insert(schema.Comments)
        .values([
          createTestComment(post.id, user.id, { body: "Comment A" }),
          createTestComment(post.id, user.id, { body: "Comment B" }),
        ]);

      // Users -> posts (Many) -> comments (Many) -> author (Fk)
      const users = await db.query(schema.Users).findMany({
        columns: {
          id: true,
          username: true,
        },
        with: {
          posts: {
            columns: {
              id: true,
              title: true,
            },
            with: {
              comments: {
                columns: {
                  id: true,
                  body: true,
                },
                with: {
                  author: {
                    columns: {
                      id: true,
                      username: true,
                    },
                  },
                },
              },
            },
          },
        },
        where: eq(schema.Users.username, "mixed_rel_user"),
      });

      expect(users).toHaveLength(1);
      expect(users[0].posts).toHaveLength(1);
      expect(users[0].posts[0].comments).toHaveLength(2);
      expect(users[0].posts[0].comments[0].author.username).toBe(
        "mixed_rel_user",
      );
      expect(users[0].posts[0].comments[1].author.username).toBe(
        "mixed_rel_user",
      );
    });
  });
});
