import fs from "node:fs";
import path from "node:path";
import type Docker from "dockerode";
import {
  type $Client,
  Arg,
  database,
  defineConfig,
  eq,
  Query,
  showTrgm,
  similar,
  similarity,
  strictWordSimilar,
  strictWordSimilarity,
  wordSimilar,
  wordSimilarity,
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

describe("pg_trgm", () => {
  let containerInfo: TestContainerInfo;
  let container: Docker.Container;
  let db: ReturnType<typeof database<typeof schema>>;
  let client: $Client;
  const migrationsDirName = generateMigrationsDirPath("pgtrgm");

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

    runDurcnoCli("push", configPath, containerInfo, migrationsDirName);

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
    client = db._.config.connector.getClient();
    await client.connect();
    await db.raw("CREATE EXTENSION IF NOT EXISTS pg_trgm");
  }, 120000);

  beforeEach(async () => {
    await truncateTables(client);
  });

  afterAll(async () => {
    if (client) await client.close();
    if (db) await db.close();
    if (container) await stopPostgresContainer(container);
  });

  async function insertDocument(body: string): Promise<bigint> {
    const [row] = await db
      .insertInto(schema.SearchDocuments)
      .values({ body, search: "" })
      .returning({ id: true });
    return row.id;
  }

  it("evaluates trigram functions", async () => {
    const id = await insertDocument("The fat quick rat");

    const [row] = await db
      .from(schema.SearchDocuments)
      .select(() => ({
        whole: similarity(schema.SearchDocuments.body, "fat rat"),
        word: wordSimilarity(schema.SearchDocuments.body, "fat"),
        strictWord: strictWordSimilarity(schema.SearchDocuments.body, "rat"),
        trigrams: showTrgm(schema.SearchDocuments.body),
        nullScore: similarity(null, "fat"),
        nullTrigrams: showTrgm(null),
      }))
      .where(() => eq(schema.SearchDocuments.id, id));

    expect(row.whole).toBeGreaterThan(0);
    expect(row.word).toBeGreaterThan(0);
    expect(row.strictWord).toBeGreaterThan(0);
    expect(row.trigrams.length).toBeGreaterThan(0);
    expect(row.trigrams.every((trigram) => typeof trigram === "string")).toBe(
      true,
    );
    expect(row.nullScore).toBeNull();
    expect(row.nullTrigrams).toBeNull();
  });

  it("filters rows with trigram predicates", async () => {
    const matchId = await insertDocument("postgres full text search");
    await insertDocument("unrelated data");

    const wholeMatches = await db
      .from(schema.SearchDocuments)
      .select(() => ({ id: schema.SearchDocuments.id }))
      .where(() => similar(schema.SearchDocuments.body, "postgres"));
    expect(wholeMatches.map((r) => r.id)).toEqual([matchId]);

    const wordMatches = await db
      .from(schema.SearchDocuments)
      .select(() => ({ id: schema.SearchDocuments.id }))
      .where(() => wordSimilar("postgres", schema.SearchDocuments.body));
    expect(wordMatches.map((r) => r.id)).toEqual([matchId]);

    const strictMatches = await db
      .from(schema.SearchDocuments)
      .select(() => ({ id: schema.SearchDocuments.id }))
      .where(() => strictWordSimilar("text", schema.SearchDocuments.body));
    expect(strictMatches.map((r) => r.id)).toEqual([matchId]);
  });

  it("renders trigram SQL with text casts", () => {
    const query = new Query("", () => []);
    const arg = new Arg<string>((value) => value);
    similar(schema.SearchDocuments.body, arg).toQuery(query);
    query.sql += " ";
    wordSimilar(schema.SearchDocuments.body, arg).toQuery(query);
    query.sql += " ";
    strictWordSimilar(schema.SearchDocuments.body, arg).toQuery(query);
    query.sql += " ";
    similarity(schema.SearchDocuments.body, "prog").toQuery(query);
    query.sql += " ";
    wordSimilarity(schema.SearchDocuments.body, arg).toQuery(query);
    query.sql += " ";
    strictWordSimilarity(schema.SearchDocuments.body, arg).toQuery(query);
    query.sql += " ";
    showTrgm(schema.SearchDocuments.body).toQuery(query);

    expect(query.sql).toContain(" % $1::text");
    expect(query.sql).toContain(" <% $1::text");
    expect(query.sql).toContain(" <<% $1::text");
    expect(query.sql).toContain("similarity(");
    expect(query.sql).toContain("word_similarity(");
    expect(query.sql).toContain("strict_word_similarity(");
    expect(query.sql).toContain("'prog'");
    expect(query.sql).toContain("show_trgm(");
  });
});
