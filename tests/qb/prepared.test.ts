import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import { type $Client, Arg, database, defineConfig, eq, prepare } from "durcno";
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

describe("prepare", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("prepare");

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

  // ── SELECT ────────────────────────────────────────────────────────────
  // Arg in: where (Users.id.arg()) + limit (Arg.number())
  it("should select with Arg in where and limit", async () => {
    const [user1] = await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "alice" }),
        createTestUser({ username: "bob" }),
        createTestUser({ username: "charlie" }),
      ])
      .returning("*");

    const selectPre = prepare(
      { userId: schema.Users.id.arg(), lim: Arg.number() },
      (args) =>
        db
          .prepare()
          .from(schema.Users)
          .select()
          .where(eq(schema.Users.id, args.userId))
          .limit(args.lim),
    );

    const rows = await selectPre.run(db, { userId: user1.id, lim: 1 });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(user1.id);
    expect(rows[0].username).toBe("alice");
  });

  // ── INSERT ────────────────────────────────────────────────────────────
  // Arg in: values (username column)
  it("should insert with Arg in values", async () => {
    const insertPre = prepare(
      { username: schema.Users.username.arg() },
      (args) =>
        db
          .prepare()
          .insert(schema.Users)
          .values({
            username: args.username,
            email: "prepare@test.com",
            type: "user",
            status: "active",
            role: "user",
          })
          .returning("*"),
    );

    const rows = await insertPre.run(db, { username: "prepared_user" });

    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe("prepared_user");
    expect(rows[0].email).toBe("prepare@test.com");
  });

  // ── UPDATE ────────────────────────────────────────────────────────────
  // Arg in: where (Users.id.arg())
  it("should update with Arg in where", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "to_update", email: "old@test.com" }))
      .returning("*");

    const updatePre = prepare({ userId: schema.Users.id.arg() }, (args) =>
      db
        .prepare()
        .update(schema.Users)
        .set({ email: "updated@test.com" })
        .where(eq(schema.Users.id, args.userId))
        .returning("*"),
    );

    const rows = await updatePre.run(db, { userId: user.id });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(user.id);
    expect(rows[0].email).toBe("updated@test.com");
  });

  // ── DELETE ────────────────────────────────────────────────────────────
  // Arg in: where (Users.id.arg())
  it("should delete with Arg in where", async () => {
    const [user] = await db
      .insert(schema.Users)
      .values(createTestUser({ username: "to_delete" }))
      .returning("*");

    const deletePre = prepare({ userId: schema.Users.id.arg() }, (args) =>
      db
        .prepare()
        .delete(schema.Users)
        .where(eq(schema.Users.id, args.userId))
        .returning("*"),
    );

    const rows = await deletePre.run(db, { userId: user.id });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(user.id);

    // Verify user no longer exists
    const remaining = await db
      .from(schema.Users)
      .select()
      .where(eq(schema.Users.id, user.id));
    expect(remaining).toHaveLength(0);
  });

  // ── .query() (relational findMany) ────────────────────────────────────
  // Arg in: where option (Users.id.arg())
  it("should query with Arg in where option of findMany", async () => {
    const [user1] = await db
      .insert(schema.Users)
      .values([
        createTestUser({ username: "query_user_1" }),
        createTestUser({ username: "query_user_2" }),
      ])
      .returning("*");

    const queryPre = prepare({ userId: schema.Users.id.arg() }, (args) =>
      db
        .prepare()
        .query(schema.Users)
        .findMany({
          where: eq(schema.Users.id, args.userId),
        }),
    );

    const rows = await queryPre.run(db, { userId: user1.id });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(user1.id);
    expect(rows[0].username).toBe("query_user_1");
  });
});
