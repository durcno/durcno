import {
  and,
  asc,
  avg,
  caseWhen,
  coalesce,
  count,
  countDistinct,
  desc,
  eq,
  gt,
  gte,
  lower,
  max,
  min,
  numNonNulls,
  round,
  sum,
} from "durcno";
import { ArrayTest, db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// ============================================================================
// Aggregate operand acceptance
// ============================================================================

// Positive tests for avg and sum
avg(Posts.id);
avg(Posts.userId);
sum(Posts.id);
sum(Posts.userId);

// Negative tests for avg and sum with string columns
// @ts-expect-error
avg(Users.username);
// @ts-expect-error
sum(Users.username);

// Negative tests for avg and sum with enum columns
// @ts-expect-error
sum(Users.type);

// Negative tests for avg and sum with numeric array columns
// @ts-expect-error
avg(ArrayTest.coordinates);
// @ts-expect-error
sum(ArrayTest.coordinates);

// min and max should accept any column
min(Users.username);
max(Users.username);
min(Posts.createdAt);
max(Posts.createdAt);
min(Posts.id);
max(Posts.id);

// count should accept any column
count(Users.username);
count("*");
countDistinct(Users.username);

// ============================================================================
// Mixed aggregate + non-aggregate in select (auto GROUP BY)
// ============================================================================

// Type test: aggregate + plain column infers correct shape
const mixedColAggQuery = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }));
type MixedColAgg = Awaited<typeof mixedColAggQuery>;
Expect<Equal<MixedColAgg, { type: "admin" | "user"; total: number }[]>>();

// Type test: aggregate + scalar fn infers correct shape
const mixedFnAggQuery = db.from(Users).select(() => ({
  lowerEmail: lower(Users.email),
  total: count("*"),
}));
type MixedFnAgg = Awaited<typeof mixedFnAggQuery>;
Expect<Equal<MixedFnAgg, { lowerEmail: string | null; total: number }[]>>();

// Type test: multiple aggregates + multiple plain columns
const multiMixedQuery = db.from(Users).select(() => ({
  type: Users.type,
  username: Users.username,
  total: count("*"),
  totalIds: sum(Users.id),
}));
type MultiMixed = Awaited<typeof multiMixedQuery>;
Expect<
  Equal<
    MultiMixed,
    {
      type: "admin" | "user";
      username: string;
      total: number;
      totalIds: bigint | null;
    }[]
  >
>();

// Type test: pure aggregates only — no GROUP BY needed, shape is correct
const pureAggQuery = db.from(Users).select(() => ({
  total: count("*"),
  distinctUsers: count(Users.id),
}));
type PureAgg = Awaited<typeof pureAggQuery>;
Expect<Equal<PureAgg, { total: number; distinctUsers: number }[]>>();

// Type test: pure columns + scalars only — no GROUP BY, shape is correct
const pureScalarQuery = db.from(Users).select(() => ({
  username: Users.username,
  lowerEmail: lower(Users.email),
}));
type PureScalar = Awaited<typeof pureScalarQuery>;
Expect<Equal<PureScalar, { username: string; lowerEmail: string | null }[]>>();

// ============================================================================
// GROUP BY type tests
// ============================================================================

// --- Positive tests: callback form ---

// single column
const _gbSingleCol = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type);

// array of columns
const _gbArrayCols = db
  .from(Users)
  .select(() => ({
    type: Users.type,
    username: Users.username,
    total: count("*"),
  }))
  .groupBy(() => [Users.type, Users.username]);

// scalar SqlFn expression
const _gbScalarFn = db
  .from(Users)
  .select(() => ({
    lname: lower(Users.username),
    total: count("*"),
  }))
  .groupBy(() => lower(Users.username));

// having — aggregate vs literal
const _havingLiteral = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type)
  .having(() => gte(count("*"), 5));

// having — aggregate vs aggregate
const _havingAgg = db
  .from(Users)
  .select(() => ({
    type: Users.type,
    total: count("*"),
    sumId: sum(Users.id),
  }))
  .groupBy(() => Users.type)
  .having(() => gt(sum(Users.id), count("*")));

// chained groupBy + having
const _gbAndHaving = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type)
  .having(() => gte(count("*"), 2));

// having — an aggregate wrapped in a scalar function is still an aggregate, and
// PostgreSQL accepts it here: `HAVING round(avg(id), 1) > 5` is valid SQL.
const _havingWrapped = db
  .from(Users)
  .select(() => ({ type: Users.type, averageId: round(avg(Users.id), 1) }))
  .groupBy(() => Users.type)
  .having(() => gt(round(avg(Users.id), 1), 5));

// having — nesting depth does not matter, and and()/or() re-emit it
const _havingNested = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type)
  .having(() =>
    and(gt(sum(Users.id), 10), gt(coalesce(round(avg(Users.id), 1), 0), 5)),
  );

// callback with select aliases
const _gbCallbackSingle = db
  .from(Users)
  .select(() => ({ lname: lower(Users.username) }))
  .groupBy((_view, { lname }) => [lname]);

// multiple aliases
const _gbCallbackMulti = db
  .from(Users)
  .select(() => ({
    lname: lower(Users.username),
    type: Users.type,
    total: count("*"),
  }))
  .groupBy((_view, { lname, type }) => [lname, type]);

// mixed alias + direct column
const _gbCallbackMixed = db
  .from(Users)
  .select(() => ({
    lname: lower(Users.username),
    total: count("*"),
  }))
  .groupBy((_view, { lname }) => [lname, Users.type]);

// --- Negative tests ---

// .groupBy() called twice should error (removed from type)
const _gbOnce = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type);
// @ts-expect-error - groupBy is removed after first call
_gbOnce.groupBy(() => Users.type);

// .having() called twice should error (removed from type)
const _havingOnce = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type)
  .having(() => gte(count("*"), 1));
// @ts-expect-error - having is removed after first call
_havingOnce.having(() => gte(count("*"), 1));

// aggregate SqlFn as direct groupBy expression — @ts-expect-error (only scalar allowed)
db.from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  // @ts-expect-error - aggregate function not allowed in groupBy (only scalar)
  .groupBy(() => count("*"));

// where — PostgreSQL rejects an aggregate, wrapped or not, and `_.hasAggregate`
// is what carries that: `having()` reads it as `boolean`, `where()` as `false`.
db.from(Users)
  .select("*")
  // @ts-expect-error - a wrapped aggregate is still an aggregate
  .where(() => gt(round(avg(Users.id), 1), 5));

db.from(Users)
  .select("*")
  // @ts-expect-error - a bare aggregate is rejected too
  .where(() => gte(count("*"), 2));

db.from(Users)
  .select("*")
  // @ts-expect-error - and() re-emits the aggregate its conditions carry
  .where(() => and(gt(Users.id, 1n), gte(count("*"), 2)));

// orderBy — PostgreSQL reads ORDER BY after grouping, so an aggregate is
// accepted here whenever the query aggregates. A wrapped aggregate and a bare
// one both order the grouped rows.
const _orderWrappedAgg = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type)
  .orderBy(() => asc(round(avg(Users.id), 1)));

const _orderBareAgg = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type)
  .orderBy(() => desc(sum(Users.id)));

// An aggregate can order a query that groups by nothing but its projection.
const _orderAggOnlySelect = db
  .from(Users)
  .select(() => ({ total: count("*") }))
  .orderBy(() => asc(count("*")));

// `$.HasArg` still tracks the expression that carries it.
const _orderPrepared = db
  .from(Users)
  .select("*")
  .orderBy(() => asc(lower(Users.username)));

// callback form when no named select (select("*")) — @ts-expect-error
db.from(Users)
  .select("*")
  // @ts-expect-error - callback type is never without a named select
  .groupBy((_view: never, _selects: never) => [Users.type]);

// --- Aggregate nested in a scalar function ---

// Every projected item is an aggregate, so there is no grouping key at all.
const wrappedAggOnlyQuery = db.from(Users).select(() => ({
  totalCount: count("*"),
  averageId: round(avg(Users.id), 1),
  totalId: sum(Users.id),
}));
type WrappedAggOnly = Awaited<typeof wrappedAggOnlyQuery>;
Expect<
  Equal<
    WrappedAggOnly,
    { totalCount: number; averageId: number | null; totalId: bigint | null }[]
  >
>();

// The plain column beside it stays the grouping key.
const wrappedAggWithColQuery = db.from(Users).select(() => ({
  type: Users.type,
  averageId: round(avg(Users.id), 1),
}));
type WrappedAggWithCol = Awaited<typeof wrappedAggWithColQuery>;
Expect<
  Equal<
    WrappedAggWithCol,
    { type: "admin" | "user"; averageId: number | null }[]
  >
>();

// Two independent facts live on `_`: a wrapper is a *scalar function* that
// *contains* an aggregate. Only `_.hasAggregate` drives the gates.
const _roundWrappedAgg = round(avg(Users.id), 1);
Expect<Equal<(typeof _roundWrappedAgg)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _roundWrappedAgg)["_"]["hasAggregate"], true>>();

const _roundPlainCol = round(Users.id, 1);
Expect<Equal<(typeof _roundPlainCol)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _roundPlainCol)["_"]["hasAggregate"], false>>();

const _lowerPlain = lower(Users.username);
Expect<Equal<(typeof _lowerPlain)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _lowerPlain)["_"]["hasAggregate"], false>>();

const _coalesceAgg = coalesce(sum(Users.id), 0);
Expect<Equal<(typeof _coalesceAgg)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _coalesceAgg)["_"]["hasAggregate"], true>>();

const _coalescePlain = coalesce(Users.username, "x");
Expect<Equal<(typeof _coalescePlain)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _coalescePlain)["_"]["hasAggregate"], false>>();

const _numNonNullsAgg = numNonNulls(sum(Users.id), 0);
Expect<Equal<(typeof _numNonNullsAgg)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _numNonNullsAgg)["_"]["hasAggregate"], true>>();

const _numNonNullsPlain = numNonNulls(Users.username, "x");
Expect<Equal<(typeof _numNonNullsPlain)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _numNonNullsPlain)["_"]["hasAggregate"], false>>();

const _caseAgg = caseWhen(eq(Users.type, "admin"), count("*")).end();
Expect<Equal<(typeof _caseAgg)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _caseAgg)["_"]["hasAggregate"], true>>();

const _casePlain = caseWhen(eq(Users.type, "admin"), Users.username).end();
Expect<Equal<(typeof _casePlain)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _casePlain)["_"]["hasAggregate"], false>>();

// An aggregate in the CONDITION is the CASE's aggregate too — the condition is
// a Filter, and filters carry the flag the same way functions do.
const _caseAggCondition = caseWhen(gte(count("*"), 2), "many").end();
Expect<Equal<(typeof _caseAggCondition)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _caseAggCondition)["_"]["hasAggregate"], true>>();
Expect<Equal<(typeof _caseAggCondition)["$"]["HasArg"], false>>();

const _casePlainCondition = caseWhen(gte(Users.id, 2n), "many").end();
Expect<Equal<(typeof _casePlainCondition)["_"]["hasAggregate"], false>>();

// A comparison around that CASE reads the condition's aggregate, and does not
// mistake an aggregate-only condition for an argument placeholder.
const _caseAggComparison = eq(_caseAggCondition, "many");
Expect<Equal<(typeof _caseAggComparison)["_"]["hasAggregate"], true>>();
Expect<Equal<(typeof _caseAggComparison)["$"]["HasArg"], false>>();

// and() re-emits a condition's aggregate through a CASE.
const _caseAndCondition = caseWhen(
  and(gte(count("*"), 2), eq(Users.type, "admin")),
  "many",
).end();
Expect<Equal<(typeof _caseAndCondition)["_"]["hasAggregate"], true>>();

// having() accepts the aggregate-bearing CASE comparison, where() refuses it.
db.from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type)
  .having(() => eq(_caseAggCondition, "many"));

db.from(Users)
  .select("*")
  // @ts-expect-error - the CASE condition's aggregate is not allowed in WHERE
  .where(() => eq(_caseAggCondition, "many"));

// Two wrappers deep still bubbles up.
const _twiceWrapped = coalesce(round(avg(Users.id), 1), 0);
Expect<Equal<(typeof _twiceWrapped)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _twiceWrapped)["_"]["hasAggregate"], true>>();

// A bare aggregate function is the one case where both say the same thing.
const _bareCount = count("*");
Expect<Equal<(typeof _bareCount)["_"]["sqlFnType"], "aggregate">>();
Expect<Equal<(typeof _bareCount)["_"]["hasAggregate"], true>>();

// Both facts survive `.filter()`'s `Omit<this, "$">` and rebuilt `$`, which
// leaves `_` intact.
const _countFiltered = count(Users.id).filter(eq(Users.type, "admin"));
Expect<Equal<(typeof _countFiltered)["_"]["sqlFnType"], "aggregate">>();
Expect<Equal<(typeof _countFiltered)["_"]["hasAggregate"], true>>();

// --- groupBy() rejects an aggregate, however it is wrapped ---

// One query per case, so each `@ts-expect-error` sits directly above the line
// that errors rather than above a whole fluent chain.
const _gbBase = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }));

// @ts-expect-error - round(avg(...)) is an aggregate, so it is not a grouping key
_gbBase.groupBy(() => round(avg(Users.id), 1));

// @ts-expect-error - same for a conditional wrapper
_gbBase.groupBy(() => coalesce(sum(Users.id), 0));

// @ts-expect-error - same for a CASE over an aggregate
_gbBase.groupBy(() => caseWhen(eq(Users.type, "admin"), count("*")).end());

// @ts-expect-error - and for an aggregate in the CASE condition
_gbBase.groupBy(() => caseWhen(gte(count("*"), 2), "many").end());

// @ts-expect-error - and for an aggregate nested two wrappers deep
_gbBase.groupBy(() => coalesce(round(avg(Users.id), 1), 0));

// A CASE over plain columns stays a valid grouping key.
const _gbScalarCase = _gbBase.groupBy(() =>
  caseWhen(eq(Users.type, "admin"), Users.username).end(),
);

// Aggregate nested inside an aggregate is rejected too — invalid SQL either way.
// @ts-expect-error - avg() only accepts scalar expressions
avg(round(sum(Users.id), 2));
