/**
 * Benchmarks the fixed per-query overhead of the execute path: the promise
 * plumbing in `QueryPromise.then` and the `execQuery` / `execStrArgs`
 * pass-throughs in the connector base class. No database is involved — the stub
 * pool resolves immediately — so the numbers isolate promise overhead from SQL
 * generation, row conversion and network time.
 *
 * The stub returns a single row on purpose: the overhead is a handful of promise
 * allocations per query, and any meaningful row count would bury it under
 * `handleRows`, which `handle-rows.bench.ts` measures instead.
 *
 * `pnpm bench`. Reading the numbers: AGENTS.md (Performance).
 */
import { asc, database, defineConfig, eq } from "durcno";
import { bench, describe } from "vitest";
import * as schema from "./schema";
import { createStubConnector } from "./stub-connector";

const ROWS = 1;

const stubRows = Array.from({ length: ROWS }, (_, i) => ({
  id: String(i),
  user_name: `user_${i}`,
  email: `user_${i}@example.com`,
}));

const db = database(
  schema,
  defineConfig({
    schema: "./schema.ts",
    connector: createStubConnector(stubRows),
  }),
);

describe("query overhead", () => {
  bench(`await select("*") — ${ROWS} row`, async () => {
    await db.from(schema.Users).select("*");
  });

  bench(
    `await select("*") + where + orderBy + limit — ${ROWS} row`,
    async () => {
      await db
        .from(schema.Users)
        .select("*")
        .where(() => eq(schema.Users.age, 30))
        .orderBy(() => asc(schema.Users.userName))
        .limit(100);
    },
  );

  bench(`await select(10 cols) — ${ROWS} row`, async () => {
    await db.from(schema.Users).select(() => ({
      id: schema.Users.id,
      userName: schema.Users.userName,
      email: schema.Users.email,
      bio: schema.Users.bio,
      age: schema.Users.age,
      points: schema.Users.points,
      balance: schema.Users.balance,
      isActive: schema.Users.isActive,
      isVerified: schema.Users.isVerified,
      birthDate: schema.Users.birthDate,
    }));
  });
});
