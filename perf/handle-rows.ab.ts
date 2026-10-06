/**
 * Same-process A/B of the row-conversion path, across two builds. Alternating
 * the two builds inside one sample loop leaves only the code itself as a
 * difference, which is the whole reason this exists: swapping `dist` between
 * separate runs reported a real 20% regression as noise.
 *
 * Usage (from the repo root):
 *
 *   pnpm build && cp -r dist .ab-old
 *   # ...change the code...
 *   pnpm build && node perf/handle-rows.ab.ts .ab-old dist
 *
 * Both directories must sit **inside the repo** — outside it, Node cannot walk
 * up to this repo's `node_modules` and resolving `zod` fails. They are not
 * gitignored, so delete them when you are done.
 *
 * For the two conversion *paths* rather than two builds, use
 * `handle-rows.paths.ts`. Reading the numbers: AGENTS.md (Performance).
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** The shape both builds are imported as. */
type Durcno = typeof import("durcno");
type PgConnector = typeof import("durcno/connectors/pg");
/** A driver-shaped row: snake_case keys, driver-native value types. */
type Row = Record<string, unknown>;

const [oldDir, newDir] = process.argv.slice(2);
if (!oldDir || !newDir) {
  console.error("usage: handle-rows.ab.ts <oldDistDir> <newDistDir>");
  process.exit(1);
}

// Absolute file URLs, so the snapshots resolve as modules and their own
// `node_modules` lookup walks up into this repo's.
const url = (dir: string, file: string) =>
  pathToFileURL(resolve(dir, file)).href;

async function load(dir: string) {
  const [idx, pgMod] = (await Promise.all([
    import(url(dir, "src/index.mjs")),
    import(url(dir, "src/connectors/pg.mjs")),
  ])) as [Durcno, PgConnector];
  return { idx, pgMod };
}

/** Builds an identical `users`/`posts`/`comments` schema for one build. */
function buildSchema(idx: Durcno) {
  const {
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
    varchar,
  } = idx;

  const RoleEnum = enumtype("public", "role", ["admin", "user"]);
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
    body: text({}),
    views: integer({ notNull }),
    publishedAt: timestamptz({}),
    userId: bigint({ notNull }).references({ column: () => Users.id }),
  });
  const Comments = table("public", "comments", {
    id: pk(),
    body: text({ notNull }),
    postId: bigint({ notNull }),
  });
  const UsersRelations = relations(Users, () => ({
    posts: many(Posts, Posts.userId),
  }));
  const PostsRelations = relations(Posts, () => ({
    comments: many(Comments, Comments.postId),
  }));

  return { Users, Posts, Comments, UsersRelations, PostsRelations };
}

/** The tables and relations one build's benchmark schema is made of. */
type Schema = ReturnType<typeof buildSchema>;

function buildDb(idx: Durcno, pgMod: PgConnector, schema: Schema) {
  return idx.database(
    schema,
    idx.defineConfig({
      schema: "./schema.ts",
      connector: pgMod.pg({
        dbCredentials: { url: "postgres://bench:bench@127.0.0.1:5432/bench" },
      }),
    }),
  );
}

const ROWS = Number(process.env.ROWS ?? 10_000);
const PARENTS = 2_000;
const CHILDREN = 5;

function driverUser(i: number): Row {
  return {
    id: String(i),
    user_name: `user_${i}`,
    email: `user_${i}@example.com`,
    bio: `biography of user ${i}`,
    age: 20 + (i % 40),
    points: String(i * 1_000),
    balance: String(i * 50),
    is_active: i % 2 === 0,
    is_verified: i % 3 === 0,
    birth_date: new Date(1990, 0, 1 + (i % 28)),
    created_at: new Date(2024, 5, 1),
    role: i % 2 === 0 ? "admin" : "user",
  };
}

function relationalUser(i: number): Row {
  const base = driverUser(i);
  const {
    user_name: _u,
    email: _e,
    bio: _b,
    is_active: _a,
    is_verified: _v,
    birth_date: _bd,
    created_at: _ca,
    ...rest
  } = base;
  return {
    ...rest,
    userName: base.user_name,
    email: base.email,
    bio: base.bio,
    isActive: base.is_active,
    isVerified: base.is_verified,
    birthDate: base.birth_date,
    createdAt: base.created_at,
    posts: Array.from({ length: CHILDREN }, (_, p) => ({
      id: String(i * 1_000 + p),
      title: `post ${p} of user ${i}`,
      body: `body of post ${p}`,
      views: p * 10,
      publishedAt: new Date(2024, 5, p + 1),
      userId: String(i),
      comments: Array.from({ length: 2 }, (_, c) => ({
        id: String(i * 10_000 + p * 10 + c),
        body: `comment ${c} on post ${p}`,
        postId: String(i * 1_000 + p),
      })),
    })),
  };
}

const starRows = Array.from({ length: ROWS }, (_, i) => driverUser(i));
const relationalRows = Array.from({ length: PARENTS }, (_, i) =>
  relationalUser(i),
);

/** Driver-shaped aliased row for an explicit `.select({...})`. */
function aliasedUser(i: number): Row {
  return {
    id: String(i),
    user_name: `user_${i}`,
    email_name: `user_${i}@example.com`,
    doubled_age: 2 * (20 + (i % 40)),
    points: String(i * 1_000),
    is_active: i % 2 === 0,
    literal: 7,
    constant: 1,
  };
}

const aliasedRows = Array.from({ length: ROWS }, (_, i) => aliasedUser(i));

/**
 * One benchmark per conversion path. Each factory receives the build's own
 * `db`, schema and module namespace, and returns the timed closure. `db` stays
 * loosely typed on purpose: it is constructed from two different builds, so
 * there is no single concrete type to name.
 */
// biome-ignore lint/suspicious/noExplicitAny: per-build db, no shared type
type Db = any;

const cases: Record<
  string,
  (db: Db, schema: Schema, idx: Durcno) => () => unknown
> = {
  star: (db, s) => () => db.from(s.Users).select("*").handleRows(starRows),
  relational: (db, s) => () =>
    db
      .query(s.Users)
      .findMany({ with: { posts: { with: { comments: {} } } } })
      .handleRows(relationalRows),
  mixed: (db, s, idx) => () =>
    db
      .from(s.Users)
      .select(() => ({
        id: s.Users.id,
        userName: s.Users.userName,
        emailName: idx.lower(s.Users.email),
        doubledAge: idx.sql`${s.Users.age} * 2`,
        points: s.Users.points,
        isActive: s.Users.isActive,
        literal: 7,
        constant: idx.sql`1`,
      }))
      .handleRows(aliasedRows),
};

const WARMUP = 30;
const SAMPLES = 60;

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
  const [oldBuild, newBuild] = await Promise.all([load(oldDir), load(newDir)]);
  const oldSchema = buildSchema(oldBuild.idx);
  const newSchema = buildSchema(newBuild.idx);
  const oldDb = buildDb(oldBuild.idx, oldBuild.pgMod, oldSchema);
  const newDb = buildDb(newBuild.idx, newBuild.pgMod, newSchema);

  for (const name of Object.keys(cases)) {
    const oldFn = cases[name](oldDb, oldSchema, oldBuild.idx);
    const newFn = cases[name](newDb, newSchema, newBuild.idx);

    for (let i = 0; i < WARMUP; i++) {
      oldFn();
      newFn();
    }

    const oldSamples: number[] = [];
    const newSamples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      // Alternate inside the sample loop: drift hits both sides equally.
      let t = process.hrtime.bigint();
      oldFn();
      oldSamples.push(Number(process.hrtime.bigint() - t) / 1e6);
      t = process.hrtime.bigint();
      newFn();
      newSamples.push(Number(process.hrtime.bigint() - t) / 1e6);
    }

    const a = stats(oldSamples);
    const b = stats(newSamples);
    const pct = (x: number, y: number) => (((y - x) / x) * 100).toFixed(1);
    const side = (x: number, y: number, z: number) =>
      `min=${x.toFixed(3)} p10=${y.toFixed(3)} med=${z.toFixed(3)}`;
    console.log(
      `${name.padEnd(11)} old ${side(a.min, a.p10, a.median)} | ` +
        `new ${side(b.min, b.p10, b.median)} | ` +
        `min ${pct(a.min, b.min)}% p10 ${pct(a.p10, b.p10)}% ` +
        `med ${pct(a.median, b.median)}%`,
    );
  }
}
