import fs from "node:fs";
import path from "node:path";
import { count, index, lower, pk, table, text, toTsvector } from "durcno";
import { ddl, MIGRATION_NAME_REGEX, snapshot } from "durcno/migration";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
} from "../../../docker-utils";
import { rmSync, runDurcno } from "../../../helpers";

describe("durcno generate - expression indexes", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  let containerInfo: TestContainerInfo;
  let client: pg.Client;

  function runGenerateAndMigrate(stage: number): {
    success: boolean;
    output: string;
  } {
    const env = {
      ...process.env,
      STAGE: String(stage),
      DATABASE_PORT: String(containerInfo.port),
    };

    let genOutput = "";
    try {
      genOutput = runDurcno(
        ["generate", "--config", configPath],
        env,
        process.cwd(),
      );
    } catch (e: unknown) {
      return {
        success: false,
        output: e instanceof Error ? e.message : String(e),
      };
    }

    try {
      const migrateOutput = runDurcno(
        ["migrate", "--config", configPath],
        env,
        __dirname,
      );
      return {
        success: true,
        output: genOutput + migrateOutput,
      };
    } catch (e: unknown) {
      return {
        success: false,
        output: genOutput + (e instanceof Error ? e.message : String(e)),
      };
    }
  }

  function getMigrationFolders(): string[] {
    if (!fs.existsSync(migrationsDir)) return [];
    return fs
      .readdirSync(migrationsDir)
      .filter((f) => MIGRATION_NAME_REGEX.test(f))
      .sort();
  }

  async function getPostsIndexes(): Promise<
    { indexname: string; indexdef: string }[]
  > {
    const result = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename = 'posts'
      AND indexname != 'posts_pkey'
      ORDER BY indexname;
    `);
    return result.rows;
  }

  beforeAll(async () => {
    rmSync(migrationsDir);
    delete process.env.STAGE;

    containerInfo = await startPostgresContainer({
      user: "testuser",
      password: "testpass",
      dbName: "testdb",
    });
    client = new pg.Client(containerInfo.connectionString);
    await client.connect();
  }, 120000);

  afterAll(async () => {
    await client?.end().catch(console.error);
    await stopPostgresContainer(containerInfo.container);
  });

  it("requires an explicit name for expression indexes", () => {
    expect(() =>
      snapshot([
        table(
          "public",
          "unnamed_expression_index",
          { id: pk(), content: text({}) },
          {
            indexes: (t) => [index([toTsvector(t.content, "english")])],
          },
        ),
      ]),
    ).toThrow(/Expression indexes require an explicit name/);
  });

  it("rejects aggregate function keys at runtime", () => {
    const Cases = table("public", "aggregate_index", {
      id: pk(),
    });

    const statement = ddl
      .createIndex("aggregate_index")
      .on("public", "aggregate_index", [
        // @ts-expect-error aggregates are not valid index expressions
        count(Cases.id),
      ]);

    expect(() => statement.toSQL()).toThrow(/scalar functions only/);
  });

  it("normalizes camelCase table names for DDL expression keys", () => {
    const CamelPosts = table(
      "public",
      "camelPosts",
      { id: pk(), title: text({ notNull: true }) },
      {
        indexes: (t) => [
          index("camel_posts_lower_title_idx", [lower(t.title)]),
        ],
      },
    );
    const schemaSnapshot = snapshot([CamelPosts]);
    const replaySnapshot = snapshot([CamelPosts]);
    replaySnapshot.tables["public.camel_posts"].indexes = {};

    const statement = ddl
      .createIndex("camel_posts_lower_title_idx")
      .on("public", "camel_posts", [lower(CamelPosts.title)]);
    statement.applyToSnapshot(replaySnapshot);

    expect(statement.toSQL()).toContain('lower("title")');
    expect(
      replaySnapshot.tables["public.camel_posts"].indexes
        .camel_posts_lower_title_idx.columns,
    ).toEqual(
      schemaSnapshot.tables["public.camel_posts"].indexes
        .camel_posts_lower_title_idx.columns,
    );

    const camelReplay = snapshot([CamelPosts]);
    camelReplay.tables["public.camel_posts"].indexes = {};
    const camelStatement = ddl
      .createIndex("camel_posts_lower_title_idx")
      .on("public", "camelPosts", [lower(CamelPosts.title)]);
    expect(camelStatement.toSQL()).toContain('"public"."camel_posts"');
    camelStatement.applyToSnapshot(camelReplay);
    expect(
      camelReplay.tables["public.camel_posts"].indexes
        .camel_posts_lower_title_idx,
    ).toBeDefined();
  });

  it("[stage 1] should create function-builder expression indexes", async () => {
    const result = runGenerateAndMigrate(1);
    expect(result.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(1);

    const upFile = fs.readFileSync(
      path.resolve(migrationsDir, folders[0], "up.ts"),
      "utf-8",
    );
    expect(upFile).toContain("sql.raw(");
    expect(upFile).toContain("to_tsvector");

    const indexes = await getPostsIndexes();
    expect(indexes).toHaveLength(3);

    const contentIdx = indexes.find(
      (i) => i.indexname === "posts_content_tsv_idx",
    );
    expect(contentIdx?.indexdef).toContain("USING gin");
    expect(contentIdx?.indexdef).toContain(
      "to_tsvector('english'::regconfig, content)",
    );

    const titleIdx = indexes.find((i) => i.indexname === "posts_title_tsv_idx");
    expect(titleIdx?.indexdef).toContain("USING gin");
    expect(titleIdx?.indexdef).toContain(
      "to_tsvector('english'::regconfig, (title)::text)",
    );

    const lowerIdx = indexes.find(
      (i) => i.indexname === "posts_lower_title_uidx",
    );
    expect(lowerIdx?.indexdef).toContain("UNIQUE");
    expect(lowerIdx?.indexdef).toContain("lower(");
    expect(lowerIdx?.indexdef).toContain("title");
  });

  it("[stage 1] should detect no changes for expression indexes", () => {
    const output = runDurcno(
      ["generate", "--config", configPath],
      {
        ...process.env,
        STAGE: "1",
        DATABASE_PORT: String(containerInfo.port),
      },
      process.cwd(),
    );

    expect(output).toContain("No changes detected");
    expect(getMigrationFolders()).toHaveLength(1);
  });

  it("[stage 1] should enforce uniqueness through the expression index", async () => {
    await client.query(
      `INSERT INTO posts (title, content) VALUES ('Hello World', 'body')`,
    );

    await expect(
      client.query(
        `INSERT INTO posts (title, content) VALUES ('hello world', 'body')`,
      ),
    ).rejects.toThrow();
  });

  it("[stage 2] should drop and recreate a changed expression index", async () => {
    const result = runGenerateAndMigrate(2);
    expect(result.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);

    const upFile = fs.readFileSync(
      path.resolve(migrationsDir, folders[1], "up.ts"),
      "utf-8",
    );
    expect(upFile).toContain('ddl.dropIndex("posts_content_tsv_idx")');
    expect(upFile).toContain("sql.raw(");
    expect(upFile).toContain("simple");

    const indexes = await getPostsIndexes();
    expect(indexes).toHaveLength(3);

    const contentIdx = indexes.find(
      (i) => i.indexname === "posts_content_tsv_idx",
    );
    expect(contentIdx?.indexdef).toContain(
      "to_tsvector('simple'::regconfig, content)",
    );
  });

  it("[stage 3] should drop all expression indexes", async () => {
    const result = runGenerateAndMigrate(3);
    expect(result.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(3);

    const upFile = fs.readFileSync(
      path.resolve(migrationsDir, folders[2], "up.ts"),
      "utf-8",
    );
    expect(upFile).toContain('ddl.dropIndex("posts_content_tsv_idx")');
    expect(upFile).toContain('ddl.dropIndex("posts_title_tsv_idx")');
    expect(upFile).toContain('ddl.dropIndex("posts_lower_title_uidx")');

    expect(await getPostsIndexes()).toHaveLength(0);
  });

  it("[stage 4] should escape generated WHERE predicates", async () => {
    const result = runGenerateAndMigrate(4);
    expect(result.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(4);

    const upFile = fs.readFileSync(
      path.resolve(migrationsDir, folders[3], "up.ts"),
      "utf-8",
    );
    expect(upFile).toContain('.where("');
    expect(upFile).not.toContain(".where(`");
    expect(upFile).toContain(`a\`b\${c}`);

    expect(await getPostsIndexes()).toHaveLength(1);
  });
});
