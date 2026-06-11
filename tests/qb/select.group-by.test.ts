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
  gt,
  gte,
  lower,
  sum,
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
  // Basic GROUP BY
  // =========================================================================

  describe("explicit groupBy — direct form", () => {
    it("groupBy(col) produces the same SQL grouping as auto GROUP BY", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin" }),
          createTestUser({ username: "a2", type: "admin" }),
          createTestUser({ username: "u1", type: "user" }),
        ]);

      const results = await db
        .from(schema.Users)
        .select({ type: schema.Users.type, total: count("*") })
        .groupBy(schema.Users.type)
        .orderBy(asc(schema.Users.type));

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ type: "admin", total: 2 });
      expect(results[1]).toEqual({ type: "user", total: 1 });
    });

    it("groupBy([col1, col2]) groups by multiple columns", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin", status: "active" }),
          createTestUser({ username: "a2", type: "admin", status: "inactive" }),
          createTestUser({ username: "u1", type: "user", status: "active" }),
          createTestUser({ username: "u2", type: "user", status: "active" }),
        ]);

      const results = await db
        .from(schema.Users)
        .select({
          type: schema.Users.type,
          status: schema.Users.status,
          total: count("*"),
        })
        .groupBy([schema.Users.type, schema.Users.status])
        .orderBy([asc(schema.Users.type), asc(schema.Users.status)]);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ type: "admin", status: "active", total: 1 });
      expect(results[1]).toEqual({
        type: "admin",
        status: "inactive",
        total: 1,
      });
      expect(results[2]).toEqual({ type: "user", status: "active", total: 2 });
    });

    it("explicit groupBy overrides auto GROUP BY", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin", status: "active" }),
          createTestUser({ username: "a2", type: "admin", status: "inactive" }),
          createTestUser({ username: "u1", type: "user", status: "active" }),
        ]);

      // Only group by `status`, even though `type` is in select too
      const query = db
        .from(schema.Users)
        .select({ status: schema.Users.status, total: count("*") })
        .groupBy(schema.Users.status);

      const sql = query.toQuery().sql;
      expect(sql).toContain("GROUP BY");
      // The explicit groupBy should only contain status, not type
      expect(sql).toContain('"users"."status"');
      expect(sql).not.toContain('"users"."type"');
    });

    it("groupBy with scalar SqlFn expression", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "Alice", email: "alice@test.com" }),
          createTestUser({ username: "alice2", email: "alice2@test.com" }),
          createTestUser({ username: "Bob", email: "bob@test.com" }),
        ]);

      const results = await db
        .from(schema.Users)
        .select({
          lname: lower(schema.Users.username),
          total: count("*"),
        })
        .groupBy(lower(schema.Users.username))
        .orderBy(asc(lower(schema.Users.username)));
      // "Alice" and "alice2" group under different lower() values
      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // Callback form
  // =========================================================================

  describe("explicit groupBy — callback form", () => {
    it("callback form — single alias", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "Alice", email: "alice@test.com" }),
          createTestUser({ username: "alice2", email: "ALICE2@test.com" }),
          createTestUser({ username: "Bob", email: "bob@test.com" }),
        ]);

      const query = db
        .from(schema.Users)
        .select({ lname: lower(schema.Users.username), total: count("*") })
        .groupBy(({ lname }) => [lname]);

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
        .insert(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin" }),
          createTestUser({ username: "a2", type: "admin" }),
          createTestUser({ username: "u1", type: "user" }),
        ]);

      const query = db
        .from(schema.Users)
        .select({
          lname: lower(schema.Users.username),
          type: schema.Users.type,
          total: count("*"),
        })
        .groupBy(({ lname, type }) => [lname, type]);

      const sql = query.toQuery().sql;
      expect(sql).toContain('"lname"');
      expect(sql).toContain('"type"');
    });

    it("callback form — mix alias + direct column", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin" }),
          createTestUser({ username: "u1", type: "user" }),
        ]);

      const query = db
        .from(schema.Users)
        .select({ lname: lower(schema.Users.username), total: count("*") })
        .groupBy(({ lname }) => [lname, schema.Users.type]);

      const sql = query.toQuery().sql;
      expect(sql).toContain('"lname"');
      expect(sql).toContain('"users"."type"');
    });
  });

  // =========================================================================
  // HAVING
  // =========================================================================

  describe("having()", () => {
    it("having with literal — only returns groups with >= 2 rows", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin" }),
          createTestUser({ username: "a2", type: "admin" }),
          createTestUser({ username: "u1", type: "user" }),
        ]);

      const results = await db
        .from(schema.Users)
        .select({ type: schema.Users.type, total: count("*") })
        .groupBy(schema.Users.type)
        .having(gte(count("*"), 2));

      // Only the "admin" group has >= 2 rows
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe("admin");
      expect(results[0].total).toBe(2);
    });

    it("having with aggregate-to-aggregate generates valid SQL", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin", score: 10 }),
          createTestUser({ username: "a2", type: "admin", score: 20 }),
          createTestUser({ username: "u1", type: "user", score: 5 }),
          createTestUser({ username: "u2", type: "user", score: 6 }),
        ]);

      // sum(score) > count(*) — both aggregate groups satisfy this
      const results = await db
        .from(schema.Users)
        .select({
          type: schema.Users.type,
          total: count("*"),
          scoreSum: sum(schema.Users.score),
        })
        .groupBy(schema.Users.type)
        .having(gt(sum(schema.Users.score), count("*")));

      expect(results.length).toBeGreaterThanOrEqual(1);
      results.forEach((r) => {
        expect(Number(r.scoreSum)).toBeGreaterThan(Number(r.total));
      });
    });

    it("having without explicit groupBy — auto GROUP BY still fires", async () => {
      await db
        .insert(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin" }),
          createTestUser({ username: "a2", type: "admin" }),
          createTestUser({ username: "u1", type: "user" }),
        ]);

      const query = db
        .from(schema.Users)
        .select({ type: schema.Users.type, total: count("*") })
        .having(gte(count("*"), 2));

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
        .insert(schema.Users)
        .values([
          createTestUser({ username: "a1", type: "admin" }),
          createTestUser({ username: "a2", type: "admin" }),
          createTestUser({ username: "u1", type: "user" }),
          createTestUser({ username: "u2", type: "user" }),
          createTestUser({ username: "u3", type: "user" }),
        ]);

      const query = db
        .from(schema.Users)
        .select({ type: schema.Users.type, total: count("*") })
        .where(eq(schema.Users.status, "active"))
        .groupBy(schema.Users.type)
        .having(gte(count("*"), 2))
        .orderBy(asc(schema.Users.type));

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
  });
});
