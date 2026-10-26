import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  asc,
  count,
  cumeDist,
  currentRow,
  database,
  defineConfig,
  denseRank,
  desc,
  eq,
  firstValue,
  lag,
  lastValue,
  lead,
  nthValue,
  ntile,
  percentRank,
  preceding,
  rank,
  rowNumber,
  rows,
  sum,
  unboundedPreceding,
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

describe("SELECT window functions", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("select-window");

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

  /**
   * Seeds four users (ids 1-4 in insertion order):
   * alice admin/4, bob admin/6, charlie user/6, dave user/20.
   * The bob/charlie score tie lets rank vs dense_rank be told apart.
   */
  async function seedUsers() {
    await db
      .insertInto(schema.Users)
      .values([
        createTestUser({ username: "alice", type: "admin", score: 4 }),
        createTestUser({ username: "bob", type: "admin", score: 6 }),
        createTestUser({ username: "charlie", type: "user", score: 6 }),
        createTestUser({ username: "dave", type: "user", score: 20 }),
      ]);
  }

  // =========================================================================
  // Aggregates with OVER
  // =========================================================================

  describe("aggregates with OVER", () => {
    it("should return one row per record plus a grand total, without GROUP BY", async () => {
      await seedUsers();

      const query = db.from(schema.Users).select(() => ({
        username: schema.Users.username,
        score: schema.Users.score,
        grandTotal: sum(schema.Users.score).over(),
      }));

      // A window function does not aggregate the query; the auto GROUP BY
      // must stay absent.
      expect(query.toQuery().sql).not.toContain("GROUP BY");
      expect(query.toQuery().sql).toContain(" OVER ()");

      const results = await query;
      expect(results).toHaveLength(4);
      expect(results.map((r) => r.grandTotal)).toEqual([36, 36, 36, 36]);
    });

    it("should partition totals per group", async () => {
      await seedUsers();

      const results = await db
        .from(schema.Users)
        .select(() => ({
          username: schema.Users.username,
          typeTotal: sum(schema.Users.score).over({
            partitionBy: [schema.Users.type],
          }),
        }))
        .orderBy(() => asc(schema.Users.id));

      expect(results.map((r) => r.typeTotal)).toEqual([10, 10, 26, 26]);
    });

    it("should render FILTER before OVER", async () => {
      await seedUsers();

      const query = db.from(schema.Users).select(() => ({
        adminCount: count(schema.Users.id)
          .filter(eq(schema.Users.type, "admin"))
          .over(),
      }));

      const sql = query.toQuery().sql;
      expect(sql).toContain("FILTER (WHERE");
      expect(sql.indexOf("FILTER (WHERE")).toBeLessThan(sql.indexOf("OVER"));

      const results = await query;
      expect(results.map((r) => r.adminCount)).toEqual([2, 2, 2, 2]);
    });

    it("should emit only the plain columns in auto GROUP BY when a grouped aggregate and a window function share a projection", async () => {
      await seedUsers();

      const query = db.from(schema.Users).select(() => ({
        type: schema.Users.type,
        total: count("*"),
        windowedResultRows: count("*").over({
          partitionBy: [schema.Users.type],
        }),
      }));

      const sql = query.toQuery().sql;
      expect(sql).toContain('GROUP BY "users"."type"');
      expect(sql).not.toContain("GROUP BY count(*) OVER");

      const results = await query;
      expect(results).toHaveLength(2);
      // count(*) counts base rows per group...
      expect(results[0].total).toBe(2);
      // ...while the windowed call runs over the grouped result, one row per
      // partition.
      expect(results[0].windowedResultRows).toBe(1);
    });
  });

  // =========================================================================
  // Window ORDER BY and frame clauses
  // =========================================================================

  describe("window ORDER BY and frame clauses", () => {
    it("should compute a running total over an ordered frame", async () => {
      await seedUsers();

      const results = await db
        .from(schema.Users)
        .select(() => ({
          running: sum(schema.Users.score).over({
            orderBy: [asc(schema.Users.id)],
            frame: rows(unboundedPreceding()),
          }),
        }))
        .orderBy(() => asc(schema.Users.id));

      expect(results.map((r) => r.running)).toEqual([4, 10, 16, 36]);
    });

    it("should support offset frame endpoints", async () => {
      await seedUsers();

      const results = await db
        .from(schema.Users)
        .select(() => ({
          twoRowSum: sum(schema.Users.score).over({
            orderBy: [asc(schema.Users.id)],
            frame: rows(preceding(1)),
          }),
        }))
        .orderBy(() => asc(schema.Users.id));

      expect(results.map((r) => r.twoRowSum)).toEqual([4, 10, 12, 26]);
    });

    it("should render explicit frame endpoints and EXCLUDE", () => {
      const query = db.from(schema.Users).select(() => ({
        noTies: sum(schema.Users.score).over({
          frame: rows(unboundedPreceding(), currentRow(), "noOthers"),
        }),
      }));

      const sql = query.toQuery().sql;
      expect(sql).toContain(
        "ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW EXCLUDE NO OTHERS",
      );
    });
  });

  // =========================================================================
  // Pure window functions
  // =========================================================================

  describe("numbering functions", () => {
    it("rowNumber, rank, denseRank, percentRank, cumeDist and ntile should evaluate per partition order", async () => {
      await seedUsers();

      const results = await db
        .from(schema.Users)
        .select(() => ({
          username: schema.Users.username,
          position: rowNumber().over({ orderBy: [asc(schema.Users.id)] }),
          rank: rank().over({ orderBy: [asc(schema.Users.score)] }),
          dense: denseRank().over({ orderBy: [asc(schema.Users.score)] }),
          percentile: percentRank().over({
            orderBy: [asc(schema.Users.score)],
          }),
          dist: cumeDist().over({ orderBy: [asc(schema.Users.score)] }),
          half: ntile(2).over({ orderBy: [asc(schema.Users.id)] }),
        }))
        .orderBy(() => asc(schema.Users.id));

      expect(results.map((r) => r.position)).toEqual([1, 2, 3, 4]);
      // bob and charlie tie on score: rank keeps the gap, denseRank does not
      expect(results.map((r) => r.rank)).toEqual([1, 2, 2, 4]);
      expect(results.map((r) => r.dense)).toEqual([1, 2, 2, 3]);
      expect(results.map((r) => r.percentile)[1]).toBeCloseTo(1 / 3);
      expect(results.map((r) => r.percentile)[3]).toBe(1);
      expect(results.map((r) => r.dist)).toEqual([0.25, 0.75, 0.75, 1]);
      expect(results.map((r) => r.half)).toEqual([1, 1, 2, 2]);
    });
  });

  describe("value navigation functions", () => {
    it("lag and lead should return neighbouring partition rows", async () => {
      await seedUsers();

      const results = await db
        .from(schema.Users)
        .select(() => ({
          username: schema.Users.username,
          previous: lag(schema.Users.score).over({
            orderBy: [asc(schema.Users.id)],
          }),
          previousWithDefault: lag(schema.Users.username, 1, "none").over({
            orderBy: [asc(schema.Users.id)],
          }),
          next: lead(schema.Users.score).over({
            orderBy: [asc(schema.Users.id)],
          }),
        }))
        .orderBy(() => asc(schema.Users.id));

      expect(results.map((r) => r.previous)).toEqual([null, 4, 6, 6]);
      expect(results.map((r) => r.previousWithDefault)).toEqual([
        "none",
        "alice",
        "bob",
        "charlie",
      ]);
      expect(results.map((r) => r.next)).toEqual([6, 6, 20, null]);
    });

    it("firstValue, lastValue and nthValue should read rows of the frame", async () => {
      await seedUsers();

      const results = await db
        .from(schema.Users)
        .select(() => ({
          username: schema.Users.username,
          firstInType: firstValue(schema.Users.username).over({
            partitionBy: [schema.Users.type],
            orderBy: [asc(schema.Users.id)],
          }),
          lastInType: lastValue(schema.Users.username).over({
            partitionBy: [schema.Users.type],
            orderBy: [asc(schema.Users.id)],
            frame: rows(unboundedPreceding()),
          }),
          secondInQuery: nthValue(schema.Users.username, 2).over({
            orderBy: [asc(schema.Users.id)],
          }),
        }))
        .orderBy(() => asc(schema.Users.id));

      expect(results.map((r) => r.firstInType)).toEqual([
        "alice",
        "alice",
        "charlie",
        "charlie",
      ]);
      expect(results.map((r) => r.lastInType)).toEqual([
        "alice",
        "bob",
        "charlie",
        "dave",
      ]);
      expect(results.map((r) => r.secondInQuery)).toEqual([
        null,
        "bob",
        "bob",
        "bob",
      ]);
    });
  });

  // =========================================================================
  // Ordering and misuse
  // =========================================================================

  describe("window functions in query ORDER BY", () => {
    it("should order the result set by a window expression", async () => {
      await seedUsers();

      const results = await db
        .from(schema.Users)
        .select(() => ({ username: schema.Users.username }))
        .orderBy(() => [
          desc(
            sum(schema.Users.score).over({ partitionBy: [schema.Users.type] }),
          ),
          asc(schema.Users.username),
        ]);

      expect(results.map((r) => r.username)).toEqual([
        "charlie",
        "dave",
        "alice",
        "bob",
      ]);
    });
  });

  describe("misuse", () => {
    it("should reject an aggregate with an internal ORDER BY at build time", () => {
      expect(() =>
        sum(schema.Users.score)
          .orderBy(asc(schema.Users.id))
          .over({ partitionBy: [schema.Users.type] }),
      ).toThrow(/Aggregate ORDER BY is not implemented for window functions/);
    });
  });
});
