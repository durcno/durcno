import {
  add,
  asc,
  caseWhen,
  coalesce,
  count,
  eq,
  gt,
  jsonBuildArray,
  jsonBuildObject,
  lower,
  sql,
} from "durcno";
import { CheckTest, db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// ============================================================================
// Direct scalar queries in .select()
// ============================================================================

const singleColumnQuery = db.from(Posts).select(() => ({ total: count("*") }));

const directSelect = db.from(Users).select(() => ({
  id: Users.id,
  total: singleColumnQuery,
}));
type DirectSelectResult = Awaited<typeof directSelect>;
Expect<Equal<DirectSelectResult, { id: bigint; total: number | null }[]>>();

const nullableTextQuery = db.from(Posts).select(() => ({ title: Posts.title }));

const directNullableSelect = db.from(Users).select(() => ({
  title: nullableTextQuery,
}));
type DirectNullableSelectResult = Awaited<typeof directNullableSelect>;
Expect<Equal<DirectNullableSelectResult, { title: string | null }[]>>();

// Correlated scalar query.
const correlatedSelect = db.from(Users).select(() => ({
  id: Users.id,
  title: db
    .from(Posts)
    .select(() => ({ title: Posts.title }))
    .where(() => eq(Posts.userId, Users.id))
    .limit(1),
}));
type CorrelatedSelectResult = Awaited<typeof correlatedSelect>;
Expect<Equal<CorrelatedSelectResult, { id: bigint; title: string | null }[]>>();

// Multi-column query is rejected at compile time.
const multiColumnQuery = db
  .from(Posts)
  .select(() => ({ id: Posts.id, title: Posts.title }));

// @ts-expect-error - a scalar subquery must select exactly one column
db.from(Users).select(() => ({
  bad: multiColumnQuery,
}));

// A SELECT * over a multi-column table is rejected.
// @ts-expect-error - SELECT * resolves to many columns
db.from(Users).select(() => ({
  bad: db.from(Users).select("*"),
}));

// ============================================================================
// Direct scalar queries in .set()
// ============================================================================

// Nullable target accepts the nullable scalar value.
db.update(Users).set({ email: nullableTextQuery });

// Non-null target rejects it; coalesce removes the null.
// @ts-expect-error - non-null column requires a non-null value
db.update(Users).set({ username: nullableTextQuery });

db.update(Users).set({
  username: coalesce(nullableTextQuery, ""),
});

// ============================================================================
// Scalar expression composition
// ============================================================================

const numericQuery = db.from(Posts).select(() => ({ id: Posts.id }));

const added = db.from(Users).select(() => ({
  score: add(numericQuery, 1),
}));
type AddedResult = Awaited<typeof added>;
Expect<Equal<AddedResult, { score: number | null }[]>>();

const lowered = db.from(Users).select(() => ({
  title: lower(nullableTextQuery),
}));
type LoweredResult = Awaited<typeof lowered>;
Expect<Equal<LoweredResult, { title: string | null }[]>>();

// Typed operand gates reject queries of the wrong PostgreSQL type.
db.from(Users).select(() => ({
  // @ts-expect-error - text query is not numeric
  score: add(nullableTextQuery, 1),
}));

db.from(Users).select(() => ({
  // @ts-expect-error - numeric query is not text
  title: lower(numericQuery),
}));

const cased = db.from(Users).select(() => ({
  label: caseWhen(eq(Users.type, "admin"), nullableTextQuery).else("user"),
}));
type CasedResult = Awaited<typeof cased>;
Expect<Equal<CasedResult, { label: string | null }[]>>();

// ============================================================================
// Prepared subqueries
// ============================================================================

const preparedSubquery = db
  .prepare()
  .from(Posts)
  .select(() => ({ title: Posts.title }));

// @ts-expect-error - prepared subquery requires a prepared outer query
db.from(Users).select(() => ({
  title: preparedSubquery,
}));

const preparedOuter = db
  .prepare()
  .from(Users)
  .select(() => ({
    title: preparedSubquery,
  }));
type PreparedOuterResult = Awaited<typeof preparedOuter>;
Expect<Equal<PreparedOuterResult, { title: string | null }[]>>();

// ============================================================================
// Raw SQL scalar expressions
// ============================================================================

const rawDirect = db.from(Users).select(() => ({
  value: sql<number>`(SELECT 42)`,
}));
type RawDirectResult = Awaited<typeof rawDirect>;
Expect<Equal<RawDirectResult, { value: number }[]>>();

// ============================================================================
// Other scalar expression contexts
// ============================================================================

// Comparisons accept queries on either side.
db.from(Posts)
  .select("*")
  .where(() => eq(Posts.id, numericQuery));
db.from(Posts)
  .select("*")
  .where(() => gt(numericQuery, 1n));

// JSON builders normalize query values.
db.from(Posts).select(() => ({
  object: jsonBuildObject({ score: numericQuery }),
  array: jsonBuildArray(numericQuery, 1),
}));

// ORDER BY accepts a scalar query directly.
db.from(Posts)
  .select("*")
  .orderBy(() => asc(numericQuery));

// INSERT values accept queries; non-null targets need coalesce.
db.insertInto(CheckTest).values({
  price: coalesce(numericQuery, 0n),
  quantity: 1,
  name: "scalar-insert",
});

db.insertInto(CheckTest).values({
  // @ts-expect-error - non-null price rejects the nullable scalar query
  price: numericQuery,
  quantity: 1,
  name: "scalar-insert",
});

// Prepared subqueries are rejected by unprepared UPDATE and INSERT values.
db.update(Users).set({
  // @ts-expect-error - prepared subquery requires a prepared update
  email: preparedSubquery,
});

db.insertInto(CheckTest).values({
  // @ts-expect-error - prepared subquery requires a prepared insert
  price: coalesce(preparedSubquery, 0n),
  quantity: 1,
  name: "scalar-insert-prepared",
});

// Direct insert query on a nullable column.
db.insertInto(CheckTest).values({
  price: 1n,
  quantity: 1,
  name: "scalar-insert-nullable",
  email: db
    .from(Users)
    .select(() => ({ email: Users.email }))
    .limit(1),
});
