import { asc, database, defineConfig, eq } from "durcno";
import { bench, describe } from "vitest";
import * as schema from "./schema";
import { createStubConnector } from "./stub-connector";

/**
 * Benchmarks for the cost of *constructing* queries — the builder chain plus
 * `toQuery()` — without executing them. This isolates the hot paths that
 * `camelToSnake` memoization, `escIdentifier` / `escLiteral` guards, and cached
 * column `fullName` / cast strings affect. Row conversion is measured
 * separately by `handle-rows.bench.ts`; per-query promise overhead by
 * `query-overhead.bench.ts`.
 *
 * No database is involved: `toQuery()` never issues a query, and the stub
 * connector rejects if one is ever attempted. A fresh builder is created inside
 * every benchmark body because that is what real usage does, so per-query
 * precomputation is charged to the benchmark exactly as it is in production.
 */
const db = database(
  schema,
  defineConfig({
    schema: "./schema.ts",
    connector: createStubConnector(),
  }),
);

describe("query build", () => {
  bench('select("*")', () => {
    db.from(schema.Users).select("*").toQuery();
  });

  bench("select(12 explicit cols)", () => {
    db.from(schema.Users)
      .select(() => ({
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
        createdAt: schema.Users.createdAt,
        role: schema.Users.role,
      }))
      .toQuery();
  });

  bench('select("*") + where + orderBy + limit', () => {
    db.from(schema.Users)
      .select("*")
      .where(() => eq(schema.Users.age, 30))
      .orderBy(() => asc(schema.Users.userName))
      .limit(100)
      .toQuery();
  });

  bench("select + 2 left joins", () => {
    db.from(schema.Users)
      .leftJoin(schema.Posts, () => eq(schema.Posts.userId, schema.Users.id))
      .leftJoin(schema.Comments, () =>
        eq(schema.Comments.postId, schema.Posts.id),
      )
      .select("*")
      .toQuery();
  });

  bench("insert 50 rows", () => {
    const values = Array.from({ length: 50 }, (_, i) => ({
      title: `post ${i}`,
      body: `body of post ${i}`,
      views: i * 10,
      userId: BigInt(i),
    }));
    db.insertInto(schema.Posts).values(values).toQuery();
  });

  bench("update + where", () => {
    db.update(schema.Users)
      .set({ age: 31, bio: "updated" })
      .where(eq(schema.Users.id, 1n))
      .toQuery();
  });

  bench("delete + where", () => {
    db.deleteFrom(schema.Comments)
      .where(eq(schema.Comments.postId, 1n))
      .toQuery();
  });
});
