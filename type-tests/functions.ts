import type { now, Sql, uuidv4, uuidv7 } from "durcno";
import {
  Arg,
  abs,
  add,
  ceil,
  coalesce,
  concat,
  concatWs,
  count,
  div,
  floor,
  geography,
  greatest,
  least,
  left,
  length,
  lower,
  max,
  min,
  mod,
  mul,
  notNull,
  nullif,
  numNonNulls,
  numNulls,
  pk,
  position,
  power,
  right,
  round,
  sql,
  stDistance,
  sub,
  sum,
  table,
  trim,
  trunc,
  upper,
} from "durcno";
import { Events, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// Reads the inferred TypeScript result of a SQL expression
type TsType<T> = T extends { $: { TsType: infer R } } ? R : never;

// -----------------------------------------------------------------------------
// SQL utility functions
// -----------------------------------------------------------------------------

Expect<Equal<ReturnType<typeof now>, Sql<Date>>>();
Expect<Equal<ReturnType<typeof uuidv4>, Sql<string>>>();
Expect<Equal<ReturnType<typeof uuidv7>, Sql<string>>>();

// -----------------------------------------------------------------------------
// String functions
// -----------------------------------------------------------------------------

const lenName = length(Users.username);
const lenEmail = length(Users.email);
const lowName = lower(Users.username);
const lowEmail = lower(Users.email);
const lowNull = lower(null);
const upName = upper(Users.username);
const trimName = trim(Users.username);
const leftName = left(Users.username, 4);
const rightName = right(Users.username, 4);
const posAt = position(Users.username, "@");

Expect<Equal<TsType<typeof lenName>, number>>();
Expect<Equal<TsType<typeof lenEmail>, number | null>>();
Expect<Equal<TsType<typeof lowName>, string>>();
Expect<Equal<TsType<typeof lowEmail>, string | null>>();
Expect<Equal<TsType<typeof lowNull>, null>>();
Expect<Equal<TsType<typeof upName>, string>>();
Expect<Equal<TsType<typeof trimName>, string>>();
Expect<Equal<TsType<typeof leftName>, string>>();
Expect<Equal<TsType<typeof rightName>, string>>();
Expect<Equal<TsType<typeof posAt>, number>>();

// Literal and prepared inputs
const lowLiteral = lower("HELLO");
Expect<Equal<TsType<typeof lowLiteral>, string>>();

const strArg = new Arg<string>((val) => val);
const lowArg = lower(strArg);
Expect<Equal<TsType<typeof lowArg>, string>>();

// @ts-expect-error - length expects a string input
length(Users.id);

// @ts-expect-error - lower expects a string input
lower(Users.id);

// -----------------------------------------------------------------------------
// Numeric functions
// -----------------------------------------------------------------------------

const absId = abs(Users.id);
const modId = mod(Users.id, 2);
const roundId = round(Users.id);
const roundId2 = round(Users.id, 2);
const ceilId = ceil(Users.id);
const floorId = floor(Users.id);
const truncId = trunc(Users.id, 2);
const powerId = power(Users.id, 2);
const addId = add(Users.id, 5);
const subId = sub(Users.id, 5);
const mulId = mul(Users.id, 5);
const divId = div(Users.id, 5);

Expect<Equal<TsType<typeof absId>, number>>();
Expect<Equal<TsType<typeof modId>, number>>();
Expect<Equal<TsType<typeof roundId>, number>>();
Expect<Equal<TsType<typeof roundId2>, number>>();
Expect<Equal<TsType<typeof ceilId>, number>>();
Expect<Equal<TsType<typeof floorId>, number>>();
Expect<Equal<TsType<typeof truncId>, number>>();
Expect<Equal<TsType<typeof powerId>, number>>();
Expect<Equal<TsType<typeof addId>, number>>();
Expect<Equal<TsType<typeof subId>, number>>();
Expect<Equal<TsType<typeof mulId>, number>>();
Expect<Equal<TsType<typeof divId>, number>>();

// Nulls propagate
const absNull = abs(null);
const modNull = mod(Users.id, null);
const addNull = add(null, 5);
const upNull = upper(null);
const trimNull = trim(null);
const leftNull = left(null, 2);
const posNull = position(null, "@");

Expect<Equal<TsType<typeof absNull>, null>>();
Expect<Equal<TsType<typeof modNull>, null>>();
Expect<Equal<TsType<typeof addNull>, null>>();
Expect<Equal<TsType<typeof upNull>, null>>();
Expect<Equal<TsType<typeof trimNull>, null>>();
Expect<Equal<TsType<typeof leftNull>, null>>();
Expect<Equal<TsType<typeof posNull>, null>>();

// float columns are numeric
Expect<Equal<(typeof Events.rating)["$"]["PgType"], "float">>();

const absFloat = abs(Events.rating);
const roundFloat = round(Events.exactScore);
const sumFloat = sum(Events.rating);
Expect<Equal<TsType<typeof absFloat>, number | null>>();
Expect<Equal<TsType<typeof roundFloat>, number | null>>();
Expect<Equal<TsType<typeof sumFloat>, number | null>>();

// @ts-expect-error - abs expects a numeric input
abs(Users.username);

// @ts-expect-error - round expects a numeric input
round(Users.username);

// -----------------------------------------------------------------------------
// Nested expressions
// -----------------------------------------------------------------------------

const lowTrim = lower(trim(Users.username));
const lenTrim = length(trim(Users.username));
const roundAbs = round(abs(Users.id));
const ceilAbs = ceil(abs(Users.id));
const sumAbs = sum(abs(Users.id));
const minLower = min(lower(Users.username));
const maxAbs = max(abs(Users.id));

Expect<Equal<TsType<typeof lowTrim>, string>>();
Expect<Equal<TsType<typeof lenTrim>, number>>();
Expect<Equal<TsType<typeof roundAbs>, number>>();
Expect<Equal<TsType<typeof ceilAbs>, number>>();
Expect<Equal<TsType<typeof sumAbs>, number | null>>();
Expect<Equal<TsType<typeof minLower>, string | null>>();
Expect<Equal<TsType<typeof maxAbs>, number | null>>();

// Nullability is preserved through nesting
const nestedLenLowEmail = length(lower(Users.email));
const nestedLenLowNull = length(lower(null));
const nestedAbsModNull = abs(mod(Users.id, null));
const nestedAbsModCol = abs(mod(Users.id, 2));

Expect<Equal<TsType<typeof nestedLenLowEmail>, number | null>>();
Expect<Equal<TsType<typeof nestedLenLowNull>, null>>();
Expect<Equal<TsType<typeof nestedAbsModNull>, null>>();
Expect<Equal<TsType<typeof nestedAbsModCol>, number>>();

// @ts-expect-error - lower expects a string expression
lower(abs(Users.id));

// @ts-expect-error - abs expects a numeric expression
abs(lower(Users.username));

// -----------------------------------------------------------------------------
// Aggregates over scalar expressions
// -----------------------------------------------------------------------------

// count only accepts table columns
// @ts-expect-error - count does not accept scalar SqlFn expressions
count(lower(Users.username));

// @ts-expect-error - aggregates cannot nest
count(sum(Users.id));

// -----------------------------------------------------------------------------
// Coalesce and nullIf
// -----------------------------------------------------------------------------

const coalNotNull = coalesce(Users.email, "fallback@example.com");
const coalNullable = coalesce(Users.email, null);
const nullIfUser = nullif(Users.username, "admin");
const nullIfNum = nullif(10, 10);

Expect<Equal<TsType<typeof coalNotNull>, string>>();
Expect<Equal<TsType<typeof coalNullable>, string | null>>();
Expect<Equal<TsType<typeof nullIfUser>, string | null>>();
Expect<Equal<TsType<typeof nullIfNum>, number | null>>();

// -----------------------------------------------------------------------------
// Concat
// -----------------------------------------------------------------------------

const concatBasic = concat(Users.username, " - ", "suffix");
const concatWithId = concat(Users.username, "#", Users.id);
const concatWsBasic = concatWs(" ", Users.username, Users.email);
const concatWsNullSep = concatWs(null, Users.username);

Expect<Equal<TsType<typeof concatBasic>, string>>();
Expect<Equal<TsType<typeof concatWithId>, string>>();
Expect<Equal<TsType<typeof concatWsBasic>, string>>();
Expect<Equal<TsType<typeof concatWsNullSep>, null>>();

// -----------------------------------------------------------------------------
// Sql and bigint operands
// -----------------------------------------------------------------------------

const lowSql = lower(sql<string>`'HELLO'`);
const addSql = add(Users.id, sql<number>`5`);
const addBigInt = add(Users.id, 10n);
const modBigInt = mod(Users.id, 2n);

Expect<Equal<TsType<typeof lowSql>, string>>();
Expect<Equal<TsType<typeof addSql>, number>>();
Expect<Equal<TsType<typeof addBigInt>, number>>();
Expect<Equal<TsType<typeof modBigInt>, number>>();

// -----------------------------------------------------------------------------
// Greatest and least
// -----------------------------------------------------------------------------

const greatestDate = greatest(Users.createdAt, Users.createdAt);
const leastBigInt = least(Users.id, 0n);
const greatestNull = greatest(null, null);

Expect<Equal<TsType<typeof greatestDate>, Date>>();
Expect<Equal<TsType<typeof leastBigInt>, bigint>>();
Expect<Equal<TsType<typeof greatestNull>, null>>();

// -----------------------------------------------------------------------------
// numNonNulls and numNulls
// -----------------------------------------------------------------------------

const numMixed = numNonNulls(
  Users.username,
  Users.email,
  null,
  42,
  sql<number>`1`,
);
Expect<Equal<TsType<typeof numMixed>, number>>();
Expect<
  Equal<
    (typeof numMixed)["$"]["Columns"],
    typeof Users.username | typeof Users.email
  >
>();

const numArg = numNulls(Arg.number(), null);
Expect<Equal<TsType<typeof numArg>, number>>();
Expect<Equal<(typeof numArg)["$"]["HasArg"], true>>();

// @ts-expect-error - PostgreSQL requires at least one argument
numNonNulls();

// @ts-expect-error - a table is not a value expression
numNulls(Users);

// -----------------------------------------------------------------------------
// Raw SQL and PostGIS
// -----------------------------------------------------------------------------

const sqlWithFn = sql`SELECT ${lower(Users.username)} FROM users`;
Expect<Equal<typeof sqlWithFn, Sql>>();

const GeoTestTable = table("public", "geo_test", {
  id: pk(),
  loc: geography.point({ notNull }),
});
const stDistNull = stDistance(GeoTestTable.loc, null);
Expect<Equal<TsType<typeof stDistNull>, null>>();
