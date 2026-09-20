import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  asc,
  count,
  database,
  defineConfig,
  eq,
  isIn,
  lower,
  ne,
} from "durcno";
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

describe("CTE queries", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("cte");

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

  it("WITH (SELECT) → SELECT from CTE", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "active-alice", status: "active" }),
        createTestUser({ username: "inactive-bob", status: "inactive" }),
        createTestUser({ username: "active-charlie", status: "active" }),
      ]);

    const activeUsers = db.with("activeUsers").as(
      db
        .from(schema.Users)
        .select(({ users }) => ({ id: users.id, username: users.username }))
        .where(({ users }) => eq(users.status, "active")),
    );

    const rows = await db
      .with(activeUsers)
      .from((ctes) => ctes.activeUsers)
      .select("*")
      .orderBy(({ activeUsers }) => asc(activeUsers.username));

    expect(rows).toEqual([
      { id: rows[0].id, username: "active-alice" },
      { id: rows[1].id, username: "active-charlie" },
    ]);
  });

  it("WITH chained CTEs (SELECT → SELECT) → SELECT from outer CTE", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "chain-a", status: "active" }),
        createTestUser({ username: "chain-b", status: "active" }),
      ]);

    const activeUsers = db.with("activeUsers").as(
      db
        .from(schema.Users)
        .select(({ users }) => ({ id: users.id, username: users.username }))
        .where(({ users }) => eq(users.status, "active")),
    );
    const activeNames = db.with("activeNames").as(
      db
        .with(activeUsers)
        .from((ctes) => ctes.activeUsers)
        .select(({ activeUsers }) => ({ username: activeUsers.username })),
    );

    const rows = await db
      .with(activeUsers, activeNames)
      .from((ctes) => ctes.activeNames)
      .select("*")
      .orderBy(({ activeNames }) => asc(activeNames.username));

    expect(rows).toEqual([{ username: "chain-a" }, { username: "chain-b" }]);
  });

  it("WITH (INSERT RETURNING) → SELECT from CTE", async () => {
    const insertedUsers = db.with("insertedUsers").as(
      db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "dml-a" }),
          createTestUser({ username: "dml-b", status: "inactive" }),
        ])
        .returning({ id: true, username: true, status: true }),
    );

    const rows = await db
      .with(insertedUsers)
      .from((ctes) => ctes.insertedUsers)
      .select("*")
      .orderBy(({ insertedUsers }) => asc(insertedUsers.username));

    expect(rows).toEqual([
      { id: rows[0].id, username: "dml-a", status: "active" },
      { id: rows[1].id, username: "dml-b", status: "inactive" },
    ]);

    const users = await db
      .from(schema.Users)
      .select(({ users }) => ({
        username: users.username,
        status: users.status,
      }))
      .orderBy(({ users }) => asc(users.username));

    expect(users).toEqual([
      { username: "dml-a", status: "active" },
      { username: "dml-b", status: "inactive" },
    ]);
  });

  it("WITH (UPDATE RETURNING) → SELECT from CTE", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "upd-a", status: "active" }),
        createTestUser({ username: "upd-b", status: "active" }),
        createTestUser({ username: "upd-c", status: "inactive" }),
      ]);

    const updatedUsers = db
      .with("updatedUsers")
      .as(
        db
          .update(schema.Users)
          .set({ status: "inactive" })
          .where(ne(schema.Users.status, "inactive"))
          .returning({ username: true, status: true }),
      );

    const rows = await db
      .with(updatedUsers)
      .from((ctes) => ctes.updatedUsers)
      .select("*")
      .orderBy(({ updatedUsers }) => asc(updatedUsers.username));

    expect(rows).toEqual([
      { username: "upd-a", status: "inactive" },
      { username: "upd-b", status: "inactive" },
    ]);

    const allUsers = await db
      .from(schema.Users)
      .select(({ users }) => ({
        username: users.username,
        status: users.status,
      }))
      .orderBy(({ users }) => asc(users.username));

    expect(allUsers).toEqual([
      { username: "upd-a", status: "inactive" },
      { username: "upd-b", status: "inactive" },
      { username: "upd-c", status: "inactive" },
    ]);
  });

  it("WITH (DELETE RETURNING) → SELECT from CTE", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "del-a", status: "inactive" }),
        createTestUser({ username: "del-b", status: "inactive" }),
        createTestUser({ username: "del-c", status: "active" }),
      ]);

    const deletedUsers = db
      .with("deletedUsers")
      .as(
        db
          .deleteFrom(schema.Users)
          .where(eq(schema.Users.status, "inactive"))
          .returning({ username: true, status: true }),
      );

    const rows = await db
      .with(deletedUsers)
      .from((ctes) => ctes.deletedUsers)
      .select("*")
      .orderBy(({ deletedUsers }) => asc(deletedUsers.username));

    expect(rows).toEqual([
      { username: "del-a", status: "inactive" },
      { username: "del-b", status: "inactive" },
    ]);

    const remaining = await db.from(schema.Users).select(({ users }) => ({
      username: users.username,
      status: users.status,
    }));

    expect(remaining).toEqual([{ username: "del-c", status: "active" }]);
  });

  it("WITH CTE → isIn(col, subquery from cte)", async () => {
    const [activeAlice, inactiveBob, activeCharlie] = await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "isin-alice", status: "active" }),
        createTestUser({ username: "isin-bob", status: "inactive" }),
        createTestUser({ username: "isin-charlie", status: "active" }),
      ])
      .returning({ id: true });

    await db.insertInto(schema.Posts).values([
      { userId: activeAlice.id, title: "Post A" },
      { userId: inactiveBob.id, title: "Post B" },
      { userId: activeCharlie.id, title: "Post C" },
    ]);

    const activeUserIds = db.with("activeUserIds").as(
      db
        .from(schema.Users)
        .select(({ users }) => ({ id: users.id }))
        .where(({ users }) => eq(users.status, "active")),
    );

    const rows = await db
      .with(activeUserIds)
      .from(schema.Posts)
      .select(({ posts }) => ({ id: posts.id, title: posts.title }))
      .where(({ posts }) =>
        isIn(
          posts.userId,
          db
            .from(activeUserIds)
            .select(({ activeUserIds }) => ({ id: activeUserIds.id })),
        ),
      )
      .orderBy(({ posts }) => asc(posts.id));

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.title).sort()).toEqual(["Post A", "Post C"]);
  });

  it("WITH function-backed virtual columns: lower() resolves via fromDriverValue", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "Alice" }),
        createTestUser({ username: "BOB" }),
      ]);

    const lowercased = db
      .with("lowercasedUsers")
      .as(
        db
          .from(schema.Users)
          .select(({ users }) => ({ lname: lower(users.username) })),
      );

    const rows = await db
      .with(lowercased)
      .from((ctes) => ctes.lowercasedUsers)
      .select("*")
      .orderBy(({ lowercasedUsers }) => asc(lowercasedUsers.lname));

    expect(rows).toHaveLength(2);
    expect(rows[0].lname).toBe("alice");
    expect(rows[1].lname).toBe("bob");
    // Ensure the values are strings, not numbers (verifies fromDriverValue path)
    expect(typeof rows[0].lname).toBe("string");
  });

  it("WITH function-backed virtual columns: count() resolves via fromDriverValue", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "u1", status: "active" }),
        createTestUser({ username: "u2", status: "active" }),
        createTestUser({ username: "u3", status: "inactive" }),
      ]);

    const countCte = db.with("userCounts").as(
      db.from(schema.Users).select(({ users }) => ({
        status: users.status,
        total: count(users.id),
      })),
    );

    const rows = await db
      .with(countCte)
      .from((ctes) => ctes.userCounts)
      .select("*")
      .orderBy(({ userCounts }) => asc(userCounts.status));

    expect(rows).toHaveLength(2);
    const activeRow = rows.find((r) => r.status === "active");
    const inactiveRow = rows.find((r) => r.status === "inactive");
    expect(activeRow?.total).toBe(2);
    expect(inactiveRow?.total).toBe(1);
    // Ensure the counts are numbers, not strings (verifies fromDriverValue path)
    expect(typeof activeRow?.total).toBe("number");
  });

  it("WITH left-joining a CTE with virtual columns clones as nullable without corruption", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "user_cte_1", status: "active" }),
        createTestUser({ username: "user_cte_2", status: "inactive" }),
      ]);

    const activeUsersCte = db.with("activeUsers").as(
      db
        .from(schema.Users)
        .select(({ users }) => ({
          username: users.username,
        }))
        .where(({ users }) => eq(users.status, "active")),
    );

    const rows = await db
      .with(activeUsersCte)
      .from(schema.Users)
      .leftJoin(activeUsersCte, ({ users, activeUsers }) =>
        eq(users.username, activeUsers.username),
      )
      .select(({ users, activeUsers }) => ({
        username: users.username,
        activeUser: activeUsers.username,
      }))
      .orderBy(({ users }) => asc(users.username));

    expect(rows).toHaveLength(2);
    const u1 = rows.find((r) => r.username === "user_cte_1");
    const u2 = rows.find((r) => r.username === "user_cte_2");
    expect(u1?.activeUser).toBe("user_cte_1");
    expect(u2?.activeUser).toBeNull();
  });
});
