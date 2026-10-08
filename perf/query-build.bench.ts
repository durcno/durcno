/**
 * Benchmarks the cost of *constructing* queries — the builder chain plus
 * `toQuery()` — without executing them: `camelToSnake` memoization, the
 * `escIdentifier` / `escLiteral` guards, cached column `fullName` / cast
 * strings, the memoized columns view. No database is involved: the stub
 * connector throws if a query is ever issued, and every body builds a fresh
 * builder, as real usage does.
 *
 * **The blocks are grouped by the kind of optimization they hold**, not by the
 * query they build (see the `describe` titles), and no mechanism is benched
 * twice — a later change of a kind that already has a bench reuses that bench.
 *
 * Siblings: `handle-rows.bench.ts` and `query-overhead.bench.ts` (row
 * conversion, promise overhead), `query-build.ab.ts` (two builds of these
 * paths), `sql-loops.paths.ts` and `sqlfn-tosql.paths.ts` (loop-form questions a
 * bench cannot settle).
 *
 * `pnpm bench`. Reading the numbers: AGENTS.md (Performance).
 */
import {
  and,
  arrayContainedBy,
  arrayContains,
  arrayOverlaps,
  asc,
  coalesce,
  concat,
  count,
  database,
  defineConfig,
  desc,
  eq,
  greatest,
  gt,
  gte,
  isIn,
  jsonAgg,
  jsonBuildArray,
  jsonBuildObject,
  jsonbBuildObject,
  least,
  lower,
  Query,
  sql,
} from "durcno";
import { describe, test } from "vitest";
import * as schema from "./schema";
import { createStubConnector } from "./stub-connector";

const db = database(
  schema,
  defineConfig({
    schema: "./schema.ts",
    connector: createStubConnector(),
  }),
);

const BULK_ROWS = 2000;

const bulkEvents = Array.from({ length: BULK_ROWS }, (_, i) => ({
  articleId: BigInt(i),
  kind: `event_${i % 17}`,
  source: `source_${i % 5}`,
  payload: `payload of event ${i}`,
  amount: BigInt(i) * 100n,
  isProcessed: i % 2 === 0,
  occurredAt: new Date(2024, 5, 1),
  role: "user" as const,
}));

/** Rows that leave five of `Events`'s nine columns out, so they render `DEFAULT`. */
const partialEvents = Array.from({ length: 50 }, (_, i) => ({
  kind: `event_${i % 17}`,
  isProcessed: i % 2 === 0,
  occurredAt: new Date(2024, 5, 1),
  role: "user" as const,
}));

const tags = ["typescript", "postgres", "orm", "query-builder"];
const pair: [string, string] = ["typescript", "postgres"];

describe("query build", () => {
  test('select("*")', async ({ bench, task }) => {
    await bench(task.name, () => {
      db.from(schema.Users).select("*").toQuery();
    }).run();
  });

  test('select("*") + where + orderBy + limit', async ({ bench, task }) => {
    await bench(task.name, () => {
      db.from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.age, 30))
        .orderBy(() => asc(schema.Users.userName))
        .limit(100)
        .toQuery();
    }).run();
  });

  test("insert 50 rows", async ({ bench, task }) => {
    await bench(task.name, () => {
      const values = Array.from({ length: 50 }, (_, i) => ({
        title: `post ${i}`,
        body: `body of post ${i}`,
        views: i * 10,
        userId: BigInt(i),
      }));
      db.insertInto(schema.Posts).values(values).toQuery();
    }).run();
  });

  test(`insert ${BULK_ROWS} rows x 9 cols`, async ({ bench, task }) => {
    await bench(task.name, () => {
      db.insertInto(schema.Events).values(bulkEvents).toQuery();
    }).run();
  });

  test("update + where", async ({ bench, task }) => {
    await bench(task.name, () => {
      db.update(schema.Users)
        .set({ age: 31, bio: "updated" })
        .where(eq(schema.Users.id, 1n))
        .toQuery();
    }).run();
  });

  test("delete + where", async ({ bench, task }) => {
    await bench(task.name, () => {
      db.deleteFrom(schema.Comments)
        .where(eq(schema.Comments.postId, 1n))
        .toQuery();
    }).run();
  });
});

/**
 * Per-table and per-class memos: the columns view, the `INSERT`'s column list,
 * the `$updateFn` column set, and the JSON kind of a function class.
 *
 * The two left-join cases share an identical query and differ only in how many
 * methods follow the joins, so their ratio is the signal: cost per query used to
 * grow with the length of the chain.
 */
describe("query build — cached per table / per class", () => {
  test("columns view — 2 left joins", async ({ bench, task }) => {
    await bench(task.name, () => {
      db.from(schema.Articles)
        .leftJoin(schema.ArticleRevisions)
        .on(() => eq(schema.ArticleRevisions.articleId, schema.Articles.id))
        .leftJoin(schema.ArticleRatings)
        .on(() => eq(schema.ArticleRatings.articleId, schema.Articles.id))
        .select("*")
        .toQuery();
    }).run();
  });

  test("columns view — 2 left joins + 5 chained methods", async ({
    bench,
    task,
  }) => {
    await bench(task.name, () => {
      db.from(schema.Articles)
        .leftJoin(schema.ArticleRevisions)
        .on(() => eq(schema.ArticleRevisions.articleId, schema.Articles.id))
        .leftJoin(schema.ArticleRatings)
        .on(() => eq(schema.ArticleRatings.articleId, schema.Articles.id))
        .select("*")
        .where(() => gte(schema.Articles.wordCount, 100))
        .orderBy(() => asc(schema.Articles.title))
        .groupBy(() => [schema.Articles.id])
        .having(() => gte(count("*"), 1))
        .limit(50)
        .toQuery();
    }).run();
  });

  test("insert — 50 rows, 5 of 9 columns omitted", async ({ bench, task }) => {
    await bench(task.name, () => {
      db.insertInto(schema.Events)
        .values(partialEvents)
        .returning({ id: true, kind: true, amount: true })
        .toQuery();
    }).run();
  });

  test("update — $updateFn columns", async ({ bench, task }) => {
    await bench(task.name, () => {
      db.update(schema.Sessions)
        .set({ hits: 5 })
        .where(eq(schema.Sessions.id, 1n))
        .toQuery();
    }).run();
  });

  test("select — json_build_object + json_build_array", async ({
    bench,
    task,
  }) => {
    await bench(task.name, () => {
      db.from(schema.Articles)
        .select(() => ({
          id: schema.Articles.id,
          meta: jsonBuildObject({
            title: schema.Articles.title,
            slug: schema.Articles.slug,
            author: schema.Articles.authorName,
            language: schema.Articles.language,
            category: schema.Articles.category,
          }),
          pair: jsonbBuildObject({ word: schema.Articles.wordCount }),
          list: jsonBuildArray(
            schema.Articles.id,
            schema.Articles.title,
            schema.Articles.slug,
            schema.Articles.status,
          ),
        }))
        .toQuery();
    }).run();
  });
});

/**
 * SQL that is appended straight to `query.sql`, where a list of fragments used
 * to be assembled and joined first. Every case here is dominated by that list:
 * variadic arguments, array literals, a clause of columns, a `RETURNING` map, a
 * relation's `json_build_object` arguments.
 */
describe("query build — streamed, not assembled", () => {
  test("select — concat/coalesce/greatest/least x 8", async ({
    bench,
    task,
  }) => {
    await bench(task.name, () => {
      db.from(schema.Articles)
        .select(() => ({
          id: schema.Articles.id,
          a: coalesce(schema.Articles.title, "none"),
          b: concat(schema.Articles.title, schema.Articles.slug),
          c: coalesce(schema.Articles.category, schema.Articles.language),
          d: concat(schema.Articles.category, schema.Articles.status),
          e: greatest(schema.Articles.wordCount, schema.Articles.commentCount),
          f: least(schema.Articles.wordCount, schema.Articles.commentCount),
          g: concat(schema.Articles.authorName, schema.Articles.authorEmail),
          h: coalesce(schema.Articles.summary, "none"),
        }))
        .toQuery();
    }).run();
  });

  test("where — array filters", async ({ bench, task }) => {
    await bench(task.name, () => {
      db.from(schema.Listings)
        .select("*")
        .where(() =>
          and(
            arrayContains(schema.Listings.tags, tags),
            arrayContainedBy(schema.Listings.tags, tags),
            arrayOverlaps(schema.Listings.tags, tags),
            arrayContains(schema.Listings.pairs, pair),
          ),
        )
        .toQuery();
    }).run();
  });

  test("relational — nested findMany", async ({ bench, task }) => {
    await bench(task.name, () => {
      db.query(schema.Users)
        .findMany({ with: { posts: { with: { comments: {} } } } })
        .toQuery();
    }).run();
  });

  test("insert — onConflict doUpdateSet + returning", async ({
    bench,
    task,
  }) => {
    await bench(task.name, () => {
      db.insertInto(schema.Posts)
        .values({
          title: "post",
          body: "body of post",
          views: 10,
          userId: 1n,
        })
        .onConflict(schema.Posts.views, schema.Posts.title)
        .doUpdateSet(
          ({ excluded }) => ({ views: excluded.views, body: "updated" }),
          ({ excluded }) => gt(excluded.views, 0),
        )
        .returning("*")
        .toQuery();
    }).run();
  });

  test("delete — returning(exclusion map)", async ({ bench, task }) => {
    await bench(task.name, () => {
      db.deleteFrom(schema.Comments)
        .where(eq(schema.Comments.postId, 1n))
        .returning({ body: false })
        .toQuery();
    }).run();
  });

  test("select — distinctOn(3)", async ({ bench, task }) => {
    await bench(task.name, () => {
      db.from(schema.Articles)
        .distinctOn(() => [
          schema.Articles.category,
          schema.Articles.language,
          schema.Articles.status,
        ])
        .select("*")
        .toQuery();
    }).run();
  });

  test("with — 3 CTEs", async ({ bench, task }) => {
    await bench(task.name, () => {
      const active = db.with("active").as(
        db
          .from(schema.Users)
          .select("*")
          .where(() => gte(schema.Users.points, 10n)),
      );
      const named = db
        .with("named")
        .as(
          db.from(schema.Users).select(() => ({ name: schema.Users.userName })),
        );
      const rich = db.with("rich").as(
        db
          .from(schema.Users)
          .select("*")
          .where(() => gte(schema.Users.points, 100n)),
      );
      db.with(active, named, rich)
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.bio, "updated"))
        .toQuery();
    }).run();
  });
});

/**
 * How the loop is written, where the separator goes, and what is read once.
 * `Sql` templates are timed on their own because the surrounding query dwarfs
 * them; both methods walk `strings` and `params` in lockstep, so the index is
 * load-bearing there — `perf/sql-loops.paths.ts` is what settles the loop form.
 */
describe("query build — loop form, separators, hoisting", () => {
  const wide = sql`coalesce(${schema.Articles.title}, ${
    schema.Articles.slug
  }) = ${"a-b-c"} AND ${schema.Articles.wordCount} > ${100} AND ${sql`lower(${
    schema.Articles.authorEmail
  })`} IS NOT NULL AND ${lower(schema.Articles.authorName)} <> ${
    schema.Articles.language
  } AND ${true} AND ${2024} AND ${1_000n}`;

  /** Reset in place, so the timed region is the render and nothing else. */
  const target = new Query("", () => []);

  test("raw sql template — toSQL() — 11 params", async ({ bench, task }) => {
    await bench(task.name, () => {
      wide.toSQL();
    }).run();
  });

  test("raw sql template — toQuery() — 11 params", async ({ bench, task }) => {
    await bench(task.name, () => {
      target.sql = "";
      wide.toQuery(target);
    }).run();
  });

  test("select — 12 explicit cols + auto GROUP BY + orderBy(alias)", async ({
    bench,
    task,
  }) => {
    await bench(task.name, () => {
      db.from(schema.Users)
        .select(() => ({
          userName: schema.Users.userName,
          email: schema.Users.email,
          bio: schema.Users.bio,
          age: schema.Users.age,
          points: schema.Users.points,
          balance: schema.Users.balance,
          isActive: schema.Users.isActive,
          isVerified: schema.Users.isVerified,
          birthDate: schema.Users.birthDate,
          createdAt: schema.Users.createdAt,
          role: schema.Users.role,
          total: count("*"),
        }))
        .orderBy((_, { userName }) => [asc(userName)])
        .toQuery();
    }).run();
  });

  test("select — aggregate orderBy x 2", async ({ bench, task }) => {
    await bench(task.name, () => {
      db.from(schema.Posts)
        .select(() => ({
          id: schema.Posts.id,
          titles: jsonAgg(schema.Posts.title).orderBy(
            asc(schema.Posts.publishedAt),
            desc(schema.Posts.views),
          ),
        }))
        .toQuery();
    }).run();
  });

  test("where — isIn(6 values)", async ({ bench, task }) => {
    await bench(task.name, () => {
      db.from(schema.Users)
        .select("*")
        .where(() =>
          isIn(schema.Users.userName, [
            "mahdi",
            "sara",
            "reza",
            "nima",
            "ali",
            "sina",
          ]),
        )
        .toQuery();
    }).run();
  });
});
