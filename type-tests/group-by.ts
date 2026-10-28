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

// -----------------------------------------------------------------------------
// Aggregate operands
// -----------------------------------------------------------------------------

avg(Posts.id);
sum(Posts.id);
min(Users.username);
max(Posts.createdAt);
count(Users.username);
count("*");
countDistinct(Users.username);

// @ts-expect-error - avg accepts numeric columns only
avg(Users.username);

// @ts-expect-error - sum accepts numeric columns only
sum(Users.type);

// @ts-expect-error - a numeric array is not a numeric scalar
avg(ArrayTest.coordinates);

// @ts-expect-error - aggregates cannot nest
avg(round(sum(Users.id), 2));

// -----------------------------------------------------------------------------
// Auto GROUP BY
// -----------------------------------------------------------------------------

// Aggregates next to plain columns and scalar functions infer the full shape
const autoGroupQuery = db.from(Users).select(() => ({
  type: Users.type,
  username: Users.username,
  lowerEmail: lower(Users.email),
  total: count("*"),
  totalIds: sum(Users.id),
}));
type AutoGroup = Awaited<typeof autoGroupQuery>;
Expect<
  Equal<
    AutoGroup,
    {
      type: "admin" | "user";
      username: string;
      lowerEmail: string | null;
      total: number;
      totalIds: bigint | null;
    }[]
  >
>();

// A purely aggregate projection needs no grouping key
const pureAggQuery = db.from(Users).select(() => ({
  total: count("*"),
  distinctUsers: count(Users.id),
}));
type PureAgg = Awaited<typeof pureAggQuery>;
Expect<Equal<PureAgg, { total: number; distinctUsers: number }[]>>();

// -----------------------------------------------------------------------------
// groupBy() forms
// -----------------------------------------------------------------------------

const _gbArray = db
  .from(Users)
  .select(() => ({
    type: Users.type,
    username: Users.username,
    total: count("*"),
  }))
  .groupBy(() => [Users.type, Users.username]);

const _gbScalarFn = db
  .from(Users)
  .select(() => ({
    lname: lower(Users.username),
    total: count("*"),
  }))
  .groupBy(() => lower(Users.username));

// Select aliases are addressable from the callback
const _gbAliases = db
  .from(Users)
  .select(() => ({
    lname: lower(Users.username),
    type: Users.type,
    total: count("*"),
  }))
  .groupBy((_view, { lname, type }) => [lname, type]);

// Aliases and direct columns can be mixed
const _gbAliasAndColumn = db
  .from(Users)
  .select(() => ({
    lname: lower(Users.username),
    total: count("*"),
  }))
  .groupBy((_view, { lname }) => [lname, Users.type]);

db.from(Users)
  .select("*")
  // @ts-expect-error - the callback type is never without a named select
  .groupBy((_view: never, _selects: never) => [Users.type]);

const _gbOnce = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type);
// @ts-expect-error - groupBy is removed after the first call
_gbOnce.groupBy(() => Users.type);

// -----------------------------------------------------------------------------
// having()
// -----------------------------------------------------------------------------

// Literal, aggregate-vs-aggregate, wrapped aggregate, and nesting all compose
const _havingQuery = db
  .from(Users)
  .select(() => ({
    type: Users.type,
    total: count("*"),
    sumId: sum(Users.id),
    averageId: round(avg(Users.id), 1),
  }))
  .groupBy(() => Users.type)
  .having(() =>
    and(
      gt(sum(Users.id), 10),
      gte(count("*"), 5),
      gt(coalesce(round(avg(Users.id), 1), 0), 5),
    ),
  );

const _havingOnce = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type)
  .having(() => gte(count("*"), 1));
// @ts-expect-error - having is removed after the first call
_havingOnce.having(() => gte(count("*"), 1));

// -----------------------------------------------------------------------------
// ORDER BY on grouped queries
// -----------------------------------------------------------------------------

const _orderWrappedAgg = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type)
  .orderBy(() => asc(round(avg(Users.id), 1)));

// An aggregate can order a query that groups by nothing but its projection
const _orderAggOnlySelect = db
  .from(Users)
  .select(() => ({ total: count("*") }))
  .orderBy(() => desc(sum(Users.id)));

// -----------------------------------------------------------------------------
// Aggregate flags on wrapped expressions
// -----------------------------------------------------------------------------

const _roundWrappedAgg = round(avg(Users.id), 1);
Expect<Equal<(typeof _roundWrappedAgg)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _roundWrappedAgg)["_"]["hasAggregate"], true>>();

const _coalesceAgg = coalesce(sum(Users.id), 0);
Expect<Equal<(typeof _coalesceAgg)["_"]["hasAggregate"], true>>();

const _numNonNullsAgg = numNonNulls(sum(Users.id), 0);
Expect<Equal<(typeof _numNonNullsAgg)["_"]["hasAggregate"], true>>();

const _caseAgg = caseWhen(eq(Users.type, "admin"), count("*")).end();
Expect<Equal<(typeof _caseAgg)["_"]["hasAggregate"], true>>();

// An aggregate in the CASE condition counts too, without becoming an Arg
const _caseAggCondition = caseWhen(gte(count("*"), 2), "many").end();
Expect<Equal<(typeof _caseAggCondition)["_"]["hasAggregate"], true>>();
Expect<Equal<(typeof _caseAggCondition)["$"]["HasArg"], false>>();

const _roundPlainCol = round(Users.id, 1);
Expect<Equal<(typeof _roundPlainCol)["_"]["sqlFnType"], "scalar">>();
Expect<Equal<(typeof _roundPlainCol)["_"]["hasAggregate"], false>>();

// -----------------------------------------------------------------------------
// Placement rules
// -----------------------------------------------------------------------------

// An aggregate is not a grouping key, however it is wrapped
const _gbBase = db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }));

// @ts-expect-error - a bare aggregate is not a grouping key
_gbBase.groupBy(() => count("*"));

// @ts-expect-error - a wrapped aggregate is still an aggregate
_gbBase.groupBy(() => round(avg(Users.id), 1));

// A CASE over plain columns is a valid grouping key
const _gbScalarCase = _gbBase.groupBy(() =>
  caseWhen(eq(Users.type, "admin"), Users.username).end(),
);

// WHERE refuses aggregates, bare or wrapped
db.from(Users)
  .select("*")
  // @ts-expect-error - a wrapped aggregate is still an aggregate
  .where(() => gt(round(avg(Users.id), 1), 5));

db.from(Users)
  .select("*")
  // @ts-expect-error - and() re-emits the aggregate its conditions carry
  .where(() => and(gt(Users.id, 1n), gte(count("*"), 2)));

// A HAVING clause accepts the aggregate-bearing CASE comparison
db.from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => Users.type)
  .having(() => eq(_caseAggCondition, "many"));

db.from(Users)
  .select("*")
  // @ts-expect-error - the CASE condition's aggregate is not allowed in WHERE
  .where(() => eq(_caseAggCondition, "many"));
