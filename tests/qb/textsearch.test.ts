import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  Arg,
  database,
  defineConfig,
  eq,
  numnode,
  phrasetoTsquery,
  plaintoTsquery,
  Query,
  querytree,
  setweight,
  strip,
  toTsquery,
  toTsvector,
  tsHeadline,
  tsMatch,
  tsRank,
  tsRankCd,
  websearchToTsquery,
} from "durcno";
import { pg } from "durcno/connectors/pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema";
import {
  generateMigrationsDirPath,
  runDurcnoCli,
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
  truncateTables,
} from "./setup";

describe("Full-text search", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("textsearch");

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
    await truncateTables(client);
  });

  afterAll(async () => {
    if (client) await client.close();
    if (db) await db.close();
    if (container) await stopPostgresContainer(container);
  });

  async function insertDocument(body: string, search: string): Promise<bigint> {
    const [row] = await db
      .insertInto(schema.SearchDocuments)
      .values({ body, search })
      .returning({ id: true });
    return row.id;
  }

  it("evaluates full-text search functions", async () => {
    const id = await insertDocument("The fat quick rat", "'fat':2 'rat':4");

    const [row] = await db
      .from(schema.SearchDocuments)
      .select(() => ({
        simple: toTsvector(schema.SearchDocuments.body, "simple"),
        defaultConfig: toTsvector(schema.SearchDocuments.body),
        nullVector: toTsvector(null),
        explicit: toTsquery("fat & rat"),
        plain: plaintoTsquery("fat rat"),
        phrase: phrasetoTsquery("fat rat"),
        web: websearchToTsquery("fat rat"),
        nullQuery: toTsquery(null),
        rank: tsRank(schema.SearchDocuments.search, toTsquery("fat")),
        rankCd: tsRankCd(schema.SearchDocuments.search, toTsquery("fat")),
        normalized: tsRank(schema.SearchDocuments.search, toTsquery("fat"), 32),
        nullRank: tsRank(null, toTsquery("fat")),
        headline: tsHeadline(schema.SearchDocuments.body, toTsquery("fat"), {
          config: "simple",
          options: "StartSel=<mark>, StopSel=</mark>",
        }),
        weighted: setweight(
          toTsvector(schema.SearchDocuments.body, "simple"),
          "A",
        ),
        stripped: strip(schema.SearchDocuments.search),
        nullStrip: strip(null),
        tree: querytree(toTsquery("fat & rat")),
        nodes: numnode(toTsquery("fat & rat")),
      }))
      .where(() => eq(schema.SearchDocuments.id, id));

    expect(row.simple).toBe("'fat':2 'quick':3 'rat':4 'the':1");
    expect(row.defaultConfig).toContain("'quick'");
    expect(row.nullVector).toBeNull();
    expect(row.explicit).toBe("'fat' & 'rat'");
    expect(row.plain).toBe("'fat' & 'rat'");
    expect(row.phrase).toBe("'fat' <-> 'rat'");
    expect(row.web).toBe("'fat' & 'rat'");
    expect(row.nullQuery).toBeNull();
    expect(row.rank).toBeGreaterThan(0);
    expect(row.rankCd).toBeGreaterThan(0);
    expect(row.normalized).toBeGreaterThan(0);
    expect(row.nullRank).toBeNull();
    expect(row.headline).toContain("<mark>fat</mark>");
    expect(row.weighted).toBe("'fat':2A 'quick':3A 'rat':4A 'the':1A");
    expect(row.stripped).toBe("'fat' 'rat'");
    expect(row.nullStrip).toBeNull();
    expect(row.tree).toBe("'fat' & 'rat'");
    expect(row.nodes).toBe(3);
  });

  it("filters rows with tsMatch", async () => {
    const fatId = await insertDocument("fat rat", "'fat':1 'rat':2");
    await insertDocument("cat dog", "'cat':1 'dog':2");

    const rows = await db
      .from(schema.SearchDocuments)
      .select(() => ({ id: schema.SearchDocuments.id }))
      .where(() =>
        tsMatch(schema.SearchDocuments.search, toTsquery("fat & rat")),
      );

    expect(rows.map((r) => r.id)).toEqual([fatId]);
  });

  it("casts config and search operands", () => {
    const query = new Query("", () => []);
    toTsvector(
      schema.SearchDocuments.body,
      new Arg<string>((value) => value),
    ).toQuery(query);
    query.sql += " ";
    tsMatch(
      new Arg<string>((value) => value),
      new Arg<string>((value) => value),
    ).toQuery(query);
    query.sql += " ";
    tsMatch(schema.SearchDocuments.search, "fat").toQuery(query);

    expect(query.sql).toContain("::regconfig");
    expect(query.sql).toContain("::tsvector");
    expect(query.sql).toContain("::tsquery");
    expect(query.sql).toContain("'fat'::tsquery");
  });
});
