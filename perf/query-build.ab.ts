#!/usr/bin/env node
/**
 * Same-process A/B of the query-construction path, across two builds.
 * `query-build.bench.ts` measures the current build in absolute terms; this asks
 * whether a change made the same SQL cheaper, which for a render path of a few
 * percent takes both builds in one process.
 *
 * One case per changed path, named by the mechanism it exercises and ordered by
 * that name — the order `query-build.bench.ts` uses for its blocks. A case is a
 * `(db, schema, module)` factory, so both sides build an identical schema and run
 * the identical closure from their own module; a change of a kind that already
 * has a case reuses it.
 *
 * The schema is declared here rather than imported from `perf/schema.ts`, whose
 * tables are built with the linked `durcno` — both builds would share one set of
 * table objects. Keep the shapes in step by hand: what matters is that the two
 * sides are comparable to each other, not that they match the vitest bench.
 *
 * Usage (from the repo root):
 *
 *   pnpm build && cp -r dist .ab-old
 *   # ...change the code...
 *   pnpm build && node perf/query-build.ab.ts .ab-old dist
 *
 * Both directories must sit **inside the repo** — outside it, Node cannot walk up
 * to this repo's `node_modules` and resolving `zod` fails. They are not
 * gitignored, so delete them when you are done. Trailing arguments select cases
 * by name or by group prefix (`anchor`, `cached`, `streamed`, `loops`, `clauses`).
 *
 * Reading the numbers: AGENTS.md (Performance).
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createStubConnector } from "./stub-connector.ts";

/** The shape both builds are imported as. */
type Durcno = typeof import("durcno");

const [oldDir, newDir, ...filters] = process.argv.slice(2);
if (!oldDir || !newDir) {
  console.error(
    "usage: query-build.ab.ts <oldDistDir> <newDistDir> [case|group...]",
  );
  process.exit(1);
}

// Absolute file URLs, so the snapshots resolve as modules and their own
// `node_modules` lookup walks up into this repo's.
const url = (dir: string, file: string) =>
  pathToFileURL(resolve(dir, file)).href;

async function load(dir: string): Promise<Durcno> {
  return (await import(url(dir, "src/index.mjs"))) as Durcno;
}

/** Builds an identical schema for one build, mirroring `perf/schema.ts`. */
function buildSchema(idx: Durcno) {
  const {
    array,
    bigint,
    boolean,
    date,
    enumtype,
    integer,
    many,
    notNull,
    pk,
    relations,
    table,
    text,
    timestamptz,
    tuple,
    varchar,
  } = idx;

  const RoleEnum = enumtype("public", "role", ["admin", "user", "moderator"]);
  const Users = table("public", "users", {
    id: pk(),
    userName: varchar({ length: 50, notNull }),
    email: varchar({ length: 100 }),
    bio: text({}),
    age: integer({}),
    points: bigint({}),
    balance: bigint({ notNull }),
    isActive: boolean({ notNull }),
    isVerified: boolean({}),
    birthDate: date({}),
    createdAt: timestamptz({ notNull }),
    role: RoleEnum.enumed({ notNull }),
  });
  const Posts = table("public", "posts", {
    id: pk(),
    title: varchar({ length: 200, notNull }),
    body: text({ notNull }),
    views: integer({ notNull }),
    publishedAt: timestamptz({}),
    userId: bigint({ notNull }).references({ column: () => Users.id }),
  });
  const Comments = table("public", "comments", {
    id: pk(),
    body: text({ notNull }),
    postId: bigint({ notNull }).references({ column: () => Posts.id }),
  });

  // Wide tables: a `LEFT JOIN` clones every column of the joined table to make
  // it nullable, so the columns view scales with the joined column counts.
  const Articles = table("public", "articles", {
    id: pk(),
    slug: varchar({ length: 200, notNull }),
    title: varchar({ length: 300, notNull }),
    summary: text({}),
    body: text({}),
    authorName: varchar({ length: 120 }),
    authorEmail: varchar({ length: 200 }),
    category: varchar({ length: 80 }),
    language: varchar({ length: 16 }),
    status: varchar({ length: 32 }),
    wordCount: integer({}),
    viewCount: bigint({}),
    likeCount: bigint({}),
    commentCount: integer({}),
    isPublished: boolean({ notNull }),
    isFeatured: boolean({}),
    isArchived: boolean({}),
    publishedAt: timestamptz({}),
    createdAt: timestamptz({ notNull }),
    updatedAt: timestamptz({ notNull }),
    role: RoleEnum.enumed({ notNull }),
  });
  const ArticleRevisions = table("public", "article_revisions", {
    id: pk(),
    articleId: bigint({ notNull }).references({ column: () => Articles.id }),
    revision: integer({ notNull }),
    editorName: varchar({ length: 120 }),
    editorEmail: varchar({ length: 200 }),
    changeSummary: text({}),
    previousTitle: varchar({ length: 300 }),
    previousSummary: text({}),
    previousBody: text({}),
    wordsAdded: integer({}),
    wordsRemoved: integer({}),
    isApproved: boolean({ notNull }),
    approvedAt: timestamptz({}),
    approvedBy: varchar({ length: 120 }),
    createdAt: timestamptz({ notNull }),
    createdBy: varchar({ length: 120 }),
    clientIp: varchar({ length: 45 }),
    userAgent: text({}),
    role: RoleEnum.enumed({ notNull }),
  });
  const ArticleRatings = table("public", "article_ratings", {
    id: pk(),
    articleId: bigint({ notNull }).references({ column: () => Articles.id }),
    rating: integer({ notNull }),
    raterName: varchar({ length: 120 }),
    raterEmail: varchar({ length: 200 }),
    comment: text({}),
    helpfulCount: integer({}),
    isVerified: boolean({ notNull }),
    source: varchar({ length: 40 }),
    referrer: varchar({ length: 300 }),
    deviceType: varchar({ length: 40 }),
    country: varchar({ length: 80 }),
    createdAt: timestamptz({ notNull }),
    updatedAt: timestamptz({ notNull }),
    deletedAt: timestamptz({}),
    role: RoleEnum.enumed({ notNull }),
  });

  /** Narrow, so the omitted-column `INSERT` has a shape worth timing. */
  const Events = table("public", "events", {
    id: pk(),
    articleId: bigint({}),
    kind: varchar({ length: 60, notNull }),
    source: varchar({ length: 120 }),
    payload: text({}),
    amount: bigint({}),
    isProcessed: boolean({ notNull }),
    occurredAt: timestamptz({ notNull }),
    role: RoleEnum.enumed({ notNull }),
  });

  /** Array and tuple columns, so `ARRAY[...]` rendering is on the path. */
  const Listings = table("public", "listings", {
    id: pk(),
    articleId: bigint({ notNull }).references({ column: () => Articles.id }),
    title: varchar({ length: 200, notNull }),
    tags: varchar({ length: 40, dimension: array() }),
    pairs: varchar({ length: 40, dimension: tuple(2) }),
  });

  /** Carries `$updateFn` columns, so `UPDATE` has a column set to resolve. */
  const Sessions = table("public", "sessions", {
    id: pk(),
    token: varchar({ length: 64, notNull }),
    region: varchar({ length: 40, notNull }),
    hits: integer({ notNull }),
    bytes: bigint({}),
    agent: text({}),
    startedAt: timestamptz({ notNull }),
    lastSeenAt: timestamptz({ notNull }).$updateFn(() => new Date()),
    rotatedAt: timestamptz({ notNull }).$updateFn(() => new Date()),
  });

  const UsersRelations = relations(Users, () => ({
    posts: many(Posts, Posts.userId),
  }));
  const PostsRelations = relations(Posts, () => ({
    comments: many(Comments, Comments.postId),
  }));

  return {
    Articles,
    ArticleRatings,
    ArticleRevisions,
    Comments,
    Events,
    Listings,
    Posts,
    PostsRelations,
    Sessions,
    Users,
    UsersRelations,
  };
}

/** The tables and relations one build's cases are made of. */
type Schema = ReturnType<typeof buildSchema>;

/**
 * `db` stays loosely typed on purpose: it is constructed from two different
 * builds, so there is no single concrete type to name for it.
 */
// biome-ignore lint/suspicious/noExplicitAny: per-build db, no shared type
type Db = any;

function buildDb(idx: Durcno, schema: Schema) {
  return idx.database(
    schema,
    idx.defineConfig({
      schema: "./schema.ts",
      connector: createStubConnector(),
    }),
  );
}

const TAGS = ["typescript", "postgres", "orm", "query-builder"];
const PAIR: [string, string] = ["typescript", "postgres"];
const OCCURRED_AT = new Date(2024, 5, 1);

/** Input rows and templates are built once: the builder is what is timed. */
const partialEvents = Array.from({ length: 50 }, (_, i) => ({
  kind: `event_${i % 17}`,
  isProcessed: i % 2 === 0,
  occurredAt: OCCURRED_AT,
  role: "user" as const,
}));

const cases: Record<string, (db: Db, s: Schema, idx: Durcno) => () => unknown> =
  {
    "anchor/select-star": (db, s) => () =>
      db.from(s.Users).select("*").toQuery(),

    "cached/left-joins": (db, s, idx) => () =>
      db
        .from(s.Articles)
        .leftJoin(s.ArticleRevisions, () =>
          idx.eq(s.ArticleRevisions.articleId, s.Articles.id),
        )
        .leftJoin(s.ArticleRatings, () =>
          idx.eq(s.ArticleRatings.articleId, s.Articles.id),
        )
        .select("*")
        .toQuery(),

    "cached/left-joins-chained": (db, s, idx) => () =>
      db
        .from(s.Articles)
        .leftJoin(s.ArticleRevisions, () =>
          idx.eq(s.ArticleRevisions.articleId, s.Articles.id),
        )
        .leftJoin(s.ArticleRatings, () =>
          idx.eq(s.ArticleRatings.articleId, s.Articles.id),
        )
        .select("*")
        .where(() => idx.gte(s.Articles.wordCount, 100))
        .orderBy(() => idx.asc(s.Articles.title))
        .groupBy(() => [s.Articles.id])
        .having(() => idx.gte(idx.count("*"), 1))
        .limit(50)
        .toQuery(),

    "cached/insert-omitted": (db, s) => () =>
      db
        .insertInto(s.Events)
        .values(partialEvents)
        .returning({ id: true, kind: true, amount: true })
        .toQuery(),

    "cached/update-fn": (db, s, idx) => () =>
      db
        .update(s.Sessions)
        .set({ hits: 5 })
        .where(idx.eq(s.Sessions.id, 1n))
        .toQuery(),

    "cached/json": (db, s, idx) => () =>
      db
        .from(s.Articles)
        .select(() => ({
          id: s.Articles.id,
          meta: idx.jsonBuildObject({
            title: s.Articles.title,
            slug: s.Articles.slug,
            author: s.Articles.authorName,
            language: s.Articles.language,
            category: s.Articles.category,
          }),
          pair: idx.jsonbBuildObject({ word: s.Articles.wordCount }),
          list: idx.jsonBuildArray(
            s.Articles.id,
            s.Articles.title,
            s.Articles.slug,
            s.Articles.status,
          ),
        }))
        .toQuery(),

    "streamed/variadic": (db, s, idx) => () =>
      db
        .from(s.Articles)
        .select(() => ({
          id: s.Articles.id,
          a: idx.coalesce(s.Articles.title, "none"),
          b: idx.concat(s.Articles.title, s.Articles.slug),
          c: idx.coalesce(s.Articles.category, s.Articles.language),
          d: idx.concat(s.Articles.category, s.Articles.status),
          e: idx.greatest(s.Articles.wordCount, s.Articles.commentCount),
          f: idx.least(s.Articles.wordCount, s.Articles.commentCount),
          g: idx.concat(s.Articles.authorName, s.Articles.authorEmail),
          h: idx.coalesce(s.Articles.summary, "none"),
        }))
        .toQuery(),

    "streamed/array-filters": (db, s, idx) => () =>
      db
        .from(s.Listings)
        .select("*")
        .where(() =>
          idx.and(
            idx.arrayContains(s.Listings.tags, TAGS),
            idx.arrayContainedBy(s.Listings.tags, TAGS),
            idx.arrayOverlaps(s.Listings.tags, TAGS),
            idx.arrayContains(s.Listings.pairs, PAIR),
          ),
        )
        .toQuery(),

    "streamed/relational": (db, s) => () =>
      db
        .query(s.Users)
        .findMany({
          with: {
            posts: {
              columns: { title: true, views: true },
              with: { comments: { columns: { body: true } } },
            },
          },
        })
        .toQuery(),

    "streamed/insert-conflict": (db, s, idx) => () => {
      // `db` is per-build and untyped, so the `EXCLUDED` payload is named here.
      type Excluded = { excluded: Record<string, unknown> };
      return db
        .insertInto(s.Posts)
        .values({ title: "post", body: "body of post", views: 10, userId: 1n })
        .onConflict(s.Posts.views, s.Posts.title)
        .doUpdateSet(
          ({ excluded }: Excluded) => ({
            views: excluded.views,
            body: "updated",
          }),
          ({ excluded }: Excluded) => idx.gt(excluded.views as never, 0),
        )
        .returning("*")
        .toQuery();
    },

    "streamed/delete-returning": (db, s, idx) => () =>
      db
        .deleteFrom(s.Comments)
        .where(idx.eq(s.Comments.postId, 1n))
        .returning({ body: false })
        .toQuery(),

    "streamed/with-ctes": (db, s, idx) => () => {
      const active = db.with("active").as(
        db
          .from(s.Users)
          .select("*")
          .where(() => idx.gte(s.Users.points, 10n)),
      );
      const named = db
        .with("named")
        .as(db.from(s.Users).select(() => ({ name: s.Users.userName })));
      const rich = db.with("rich").as(
        db
          .from(s.Users)
          .select("*")
          .where(() => idx.gte(s.Users.points, 100n)),
      );
      db.with(active, named, rich)
        .from(s.Users)
        .select("*")
        .where(() => idx.eq(s.Users.bio, "updated"))
        .toQuery();
    },

    "loops/projection": (db, s, idx) => () =>
      db
        .from(s.Users)
        .select(() => ({
          userName: s.Users.userName,
          email: s.Users.email,
          bio: s.Users.bio,
          age: s.Users.age,
          points: s.Users.points,
          balance: s.Users.balance,
          isActive: s.Users.isActive,
          isVerified: s.Users.isVerified,
          birthDate: s.Users.birthDate,
          createdAt: s.Users.createdAt,
          role: s.Users.role,
          total: idx.count("*"),
        }))
        .orderBy((_view: unknown, { userName }: { userName: string }) => [
          idx.asc(userName),
        ])
        .toQuery(),

    "loops/aggregate-order": (db, s, idx) => () =>
      db
        .from(s.Posts)
        .select(() => ({
          id: s.Posts.id,
          titles: idx
            .jsonAgg(s.Posts.title)
            .orderBy(idx.asc(s.Posts.publishedAt), idx.desc(s.Posts.views)),
        }))
        .toQuery(),

    "loops/sql-template": (_db, s, idx) => {
      const wide = idx.sql`coalesce(${s.Articles.title}, ${
        s.Articles.slug
      }) = ${"a-b-c"} AND ${s.Articles.wordCount} > ${100} AND ${idx.sql`lower(${
        s.Articles.authorEmail
      })`} IS NOT NULL AND ${idx.lower(s.Articles.authorName)} <> ${
        s.Articles.language
      } AND ${true} AND ${2024} AND ${1_000n}`;
      // Reset in place, so the timed region is the render and nothing else.
      const target = new idx.Query("", () => []);
      return () => {
        wide.toSQL();
        target.sql = "";
        wide.toQuery(target);
      };
    },

    "clauses/is-in": (db, s, idx) => () =>
      db
        .from(s.Users)
        .select("*")
        .where(() =>
          idx.isIn(s.Users.userName, [
            "mahdi",
            "sara",
            "reza",
            "nima",
            "ali",
            "sina",
          ]),
        )
        .toQuery(),

    "clauses/distinct-on": (db, s) => () =>
      db
        .from(s.Articles)
        .distinctOn(() => [
          s.Articles.category,
          s.Articles.language,
          s.Articles.status,
        ])
        .select("*")
        .toQuery(),
  };

const WARMUP = Number(process.env.WARMUP ?? 30);
const SAMPLES = Number(process.env.SAMPLES ?? 60);

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, (sorted.length * q) | 0)];
  return { min: sorted[0], p10: at(0.1), median: at(0.5) };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

async function main(): Promise<void> {
  const [oldIdx, newIdx] = await Promise.all([load(oldDir), load(newDir)]);
  const oldSchema = buildSchema(oldIdx);
  const newSchema = buildSchema(newIdx);
  const oldDb = buildDb(oldIdx, oldSchema);
  const newDb = buildDb(newIdx, newSchema);

  const selected = Object.keys(cases).filter(
    (name) =>
      filters.length === 0 ||
      filters.some((f) => name === f || name.startsWith(`${f}/`)),
  );
  if (selected.length === 0) {
    console.error(`no case matches ${filters.join(", ")}`);
    process.exit(1);
  }

  let group = "";
  for (const name of selected) {
    const [caseGroup] = name.split("/");
    if (caseGroup !== group) {
      group = caseGroup;
      console.log(`\n${group}`);
    }
    const oldFn = cases[name](oldDb, oldSchema, oldIdx);
    const newFn = cases[name](newDb, newSchema, newIdx);

    for (let i = 0; i < WARMUP; i++) {
      oldFn();
      newFn();
    }

    const oldSamples: number[] = [];
    const newSamples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      // Alternate inside the sample loop: drift hits both sides equally. The
      // order within a round flips too — always running the second side last
      // gives it a warm cache and biases a case under a couple of microseconds
      // by 5–10% in its favour, which is the whole magnitude some of these are
      // chasing.
      const oldFirst = i % 2 === 0;
      for (let round = 0; round < 2; round++) {
        const timed = oldFirst === (round === 0) ? oldFn : newFn;
        const t = process.hrtime.bigint();
        timed();
        const ms = Number(process.hrtime.bigint() - t) / 1e6;
        (oldFirst === (round === 0) ? oldSamples : newSamples).push(ms);
      }
    }

    const a = stats(oldSamples);
    const b = stats(newSamples);
    const pct = (x: number, y: number) =>
      `${(((y - x) / x) * 100).toFixed(1)}%`;
    const side = (x: number, y: number, z: number) =>
      `min=${x.toFixed(4)} p10=${y.toFixed(4)} med=${z.toFixed(4)}`;
    console.log(
      `${name.padEnd(26)} old ${side(a.min, a.p10, a.median)} | ` +
        `new ${side(b.min, b.p10, b.median)} | ` +
        `min ${pct(a.min, b.min).padStart(7)} p10 ${pct(a.p10, b.p10).padStart(7)} ` +
        `med ${pct(a.median, b.median).padStart(7)}`,
    );
  }
}
