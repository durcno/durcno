import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import type { QueryContext } from "durcno";
import {
  type $Client,
  Arg,
  add,
  and,
  asc,
  database,
  defineConfig,
  eq,
  Filter,
  isIn,
  jsonAgg,
  jsonBuildArray,
  jsonBuildObject,
  jsonbAgg,
  jsonbBuildObject,
  lower,
  prepare,
  type Query,
  sql,
  toJson,
  toJsonb,
} from "durcno";
import { pg } from "durcno/connectors/pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  createTestComment,
  createTestPost,
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
      .insertInto(schema.Users)
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
          .select("*")
          .where(() => eq(schema.Users.id, args.userId))
          .limit(args.lim),
    );

    const rows = await selectPre.run(db, { userId: user1.id, lim: 1 });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(user1.id);
    expect(rows[0].username).toBe("alice");
  });

  it("should convert a prepared argument to JSON", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "json_prepared" }))
      .returning({ id: true });

    const selectPre = prepare({ id: schema.Users.id.arg() }, (args) =>
      db
        .prepare()
        .from(schema.Users)
        .select(() => ({ id: toJson(args.id), idb: toJsonb(args.id) }))
        .where(() => eq(schema.Users.id, user.id)),
    );

    const rows = await selectPre.run(db, { id: user.id });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(user.id);
    expect(rows[0].idb).toBe(user.id);
  });

  it("should cast prepared arguments in JSON builders", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "json_builder_prepared" }))
      .returning({ id: true });

    const selectPre = prepare({ id: schema.Users.id.arg() }, (args) =>
      db
        .prepare()
        .from(schema.Users)
        .select(() => ({
          obj: jsonBuildObject({ id: args.id }),
          objb: jsonbBuildObject({ id: args.id }),
          arr: jsonBuildArray(args.id),
          rec: toJson({ id: args.id }),
          recb: toJsonb({ id: args.id }),
        }))
        .where(() => eq(schema.Users.id, user.id)),
    );

    const rows = await selectPre.run(db, { id: user.id });

    expect(rows).toHaveLength(1);
    expect(rows[0].obj).toEqual({ id: user.id });
    expect(rows[0].objb).toEqual({ id: user.id });
    expect(rows[0].arr).toEqual([user.id]);
    expect(rows[0].rec).toEqual({ id: user.id });
    expect(rows[0].recb).toEqual({ id: user.id });
  });

  it("should cast prepared arguments in JSON aggregates", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "json_agg_prepared" }))
      .returning({ id: true });

    const selectPre = prepare({ id: schema.Users.id.arg() }, (args) =>
      db
        .prepare()
        .from(schema.Users)
        .select(() => ({
          ids: jsonAgg(args.id),
          idsb: jsonbAgg(args.id),
        }))
        .where(() => eq(schema.Users.id, user.id)),
    );

    const rows = await selectPre.run(db, { id: user.id });

    expect(rows).toHaveLength(1);
    expect(rows[0].ids).toEqual([user.id]);
    expect(rows[0].idsb).toEqual([user.id]);
  });

  it("should cast untyped arguments as JSON numbers", async () => {
    await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "json_untyped_prepared" }));

    const selectPre = prepare(
      { num: Arg.number(), big: Arg.bigint() },
      (args) =>
        db
          .prepare()
          .from(schema.Users)
          .select(() => ({
            obj: jsonBuildObject({ num: args.num, big: args.big }),
            objb: jsonbBuildObject({ num: args.num, big: args.big }),
          }))
          .limit(1),
    );

    const rows = await selectPre.run(db, { num: 7, big: 8n });

    expect(rows).toHaveLength(1);
    expect(rows[0].obj).toEqual({ num: 7, big: 8n });
    expect(rows[0].objb).toEqual({ num: 7, big: 8n });
  });

  it("should cast untyped arguments with their JSON type", () => {
    expect(jsonBuildObject({ num: Arg.number() }).toSQL()).toContain(
      "$1::numeric",
    );
    expect(jsonBuildObject({ big: Arg.bigint() }).toSQL()).toContain(
      "$1::int8",
    );
  });

  // ── Arg binding ───────────────────────────────────────────────────────
  // One Arg reused in several places writes one placeholder per position but
  // binds one value; each Arg keeps the value its own `$N` refers to.
  it("should bind a single Arg reused across an isIn list", async () => {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "isIn_alice" }),
        createTestUser({ username: "isIn_bob" }),
      ]);

    const selectPre = prepare({ name: schema.Users.username.arg() }, (args) =>
      db
        .prepare()
        .from(schema.Users)
        .select("*")
        .where(() => isIn(schema.Users.username, [args.name, args.name])),
    );

    const rows = await selectPre.run(db, { name: "isIn_bob" });

    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe("isIn_bob");
  });

  it("should bind each Arg to its own placeholder when written out of order", async () => {
    await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "order_alice", age: 99 }));

    // `username` is written first, so it takes the lower placeholder number.
    const selectPre = prepare(
      { age: schema.Users.age.arg(), name: schema.Users.username.arg() },
      (args) =>
        db
          .prepare()
          .from(schema.Users)
          .select("*")
          .where(() =>
            and(
              eq(schema.Users.username, args.name),
              eq(schema.Users.age, args.age),
            ),
          ),
    );

    const matched = await selectPre.run(db, { age: 99, name: "order_alice" });
    expect(matched).toHaveLength(1);
    expect(matched[0].username).toBe("order_alice");

    const mismatched = await selectPre.run(db, {
      age: 98,
      name: "order_alice",
    });
    expect(mismatched).toHaveLength(0);
  });

  it("should not emit placeholders for unused arguments", async () => {
    const selectPre = prepare(
      { name: schema.Users.username.arg(), minAge: schema.Users.age.arg() },
      (args) =>
        db
          .prepare()
          .from(schema.Users)
          .select("*")
          .where(() => eq(schema.Users.username, args.name)),
    );

    const exec = selectPre.run(db, { name: "unused_arg", minAge: 18 });

    expect(exec.query.sql).toContain("$1");
    expect(exec.query.sql).not.toContain("$2");
    expect(exec.arguments).toEqual(["unused_arg"]);
    await expect(exec).resolves.toHaveLength(0);
  });

  // ── pushArg ───────────────────────────────────────────────────────────
  // The ad-hoc helper shares the Arg numbering, so no two placeholders
  // claim the same `$N`.
  it("should bind pushArg values to their own placeholder among Args", async () => {
    class AgeEquals extends Filter<typeof schema.Users.age, true> {
      readonly value: number;
      constructor(value: number) {
        super();
        this.value = value;
      }
      toQuery(query: Query, ctx?: QueryContext): void {
        schema.Users.age.toQuery(query, ctx);
        query.sql += " = ";
        query.sql += query.pushArg(this.value, schema.Users.age.sqlCast);
      }
    }

    await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "pusharg_alice", age: 40 }));

    const pushPre = prepare({ name: schema.Users.username.arg() }, (args) =>
      db
        .prepare()
        .from(schema.Users)
        .select("*")
        .where(() =>
          and(eq(schema.Users.username, args.name), new AgeEquals(40)),
        ),
    );

    const exec = pushPre.run(db, { name: "pusharg_alice" });

    expect(exec.query.sql).toContain('"username" = $1');
    expect(exec.query.sql).toContain('"age" = $2');
    expect(exec.query.sql).not.toContain("$0");
    expect(exec.arguments).toEqual(["pusharg_alice", 40]);

    const rows = await exec;
    expect(rows).toHaveLength(1);
    expect(rows[0].age).toBe(40);

    const secondExec = pushPre.run(db, { name: "pusharg_bob" });
    expect(secondExec.query.sql).toBe(exec.query.sql);
    await expect(secondExec).resolves.toHaveLength(0);
  });

  // ── INSERT ────────────────────────────────────────────────────────────
  // Arg in: values (username column)
  it("should insert with Arg in values", async () => {
    const insertPre = prepare(
      { username: schema.Users.username.arg() },
      (args) =>
        db
          .prepare()
          .insertInto(schema.Users)
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

  it("should insert with scalar function and Arg in values", async () => {
    const insertPre = prepare(
      { username: schema.Users.username.arg() },
      (args) =>
        db
          .prepare()
          .insertInto(schema.Users)
          .values({
            username: lower(args.username),
            email: "preparescalar@test.com",
            type: "user",
            status: "active",
            role: "user",
          })
          .returning("*"),
    );

    const rows = await insertPre.run(db, { username: "UPPERCASE_USER" });

    expect(rows).toHaveLength(1);
    expect(rows[0].username).toBe("uppercase_user");
  });

  it("should bind a single Arg reused across insert rows", async () => {
    const insertPre = prepare({ score: schema.Users.score.arg() }, (args) =>
      db
        .prepare()
        .insertInto(schema.Users)
        .values([
          {
            username: "shared_arg_1",
            email: "shared1@test.com",
            type: "user",
            status: "active",
            role: "user",
            score: args.score,
          },
          {
            username: "shared_arg_2",
            email: "shared2@test.com",
            type: "user",
            status: "active",
            role: "user",
            score: args.score,
          },
        ])
        .returning("*"),
    );

    const rows = await insertPre.run(db, { score: 42 });

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.score)).toEqual([42, 42]);
  });

  it.each([1, 3, 200])(
    "should evaluate insertFn values for %i row(s)",
    async (rowCount) => {
      const action = `insert_fn_${rowCount}`;
      const insertPre = prepare(
        { action: schema.AuditLogs.action.arg() },
        (args) =>
          db
            .prepare()
            .insertInto(schema.AuditLogs)
            .values(
              Array.from({ length: rowCount }, () => ({
                action: args.action,
                modifiedAt: new Date(),
              })),
            )
            .returning({ action: true, createdAt: true, publicId: true }),
      );

      const firstExec = insertPre.run(db, { action });
      const firstSql = firstExec.query.sql;
      const firstRows = await firstExec;

      expect(firstRows).toHaveLength(rowCount);
      expect(firstExec.arguments).toHaveLength(1 + rowCount * 2);
      for (const row of firstRows) {
        expect(row.action).toBe(action);
        expect(row.createdAt).toBeInstanceOf(Date);
        expect(row.publicId).toBeTypeOf("string");
      }
      expect(firstExec.arguments).toEqual(
        expect.arrayContaining(firstRows.map((row) => row.publicId)),
      );
      expect(new Set(firstRows.map((row) => row.publicId)).size).toBe(rowCount);

      // Generated values are bound, not inlined into the prepared SQL.
      expect(firstSql).toMatch(/\$\d+::timestamptz/);
      expect(firstSql).toMatch(/\$\d+::uuid/);
      expect(firstSql).not.toMatch(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/,
      );

      // One `uuid` placeholder per row, numbered after the single static
      // argument and within the two generated values each row contributes.
      const uuids = [...firstSql.matchAll(/\$(\d+)::uuid/g)].map((match) =>
        Number(match[1]),
      );
      expect(uuids).toHaveLength(rowCount);
      expect(new Set(uuids).size).toBe(rowCount);
      expect(Math.min(...uuids)).toBeGreaterThan(1);
      expect(Math.max(...uuids)).toBe(1 + rowCount * 2);

      const secondExec = insertPre.run(db, { action: `${action}_second` });
      expect(secondExec.query.sql).toBe(firstSql);
      const secondRows = await secondExec;

      // Every row of every run gets its own generated value.
      expect(
        new Set([...firstRows, ...secondRows].map((row) => row.publicId)).size,
      ).toBe(rowCount * 2);
    },
  );

  it("should keep an explicit insertFn value in a prepared insert", async () => {
    const createdAt = new Date("2024-05-06T07:08:09.000Z");
    const publicId = crypto.randomUUID();

    const insertPre = prepare(
      {
        action: schema.AuditLogs.action.arg(),
        createdAt: schema.AuditLogs.createdAt.arg(),
        modifiedAt: schema.AuditLogs.modifiedAt.arg(),
        publicId: schema.AuditLogs.publicId.arg(),
      },
      (args) =>
        db
          .prepare()
          .insertInto(schema.AuditLogs)
          .values({
            action: args.action,
            createdAt: args.createdAt,
            modifiedAt: args.modifiedAt,
            publicId: args.publicId,
          })
          .returning({ createdAt: true, publicId: true }),
    );

    const [row] = await insertPre.run(db, {
      action: "insert_fn_explicit",
      createdAt,
      modifiedAt: new Date(),
      publicId,
    });

    expect(row.createdAt.getTime()).toBe(createdAt.getTime());
    expect(row.publicId).toBe(publicId);
  });

  // ── UPDATE ────────────────────────────────────────────────────────────
  // Arg in: where (Users.id.arg())
  it("should update with Arg in where", async () => {
    const [user] = await db
      .insertInto(schema.Users)
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

  it("should update with scalar function and Arg in set", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ score: 50 }))
      .returning("*");

    const updatePre = prepare(
      { userId: schema.Users.id.arg(), inc: schema.Users.score.arg() },
      (args) =>
        db
          .prepare()
          .update(schema.Users)
          .set({ score: add(schema.Users.score, args.inc) })
          .where(eq(schema.Users.id, args.userId))
          .returning("*"),
    );

    const rows = await updatePre.run(db, { userId: user.id, inc: 25 });

    expect(rows).toHaveLength(1);
    expect(rows[0].score).toBe(75);
  });

  it("should bind a single Arg reused in set and where", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "to_self_update", score: 10 }))
      .returning("*");

    const updatePre = prepare({ score: schema.Users.score.arg() }, (args) =>
      db
        .prepare()
        .update(schema.Users)
        .set({ score: args.score })
        .where(eq(schema.Users.score, args.score))
        .returning("*"),
    );

    const rows = await updatePre.run(db, { score: 10 });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(user.id);
    expect(rows[0].score).toBe(10);
  });

  it("should evaluate updateFn values on every run", async () => {
    const [inserted] = await db
      .insertInto(schema.AuditLogs)
      .values({
        action: "update_fn_initial",
        modifiedAt: new Date("2020-01-01T00:00:00.000Z"),
      })
      .returning({ id: true });

    const updatePre = prepare(
      { id: schema.AuditLogs.id.arg(), action: schema.AuditLogs.action.arg() },
      (args) =>
        db
          .prepare()
          .update(schema.AuditLogs)
          .set({ action: args.action })
          .where(eq(schema.AuditLogs.id, args.id))
          .returning({ action: true, modifiedAt: true }),
    );

    const firstExec = updatePre.run(db, {
      id: inserted.id,
      action: "update_fn_first",
    });
    const firstSql = firstExec.query.sql;
    const [first] = await firstExec;

    await new Promise((resolve) => setTimeout(resolve, 10));

    const secondExec = updatePre.run(db, {
      id: inserted.id,
      action: "update_fn_second",
    });
    expect(secondExec.query.sql).toBe(firstSql);

    const [second] = await secondExec;

    expect(first.action).toBe("update_fn_first");
    expect(second.action).toBe("update_fn_second");
    expect(second.modifiedAt.getTime()).toBeGreaterThan(
      first.modifiedAt.getTime(),
    );
    // The generated timestamp is bound, not inlined into the prepared SQL.
    expect(firstSql).toMatch(/\$\d+::timestamptz/);
    expect(firstSql).not.toMatch(/[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
  });

  it("should keep an explicit updateFn value in a prepared update", async () => {
    const [inserted] = await db
      .insertInto(schema.AuditLogs)
      .values({
        action: "update_fn_explicit_initial",
        modifiedAt: new Date("2020-01-01T00:00:00.000Z"),
      })
      .returning({ id: true });

    const explicit = new Date("2025-12-25T00:00:00.000Z");

    const updatePre = prepare(
      {
        id: schema.AuditLogs.id.arg(),
        action: schema.AuditLogs.action.arg(),
        modifiedAt: schema.AuditLogs.modifiedAt.arg(),
      },
      (args) =>
        db
          .prepare()
          .update(schema.AuditLogs)
          .set({
            action: args.action,
            modifiedAt: args.modifiedAt,
          })
          .where(eq(schema.AuditLogs.id, args.id))
          .returning({ modifiedAt: true }),
    );

    const [row] = await updatePre.run(db, {
      id: inserted.id,
      action: "update_fn_explicit",
      modifiedAt: explicit,
    });

    expect(row.modifiedAt.getTime()).toBe(explicit.getTime());
  });

  // ── DELETE ────────────────────────────────────────────────────────────
  // Arg in: where (Users.id.arg())
  it("should delete with Arg in where", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser({ username: "to_delete" }))
      .returning("*");

    const deletePre = prepare({ userId: schema.Users.id.arg() }, (args) =>
      db
        .prepare()
        .deleteFrom(schema.Users)
        .where(eq(schema.Users.id, args.userId))
        .returning("*"),
    );

    const rows = await deletePre.run(db, { userId: user.id });

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(user.id);

    // Verify user no longer exists
    const remaining = await db
      .from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.id, user.id));
    expect(remaining).toHaveLength(0);
  });

  // ── .query() (relational findMany) ────────────────────────────────────
  // Arg in: where option (Users.id.arg())
  it("should query with Arg in where option of findMany", async () => {
    const [user1] = await db
      .insertInto(schema.Users)
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

  // Arg in: nested limit/offset of a `many` relation
  it("should query with Arg in nested relation limit and offset", async () => {
    const [user] = await db
      .insertInto(schema.Users)
      .values(createTestUser())
      .returning("*");

    const [post] = await db
      .insertInto(schema.Posts)
      .values(createTestPost(user.id))
      .returning("*");

    await db
      .insertInto(schema.Comments)
      .values([
        createTestComment(post.id, user.id, { body: "a" }),
        createTestComment(post.id, user.id, { body: "b" }),
        createTestComment(post.id, user.id, { body: "c" }),
      ]);

    const queryPre = prepare({ lim: Arg.number(), off: Arg.number() }, (args) =>
      db
        .prepare()
        .query(schema.Posts)
        .findMany({
          columns: { id: true },
          with: {
            comments: {
              columns: { body: true },
              orderBy: asc(schema.Comments.body),
              limit: args.lim,
              offset: args.off,
            },
          },
        }),
    );

    // The nested limit/offset must bind as query arguments, not be inlined —
    // an inlined Arg would surface as a SQL syntax error here
    const rows = await queryPre.run(db, { lim: 2, off: 1 });
    expect(rows[0].comments.map((c) => c.body)).toEqual(["b", "c"]);
  });

  describe("Sql template literal with Arg", () => {
    it("should throw on toSQL() if Sql contains an Arg parameter", () => {
      const arg = Arg.number();
      const s = sql`SELECT ${arg}`;
      expect(() => s.toSQL()).toThrow(
        "Cannot evaluate Sql containing prepared argument (Arg) without a query context",
      );
    });

    it("should handle Arg in raw sql WHERE expression", async () => {
      const [user] = await db
        .insertInto(schema.Users)
        .values(createTestUser({ username: "raw_arg_user", age: 30 }))
        .returning("*");

      const selectPre = prepare({ ageArg: Arg.number() }, (args) =>
        db
          .prepare()
          .from(schema.Users)
          .select("*")
          .where(() => sql`age = ${args.ageArg}`),
      );

      const rows = await selectPre.run(db, { ageArg: 30 });

      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(user.id);
      expect(rows[0].age).toBe(30);
    });
  });
});
