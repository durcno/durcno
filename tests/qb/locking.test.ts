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

/**
 * Row locking queries (FOR UPDATE & co.).
 *
 * Each test holds a lock on one connection (`db.transaction`) and probes it
 * from a second connection (`other`) — readers stay unblocked under MVCC,
 * while conflicting lock strengths report `55006` under `NOWAIT`.
 */
describe("SELECT row locking queries", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let other: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("locking");

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
    // Second connection pool: probes locks held by transactions of `db`
    other = database(
      schema,
      defineConfig({
        schema: "./schema.ts",
        connector: pg({
          dbCredentials: { url: containerInfo.connectionString },
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
    if (other) await other.close();
    if (container) await stopPostgresContainer(container);
  });

  it("should block a concurrent FOR UPDATE with NOWAIT, while readers pass under MVCC", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "rowlock" }))
      .returning({ id: true });

    await db.transaction(async (tx) => {
      await tx
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.id, user.id))
        .forUpdate();

      // Plain readers are never blocked by row locks
      const plain = await other
        .from(schema.Users)
        .select(() => ({ username: schema.Users.username }))
        .where(() => eq(schema.Users.id, user.id));
      expect(plain).toHaveLength(1);
      expect(plain[0].username).toBe("rowlock");

      const conflicting = other
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.id, user.id))
        .forUpdate({ noWait: true });

      await expect(conflicting).rejects.toMatchObject({ code: "55P03" });
    });
  });

  it("should skip locked rows with SKIP LOCKED", async () => {
    const [first, second] = await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "lockedRow" }),
        createTestUser({ username: "freeRow" }),
      ])
      .returning({ username: true });

    await db.transaction(async (tx) => {
      await tx
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.username, first.username))
        .forUpdate();

      const rows = await other
        .from(schema.Users)
        .select(() => ({ username: schema.Users.username }))
        .forUpdate({ skipLocked: true });

      expect(rows).toHaveLength(1);
      expect(rows[0].username).toBe(second.username);
    });
  });

  it("should allow concurrent FOR SHARE but conflict FOR UPDATE", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "shareLock" }))
      .returning({ id: true });

    await db.transaction(async (tx) => {
      await tx
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.id, user.id))
        .forShare();

      const shared = await other
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.id, user.id))
        .forShare({ noWait: true });
      expect(shared).toHaveLength(1);

      await expect(
        other
          .from(schema.Users)
          .select("*")
          .where(() => eq(schema.Users.id, user.id))
          .forUpdate({ noWait: true }),
      ).rejects.toMatchObject({ code: "55P03" });
    });
  });

  it("should lock only the tables named in `of`", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "ofLock" }))
      .returning({ id: true });
    const post = {
      userId: user.id,
      title: "Locked Post",
    };
    const [createdPost] = await db
      .insertInto(schema.Posts)
      .values(post)
      .returning({ id: true });

    await db.transaction(async (tx) => {
      await tx
        .from(schema.Users)
        .innerJoin(schema.Posts)
        .on(() => eq(schema.Posts.userId, schema.Users.id))
        .select("*")
        .forUpdate({ of: [schema.Posts] });

      // Users row is left unlocked
      const usersRow = await other
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.id, user.id))
        .forUpdate({ noWait: true });
      expect(usersRow).toHaveLength(1);

      // Posts row is locked
      await expect(
        other
          .from(schema.Posts)
          .select("*")
          .where(() => eq(schema.Posts.id, createdPost.id))
          .forUpdate({ noWait: true }),
      ).rejects.toMatchObject({ code: "55P03" });
    });
  });

  it("should emit the locking clause after LIMIT and OFFSET", async () => {
    await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "pageSize" }));

    const rows = await db
      .from(schema.Users)
      .select("*")
      .limit(1)
      .offset(0)
      .forUpdate();

    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe("pageSize");
  });
});
