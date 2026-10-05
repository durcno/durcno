import { database, defineConfig, lower, sql } from "durcno";
import { pg } from "durcno/connectors/pg";
import { bench, describe } from "vitest";
import * as schema from "./schema";

/**
 * Benchmarks for the row-conversion hot path (`handleRows`) of `select` and
 * relational queries. No database is involved: synthetic driver rows are fed
 * straight into `handleRows`, so the numbers isolate JS conversion cost from
 * SQL generation and network time. Run with `pnpm bench` from the repo root.
 *
 * A fresh query builder is created inside every benchmark body because that is
 * what real usage does — a query is built, executed once, and its rows
 * converted once. Any per-query precomputation is therefore charged to the
 * benchmark, exactly as it is in production.
 *
 * Two of the three conversion paths mutate the rows they are given (the
 * explicit projection and relational paths always have; `SELECT *` does when
 * no key has to be renamed), so their fixtures are driver-shaped only on the
 * first pass. The `select("*") in place` case therefore builds its rows per
 * iteration; the others share one fixture across all benches, so they measure
 * converting already-converted values and are only meaningful when compared
 * against another run made the same way.
 *
 * `handle-rows.paths.ts` and `handle-rows.ab.ts` are sibling harnesses for
 * questions a vitest bench cannot settle: comparing the two conversion paths,
 * and comparing two builds. Neither is picked up by `vitest bench`.
 */
const db = database(
  schema,
  defineConfig({
    schema: "./schema.ts",
    // Never connected to: the pool is lazy and no query is ever issued.
    connector: pg({
      dbCredentials: { url: "postgres://bench:bench@127.0.0.1:5432/bench" },
    }),
  }),
);

const ROWS = 10_000;
const PARENTS = 2_000;
const CHILDREN = 5;

/** Driver-shaped `users` row — snake_case keys, driver-native value types. */
function driverUser(i: number): Record<string, unknown> {
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

const selectStarRows = Array.from({ length: ROWS }, (_, i) => driverUser(i));

/** Driver-shaped aliased `users` row for an explicit `.select({...})`. */
function aliasedUser(i: number): Record<string, unknown> {
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

const selectAliasedRows = Array.from({ length: ROWS }, (_, i) =>
  aliasedUser(i),
);

/**
 * Driver-shaped relational row: camelCase keys (relations alias columns with
 * their JS names) plus `posts`, each with nested `comments`.
 */
function relationalUser(i: number): Record<string, unknown> {
  return {
    id: String(i),
    userName: `user_${i}`,
    email: `user_${i}@example.com`,
    bio: `biography of user ${i}`,
    age: 20 + (i % 40),
    points: String(i * 1_000),
    balance: String(i * 50),
    isActive: i % 2 === 0,
    isVerified: i % 3 === 0,
    birthDate: new Date(1990, 0, 1 + (i % 28)),
    createdAt: new Date(2024, 5, 1),
    role: i % 2 === 0 ? "admin" : "user",
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

const relationalRows = Array.from({ length: PARENTS }, (_, i) =>
  relationalUser(i),
);

/** Driver-shaped `tokens` row — every key is already its output key. */
function driverToken(i: number): Record<string, unknown> {
  return {
    id: String(i),
    name: `token_${i}`,
    kind: i % 2 === 0 ? "a" : "b",
    bio: `biography of token ${i}`,
    enabled: i % 3 === 0,
  };
}

/**
 * The in-place conversion path writes back into the rows it is handed, so one
 * fixture cannot be reused: every iteration has to be given fresh driver rows
 * or it would time `BigInt(1n)` where it should time `BigInt("1")`, quietly
 * measuring the cost of converting already-converted values.
 *
 * Building the fixture inside the body keeps that cost uniform. Pooling the
 * fixtures instead was tried and rejected: a pool is only reusable if all of it
 * is rebuilt every lap, and rebuilding it in one go turns into a p95/max
 * outlier that swamps the numbers. So this case's absolute value includes
 * fixture construction — compare it against other runs of itself, not against
 * the other cases. `handle-rows.paths.ts` is the harness to use for a real
 * comparison; it builds fixtures outside the timed region.
 */
function buildInPlaceRows(): Record<string, unknown>[] {
  return Array.from({ length: ROWS }, (_, i) => driverToken(i));
}

describe("handleRows", () => {
  bench(`select("*") — ${ROWS} rows x 12 cols`, () => {
    db.from(schema.Users).select("*").handleRows(selectStarRows);
  });

  bench(`select({...}) mixed — ${ROWS} rows x 8 cols`, () => {
    db.from(schema.Users)
      .select(() => ({
        id: schema.Users.id,
        userName: schema.Users.userName,
        emailName: lower(schema.Users.email),
        doubledAge: sql`${schema.Users.age} * 2`,
        points: schema.Users.points,
        isActive: schema.Users.isActive,
        literal: 7,
        constant: sql`1`,
      }))
      .handleRows(selectAliasedRows);
  });

  bench(
    `relational nested — ${PARENTS} parents x ${CHILDREN} posts x 2 comments`,
    () => {
      db.query(schema.Users)
        .findMany({ with: { posts: { with: { comments: {} } } } })
        .handleRows(relationalRows);
    },
  );

  bench(`select("*") in place — ${ROWS} rows x 5 cols`, () => {
    db.from(schema.Tokens).select("*").handleRows(buildInPlaceRows());
  });
});
