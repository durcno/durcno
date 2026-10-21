import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  type AnyColumn,
  abs,
  add,
  and,
  asc,
  avg,
  caseWhen,
  coalesce,
  concat,
  concatWs,
  count,
  database,
  defineConfig,
  eq,
  greatest,
  gt,
  gte,
  jsonBuildArray,
  jsonBuildObject,
  jsonStripNulls,
  least,
  length,
  like,
  lower,
  nullif,
  round,
  type SqlFn,
  sql,
  sum,
  toJson,
  trim,
  upper,
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

describe("SELECT .groupBy() and .having()", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("group-by");

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

  // =========================================================================
  // Grouping forms — the same projection, auto and explicit
  // =========================================================================

  describe("grouping forms", () => {
    const forms = [
      { name: "auto", explicit: false },
      { name: "explicit", explicit: true },
    ];

    it.each(forms)("groups by one column — $name", async ({ explicit }) => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin" }),
          createTestUser({ username: "a2", type: "admin" }),
          createTestUser({ username: "u1", type: "user" }),
        ]);

      const query = db
        .from(schema.Users)
        .select(() => ({ type: schema.Users.type, total: count("*") }));
      const grouped = explicit ? query.groupBy(() => schema.Users.type) : query;

      const results = await grouped.orderBy(() => asc(schema.Users.type));

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ type: "admin", total: 2 });
      expect(results[1]).toEqual({ type: "user", total: 1 });
    });

    it.each(forms)(
      "groups by multiple columns — $name",
      async ({ explicit }) => {
        await db.insertInto(schema.Users).values([
          createTestUser({ username: "a1", type: "admin", status: "active" }),
          createTestUser({
            username: "a2",
            type: "admin",
            status: "inactive",
          }),
          createTestUser({ username: "u1", type: "user", status: "active" }),
          createTestUser({ username: "u2", type: "user", status: "active" }),
        ]);

        const query = db.from(schema.Users).select(() => ({
          type: schema.Users.type,
          status: schema.Users.status,
          total: count("*"),
        }));
        const grouped = explicit
          ? query.groupBy(() => [schema.Users.type, schema.Users.status])
          : query;

        const results = await grouped.orderBy(() => [
          asc(schema.Users.type),
          asc(schema.Users.status),
        ]);

        expect(results).toHaveLength(3);
        expect(results[0]).toEqual({
          type: "admin",
          status: "active",
          total: 1,
        });
        expect(results[1]).toEqual({
          type: "admin",
          status: "inactive",
          total: 1,
        });
        expect(results[2]).toEqual({
          type: "user",
          status: "active",
          total: 2,
        });
      },
    );

    it.each(forms)(
      "groups by a scalar expression — $name",
      async ({ explicit }) => {
        await db
          .insertInto(schema.Users)
          .values([
            createTestUser({ username: "Alice" }),
            createTestUser({ username: "alice" }),
            createTestUser({ username: "Bob" }),
          ]);

        const query = db.from(schema.Users).select(() => ({
          lname: lower(schema.Users.username),
          total: count("*"),
        }));
        const grouped = explicit
          ? query.groupBy(() => lower(schema.Users.username))
          : query;

        const results = await grouped.orderBy(() =>
          asc(lower(schema.Users.username)),
        );

        expect(results).toEqual([
          { lname: "alice", total: 2 },
          { lname: "bob", total: 1 },
        ]);
      },
    );
  });

  // =========================================================================
  // Auto GROUP BY — inferred from the projection
  // =========================================================================

  describe("auto GROUP BY with plain columns", () => {
    it("should group once when the same column is projected under two aliases", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin" }),
          createTestUser({ username: "bob", type: "admin" }),
          createTestUser({ username: "charlie", type: "user" }),
          createTestUser({ username: "dave", type: "user" }),
        ]);

      // Two aliases of one column are one grouping key, so this is two groups
      // and not four.
      const results = await db
        .from(schema.Users)
        .select(() => ({
          type: schema.Users.type,
          sameType: schema.Users.type,
          total: count("*"),
        }))
        .orderBy(() => asc(schema.Users.type));

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe("admin");
      expect(results[0].sameType).toBe("admin");
      expect(results[0].total).toBe(2);
      expect(results[1].type).toBe("user");
      expect(results[1].sameType).toBe("user");
      expect(results[1].total).toBe(2);
    });

    it("should compute sum per group", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin", score: 10 }),
          createTestUser({ username: "bob", type: "admin", score: 20 }),
          createTestUser({ username: "charlie", type: "user", score: 5 }),
        ]);

      const results = await db
        .from(schema.Users)
        .select(() => ({
          type: schema.Users.type,
          totalScore: sum(schema.Users.score),
        }))
        .orderBy(() => asc(schema.Users.type));

      expect(results).toHaveLength(2);
      expect(results[0].type).toBe("admin");
      expect(results[0].totalScore).toBe(30);
      expect(results[1].type).toBe("user");
      expect(results[1].totalScore).toBe(5);
    });

    it("should work with WHERE + auto GROUP BY", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin", score: 10 }),
          createTestUser({ username: "bob", type: "admin", score: 20 }),
          createTestUser({ username: "charlie", type: "user", score: 5 }),
          createTestUser({ username: "dave", type: "user", score: 15 }),
        ]);

      const results = await db
        .from(schema.Users)
        .select(() => ({ type: schema.Users.type, total: count("*") }))
        .where(() => eq(schema.Users.type, "admin"))
        .orderBy(() => asc(schema.Users.type));

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("admin");
      expect(results[0].total).toBe(2);
    });
  });

  describe("auto GROUP BY with a nested aggregate", () => {
    it("should emit no GROUP BY when every projection item is an aggregate, however deeply wrapped", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", score: 4 }),
          createTestUser({ username: "bob", score: 5 }),
        ]);

      const query = db.from(schema.Users).select(() => ({
        totalCount: count("*"),
        averageRating: round(avg(schema.Users.score), 1),
        roundedSum: abs(round(sum(schema.Users.score))),
      }));

      // An aggregate in GROUP BY is rejected by PostgreSQL, so the clause must
      // be absent rather than present.
      expect(query.toQuery().sql).not.toContain("GROUP BY");

      const [result] = await query;
      expect(result.totalCount).toBe(2);
      expect(Number(result.averageRating)).toBe(4.5);
      expect(result.roundedSum).toBe(9);
    });

    it("should group only by the plain column when a wrapped aggregate is projected beside it", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", type: "admin", score: 4 }),
          createTestUser({ username: "bob", type: "admin", score: 6 }),
          createTestUser({ username: "charlie", type: "user", score: 10 }),
        ]);

      const query = db
        .from(schema.Users)
        .select(() => ({
          type: schema.Users.type,
          averageRating: round(avg(schema.Users.score), 1),
        }))
        .orderBy(() => asc(schema.Users.type));

      const sql = query.toQuery().sql;
      expect(sql).toContain('GROUP BY "users"."type"');
      expect(sql).not.toContain("GROUP BY round(");

      const results = await query;
      expect(results).toHaveLength(2);
      expect(results[0].type).toBe("admin");
      expect(Number(results[0].averageRating)).toBe(5);
      expect(results[1].type).toBe("user");
      expect(Number(results[1].averageRating)).toBe(10);
    });

    it("should keep a scalar-over-column as the grouping key when a wrapped aggregate is also projected", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "Alice", score: 4 }),
          createTestUser({ username: "alice", score: 8 }),
        ]);

      const query = db
        .from(schema.Users)
        .select(() => ({
          lowerName: lower(schema.Users.username),
          averageScore: round(avg(schema.Users.score)),
        }))
        .orderBy(() => asc(lower(schema.Users.username)));

      expect(query.toQuery().sql).toContain(
        'GROUP BY lower("users"."username")',
      );

      const results = await query;
      expect(results).toHaveLength(1);
      expect(results[0].lowerName).toBe("alice");
      expect(results[0].averageScore).toBe(6);
    });
  });

  describe("auto GROUP BY with CASE conditions", () => {
    it("should keep an aggregate inside a CASE condition out of the grouping keys", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin", score: 4 }),
          createTestUser({ username: "a2", type: "admin", score: 6 }),
          createTestUser({ username: "u1", type: "user", score: 1 }),
        ]);

      const query = db
        .from(schema.Users)
        .select(() => ({
          type: schema.Users.type,
          total: count("*"),
          bucket: caseWhen(gte(count("*"), 2), "many").else("few"),
        }))
        .orderBy(() => asc(schema.Users.type));

      // PostgreSQL rejects an aggregate in GROUP BY, so the CASE must not be a
      // grouping key even though its own result is a plain string.
      expect(query.toQuery().sql).toContain('GROUP BY "users"."type" ORDER BY');

      const results = await query;
      expect(results).toEqual([
        { type: "admin", total: 2, bucket: "many" },
        { type: "user", total: 1, bucket: "few" },
      ]);
    });

    it("should include a CASE condition's columns in the auto GROUP BY", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "admin1", type: "admin", score: 4 }),
          createTestUser({ username: "user1", type: "user", score: 5 }),
          createTestUser({ username: "user2", type: "user", score: 6 }),
        ]);

      const query = db
        .from(schema.Users)
        .select(() => ({
          name: caseWhen(
            eq(schema.Users.type, "admin"),
            schema.Users.username,
          ).end(),
          total: count("*"),
        }))
        .orderBy(() => asc(schema.Users.username));

      // The condition reads `type`, so it has to be grouped alongside the
      // branch's `username` for PostgreSQL to accept the query.
      expect(query.toQuery().sql).toContain(
        'GROUP BY "users"."username", "users"."type"',
      );

      const results = await query;
      expect(results.map((r) => r.name)).toEqual(["admin1", null, null]);
      expect(results.every((r) => r.total === 1)).toBe(true);
    });

    it("should include columns from a string filter in the auto GROUP BY", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "alice", score: 1 }),
          createTestUser({ username: "bob", score: 2 }),
        ]);

      const query = db
        .from(schema.Users)
        .select(() => ({
          initial: caseWhen(like(schema.Users.username, "a%"), "A").else(
            "other",
          ),
          total: count("*"),
        }))
        .orderBy(() => asc(schema.Users.username));

      // `like()` publishes its column, so the CASE is not the grouping key.
      const sql = query.toQuery().sql;
      expect(sql).toContain('GROUP BY "users"."username"');
      expect(sql).not.toContain("GROUP BY CASE");

      const results = await query;
      expect(results.map((r) => r.initial)).toEqual(["A", "other"]);
      expect(results.every((r) => r.total === 1)).toBe(true);
    });

    it("should group by a whole CASE when its condition columns cannot be enumerated", () => {
      const query = db.from(schema.Users).select(() => ({
        bucket: caseWhen(sql`${schema.Users.username} = 'a'`, "many").end(),
        total: count("*"),
      }));

      expect(query.toQuery().sql).toContain("GROUP BY CASE");
    });
  });

  // =========================================================================
  // Aggregate detection through wrappers
  // =========================================================================

  describe("aggregate detection through wrappers", () => {
    // One wrapper per function family. The flag decides whether an aggregate
    // projected inside the wrapper becomes a GROUP BY key, which PostgreSQL
    // rejects, so both directions are asserted through the generated SQL.
    type Probe = () => SqlFn<
      AnyColumn,
      "scalar" | "aggregate",
      string,
      unknown,
      boolean,
      boolean
    >;

    const wrappedAggregates = [
      ["round", () => round(avg(schema.Users.score), 1)],
      ["abs", () => abs(sum(schema.Users.score))],
      ["add", () => add(avg(schema.Users.score), 1)],
      ["coalesce", () => coalesce(sum(schema.Users.score), 0)],
      ["nullif", () => nullif(avg(schema.Users.score), 0)],
      [
        "greatest",
        () => greatest(sum(schema.Users.score), avg(schema.Users.score)),
      ],
      ["least", () => least(avg(schema.Users.score), 1)],
      ["concat", () => concat("x", count("*"))],
      ["concatWs", () => concatWs("-", count("*"))],
      ["jsonBuildObject", () => jsonBuildObject({ total: count("*") })],
      ["jsonBuildArray", () => jsonBuildArray(avg(schema.Users.score))],
      [
        "jsonStripNulls",
        () => jsonStripNulls(jsonBuildObject({ n: avg(schema.Users.score) })),
      ],
      ["toJson", () => toJson(count("*"))],
      ["nested", () => round(abs(sum(round(schema.Users.score, 2))), 1)],
      [
        "caseThen",
        () => caseWhen(eq(schema.Users.username, "a"), count("*")).end(),
      ],
      ["caseWhen", () => caseWhen(gte(count("*"), 2), "many").end()],
    ] satisfies Array<[string, Probe]>;

    it.each(wrappedAggregates)(
      "keeps an aggregate wrapped in %s out of GROUP BY",
      (_name, build) => {
        const query = db.from(schema.Users).select(() => ({ value: build() }));

        expect(query.toQuery().sql).not.toContain("GROUP BY");
      },
    );

    const scalarWrappers = [
      ["lower", () => lower(schema.Users.username)],
      ["upper", () => upper(schema.Users.username)],
      ["length", () => length(schema.Users.username)],
      ["trim", () => trim(schema.Users.username)],
      ["round", () => round(schema.Users.score, 1)],
      ["abs", () => abs(schema.Users.score)],
      ["add", () => add(schema.Users.score, 1)],
      ["concat", () => concat(schema.Users.username, "x")],
      ["concatWs", () => concatWs("-", schema.Users.username)],
      ["coalesce", () => coalesce(schema.Users.username, "x")],
      ["greatest", () => greatest(schema.Users.score, 1)],
      [
        "jsonBuildObject",
        () => jsonBuildObject({ name: schema.Users.username }),
      ],
      ["toJson", () => toJson(schema.Users.username)],
    ] satisfies Array<[string, Probe]>;

    it.each(scalarWrappers)(
      "groups a scalar %s projected beside an aggregate",
      (_name, build) => {
        const query = db
          .from(schema.Users)
          .select(() => ({ key: build(), total: count("*") }));

        expect(query.toQuery().sql).toContain("GROUP BY");
      },
    );

    it("keeps the clone made by .filter() and .orderBy() an aggregate", () => {
      // Both clone with Object.create + Object.assign, so a flag that lives on
      // the prototype instead of an own property would end up in GROUP BY.
      const probes = [
        count("*").filter(eq(schema.Users.username, "a")),
        count("*").orderBy(asc(schema.Users.username)),
      ];

      for (const probe of probes) {
        const query = db.from(schema.Users).select(() => ({ value: probe }));
        expect(query.toQuery().sql).not.toContain("GROUP BY");
      }
    });
  });

  // =========================================================================
  // Explicit groupBy
  // =========================================================================

  describe("explicit groupBy", () => {
    it("overrides auto GROUP BY", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin", status: "active" }),
          createTestUser({ username: "a2", type: "admin", status: "inactive" }),
          createTestUser({ username: "u1", type: "user", status: "active" }),
        ]);

      // Only group by `status`, even though `type` is in select too
      const query = db
        .from(schema.Users)
        .select(() => ({ status: schema.Users.status, total: count("*") }))
        .groupBy(() => schema.Users.status);

      const sql = query.toQuery().sql;
      expect(sql).toContain("GROUP BY");
      // The explicit groupBy should only contain status, not type
      expect(sql).toContain('"users"."status"');
      expect(sql).not.toContain('"users"."type"');
    });

    describe("callback form", () => {
      it("callback form — single alias", async () => {
        await db
          .insertInto(schema.Users)
          .values([
            createTestUser({ username: "Alice", email: "alice@test.com" }),
            createTestUser({ username: "alice2", email: "ALICE2@test.com" }),
            createTestUser({ username: "Bob", email: "bob@test.com" }),
          ]);

        const query = db
          .from(schema.Users)
          .select(() => ({
            lname: lower(schema.Users.username),
            total: count("*"),
          }))
          .groupBy((_view, { lname }) => [lname]);

        const sql = query.toQuery().sql;
        expect(sql).toContain('GROUP BY "lname"');

        const results = await query;
        expect(results.length).toBeGreaterThanOrEqual(1);
        results.forEach((r) => {
          expect(typeof r.lname).toBe("string");
          expect(typeof r.total).toBe("number");
        });
      });

      it("callback form — multiple aliases", async () => {
        await db
          .insertInto(schema.Users)
          .values([
            createTestUser({ username: "a1", type: "admin" }),
            createTestUser({ username: "a2", type: "admin" }),
            createTestUser({ username: "u1", type: "user" }),
          ]);

        const query = db
          .from(schema.Users)
          .select(() => ({
            lname: lower(schema.Users.username),
            type: schema.Users.type,
            total: count("*"),
          }))
          .groupBy((_view, { lname, type }) => [lname, type]);

        const sql = query.toQuery().sql;
        expect(sql).toContain('"lname"');
        expect(sql).toContain('"type"');
      });

      it("callback form — mix alias + direct column", async () => {
        await db
          .insertInto(schema.Users)
          .values([
            createTestUser({ username: "a1", type: "admin" }),
            createTestUser({ username: "u1", type: "user" }),
          ]);

        const query = db
          .from(schema.Users)
          .select(() => ({
            lname: lower(schema.Users.username),
            total: count("*"),
          }))
          .groupBy((_, { lname }) => [lname, schema.Users.type]);

        const sql = query.toQuery().sql;
        expect(sql).toContain('"lname"');
        expect(sql).toContain('"users"."type"');
      });
    });
  });

  // =========================================================================
  // HAVING
  // =========================================================================

  describe("having()", () => {
    it("having with literal — only returns groups with >= 2 rows", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin" }),
          createTestUser({ username: "a2", type: "admin" }),
          createTestUser({ username: "u1", type: "user" }),
        ]);

      const results = await db
        .from(schema.Users)
        .select(() => ({ type: schema.Users.type, total: count("*") }))
        .groupBy(() => schema.Users.type)
        .having(() => gte(count("*"), 2));

      // Only the "admin" group has >= 2 rows
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("admin");
      expect(results[0].total).toBe(2);
    });

    it("having with aggregate-to-aggregate generates valid SQL", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin", score: 10 }),
          createTestUser({ username: "a2", type: "admin", score: 20 }),
          createTestUser({ username: "u1", type: "user", score: 5 }),
          createTestUser({ username: "u2", type: "user", score: 6 }),
        ]);

      // sum(score) > count(*) — both aggregate groups satisfy this
      const results = await db
        .from(schema.Users)
        .select(() => ({
          type: schema.Users.type,
          total: count("*"),
          scoreSum: sum(schema.Users.score),
        }))
        .groupBy(() => schema.Users.type)
        .having(() => gt(sum(schema.Users.score), count("*")));

      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((r) => {
        expect(Number(r.scoreSum)).toBeGreaterThan(Number(r.total));
      });
    });

    it("having without explicit groupBy — auto GROUP BY still fires", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin" }),
          createTestUser({ username: "a2", type: "admin" }),
          createTestUser({ username: "u1", type: "user" }),
        ]);

      const query = db
        .from(schema.Users)
        .select(() => ({ type: schema.Users.type, total: count("*") }))
        .having(() => gte(count("*"), 2));

      const sql = query.toQuery().sql;
      // auto GROUP BY should include `type`, then HAVING follows
      expect(sql).toContain("GROUP BY");
      expect(sql).toContain("HAVING");

      const results = await query;
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("admin");
    });

    it("GROUP BY + HAVING + WHERE + ORDER BY clause ordering", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin" }),
          createTestUser({ username: "a2", type: "admin" }),
          createTestUser({ username: "u1", type: "user" }),
          createTestUser({ username: "u2", type: "user" }),
          createTestUser({ username: "u3", type: "user" }),
        ]);

      const query = db
        .from(schema.Users)
        .select(() => ({ type: schema.Users.type, total: count("*") }))
        .where(() => eq(schema.Users.status, "active"))
        .groupBy(() => schema.Users.type)
        .having(() => gte(count("*"), 2))
        .orderBy(() => asc(schema.Users.type));

      const sql = query.toQuery().sql;
      const wherePos = sql.indexOf("WHERE");
      const groupByPos = sql.indexOf("GROUP BY");
      const havingPos = sql.indexOf("HAVING");
      const orderByPos = sql.indexOf("ORDER BY");

      // Verify clause ordering: WHERE < GROUP BY < HAVING < ORDER BY
      expect(wherePos).toBeLessThan(groupByPos);
      expect(groupByPos).toBeLessThan(havingPos);
      expect(havingPos).toBeLessThan(orderByPos);

      const results = await query;
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("having accepts an aggregate wrapped in a scalar function", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin", score: 4 }),
          createTestUser({ username: "a2", type: "admin", score: 6 }),
          createTestUser({ username: "u1", type: "user", score: 1 }),
        ]);

      const query = db
        .from(schema.Users)
        .select(() => ({
          type: schema.Users.type,
          averageScore: round(avg(schema.Users.score), 1),
        }))
        .groupBy(() => schema.Users.type)
        .having(() => gt(round(avg(schema.Users.score), 1), 2));

      // PostgreSQL accepts an aggregate in HAVING, wrapped or not.
      expect(query.toQuery().sql).toContain(
        'HAVING round(avg("users"."score"), 1) > 2',
      );

      const results = await query;
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("admin");
      expect(Number(results[0].averageScore)).toBe(5);
    });

    it("having accepts an aggregate nested in and()", async () => {
      await db
        .insertInto(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin", score: 4 }),
          createTestUser({ username: "a2", type: "admin", score: 6 }),
          createTestUser({ username: "u1", type: "user", score: 1 }),
        ]);

      const results = await db
        .from(schema.Users)
        .select(() => ({
          type: schema.Users.type,
          total: count("*"),
          averageScore: avg(schema.Users.score),
        }))
        .groupBy(() => schema.Users.type)
        .having(() =>
          and(
            gte(count("*"), 2),
            gt(coalesce(round(avg(schema.Users.score), 1), 0), 2),
          ),
        );

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("admin");
      expect(results[0].total).toBe(2);
    });
  });
});
