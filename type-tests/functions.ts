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
import type { MaxFn, MinFn, SumFn } from "../src/functions/aggregate";
import type {
  AbsFn,
  CeilFn,
  FloorFn,
  ModFn,
  PowerFn,
  RoundFn,
  TruncFn,
} from "../src/functions/mathematical";
import type {
  LeftFn,
  LengthFn,
  LowerFn,
  PositionFn,
  RightFn,
  TrimFn,
  UpperFn,
} from "../src/functions/string";
import { Events, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// --- SQL Utility Functions ---

// now(), uuidv4(), uuidv7() return typed Sql<T>
Expect<Equal<ReturnType<typeof now>, Sql<Date>>>();
Expect<Equal<ReturnType<typeof uuidv4>, Sql<string>>>();
Expect<Equal<ReturnType<typeof uuidv7>, Sql<string>>>();

// --- String Functions ---

const lenFn = length(Users.username);
const lowFn = lower(Users.username);
const upFn = upper(Users.username);
const trimFn = trim(Users.username);
const lFn = left(Users.username, 4);
const rFn = right(Users.username, 4);
const posFn = position(Users.username, "@");

Expect<Equal<typeof lenFn, LengthFn<typeof Users.username>>>();
Expect<Equal<typeof lowFn, LowerFn<typeof Users.username>>>();
Expect<Equal<typeof upFn, UpperFn<typeof Users.username>>>();
Expect<Equal<typeof trimFn, TrimFn<typeof Users.username>>>();
Expect<Equal<typeof lFn, LeftFn<typeof Users.username, number>>>();
Expect<Equal<typeof rFn, RightFn<typeof Users.username, number>>>();
Expect<Equal<typeof posFn, PositionFn<typeof Users.username, "@">>>();

// Literal Strings
const lenLitFn = length("HELLO");
const lowLitFn = lower("HELLO");
const posLitFn = position("HELLO", "E");

Expect<Equal<typeof lenLitFn, LengthFn<"HELLO">>>();
Expect<Equal<typeof lowLitFn, LowerFn<"HELLO">>>();
Expect<Equal<typeof posLitFn, PositionFn<"HELLO", "E">>>();

const strArg = new Arg<string>((val) => val);
const lowArgFn = lower(strArg);

Expect<Equal<typeof lowArgFn, LowerFn<Arg<string>>>>();

// @ts-expect-error: length expects a string column
length(Users.id);
// @ts-expect-error: lower expects a string column
lower(Users.id);

// --- Numeric Functions ---

const absFn = abs(Users.id);
const mFn = mod(Users.id, 2);
const rndFn = round(Users.id);
const cFn = ceil(Users.id);
const fFn = floor(Users.id);
const tFn = trunc(Users.id);
const tFn2 = trunc(Users.id, 2);
const pFn = power(Users.id, 2);

Expect<Equal<typeof absFn, AbsFn<typeof Users.id>>>();
Expect<Equal<typeof mFn, ModFn<typeof Users.id, 2>>>();
Expect<Equal<typeof rndFn, RoundFn<typeof Users.id, undefined>>>();
Expect<Equal<typeof cFn, CeilFn<typeof Users.id>>>();
Expect<Equal<typeof fFn, FloorFn<typeof Users.id>>>();
Expect<Equal<typeof tFn, TruncFn<typeof Users.id, undefined>>>();
Expect<Equal<typeof tFn2, TruncFn<typeof Users.id, 2>>>();
Expect<Equal<typeof pFn, PowerFn<typeof Users.id, 2>>>();

// Literal Numbers
const absLitFn = abs(-42);
const rndLitFn = round(42.5);

Expect<Equal<typeof absLitFn, AbsFn<-42>>>();
Expect<Equal<typeof rndLitFn, RoundFn<42.5, undefined>>>();

// Arg Numbers
const numArg = Arg.number();
const absArgFn = abs(numArg);

Expect<Equal<typeof absArgFn, AbsFn<Arg<number>>>>();

// Check PgType for real and doublePrecision columns ("float")
Expect<Equal<(typeof Events.rating)["$"]["PgType"], "float">>();
Expect<Equal<(typeof Events.exactScore)["$"]["PgType"], "float">>();

// Numeric/math/aggregate functions support float columns
const absFloat = abs(Events.rating);
const roundFloat = round(Events.exactScore);
const sumFloat = sum(Events.rating);
Expect<Equal<typeof absFloat, AbsFn<typeof Events.rating>>>();
Expect<
  Equal<typeof roundFloat, RoundFn<typeof Events.exactScore, undefined>>
>();
Expect<Equal<typeof sumFloat, SumFn<typeof Events.rating>>>();

// @ts-expect-error: abs expects a numeric column
abs(Users.username);
// @ts-expect-error: round expects a numeric column
round(Users.username);
// @ts-expect-error: trunc expects a numeric column
trunc(Users.username);
// @ts-expect-error: power expects a numeric column
power(Users.username, 2);

// --- Nested String Functions ---

// lower(trim(col))
const _lowerTrim = lower(trim(Users.username));
Expect<Equal<typeof _lowerTrim, LowerFn<TrimFn<typeof Users.username>>>>();

// length(trim(col)) → numeric
const _lenTrim = length(trim(Users.username));
Expect<Equal<typeof _lenTrim, LengthFn<TrimFn<typeof Users.username>>>>();

// upper(lower(trim(col)))
const _tripleNest = upper(lower(trim(Users.username)));
Expect<
  Equal<typeof _tripleNest, UpperFn<LowerFn<TrimFn<typeof Users.username>>>>
>();

// @ts-expect-error: lower expects a string expression, abs returns numeric
lower(abs(Users.id));
// @ts-expect-error: abs expects a numeric expression, lower returns string
abs(lower(Users.username));

// --- Nested Numeric Functions ---

// round(abs(col))
const _roundAbs = round(abs(Users.id));
Expect<Equal<typeof _roundAbs, RoundFn<AbsFn<typeof Users.id>, undefined>>>();

// ceil(abs(col))
const _ceilAbs = ceil(abs(Users.id));
Expect<Equal<typeof _ceilAbs, CeilFn<AbsFn<typeof Users.id>>>>();

// --- Aggregate over Scalar Expressions ---

// count only accepts TableColumn, not scalar expressions
// @ts-expect-error: count does not accept scalar SqlFn expressions
count(lower(Users.username));

// sum(abs(col))
const _sumAbs = sum(abs(Users.id));
Expect<Equal<typeof _sumAbs, SumFn<AbsFn<typeof Users.id>>>>();

// min/max over scalar expressions
const _minLower = min(lower(Users.username));
const _maxAbs = max(abs(Users.id));
Expect<Equal<typeof _minLower, MinFn<LowerFn<typeof Users.username>>>>();
Expect<Equal<typeof _maxAbs, MaxFn<AbsFn<typeof Users.id>>>>();

// @ts-expect-error: aggregate-in-aggregate is not allowed
count(sum(Users.id));

// --- Null Sensitivity and Strict Function Return Type Inference ---

// String functions: lower, upper, trim, length, left, right, position
const _lowNull = lower(null);
Expect<Equal<(typeof _lowNull)["$"]["TsType"], null>>();

const _lowNotNullCol = lower(Users.username);
Expect<Equal<(typeof _lowNotNullCol)["$"]["TsType"], string>>();

const _lowNullableCol = lower(Users.email);
Expect<Equal<(typeof _lowNullableCol)["$"]["TsType"], string | null>>();

const _upNull = upper(null);
Expect<Equal<(typeof _upNull)["$"]["TsType"], null>>();

const _trimNull = trim(null);
Expect<Equal<(typeof _trimNull)["$"]["TsType"], null>>();

const _lenNull = length(null);
Expect<Equal<(typeof _lenNull)["$"]["TsType"], null>>();

const _lenNotNullCol = length(Users.username);
Expect<Equal<(typeof _lenNotNullCol)["$"]["TsType"], number>>();

const _lenNullableCol = length(Users.email);
Expect<Equal<(typeof _lenNullableCol)["$"]["TsType"], number | null>>();

const _leftNull = left(null, 2);
Expect<Equal<(typeof _leftNull)["$"]["TsType"], null>>();

const _rightNull = right(null, 2);
Expect<Equal<(typeof _rightNull)["$"]["TsType"], null>>();

const _posNull1 = position(null, "@");
Expect<Equal<(typeof _posNull1)["$"]["TsType"], null>>();

const _posNull2 = position(Users.username, null);
Expect<Equal<(typeof _posNull2)["$"]["TsType"], null>>();

// Math functions: abs, mod, round, ceil, floor, trunc, power
const _absNull = abs(null);
Expect<Equal<(typeof _absNull)["$"]["TsType"], null>>();

const _absCol = abs(Users.id);
Expect<Equal<(typeof _absCol)["$"]["TsType"], number>>();

const _modNull1 = mod(null, 2);
Expect<Equal<(typeof _modNull1)["$"]["TsType"], null>>();

const _modNull2 = mod(Users.id, null);
Expect<Equal<(typeof _modNull2)["$"]["TsType"], null>>();

const _roundNull = round(null);
Expect<Equal<(typeof _roundNull)["$"]["TsType"], null>>();

const _ceilNull = ceil(null);
Expect<Equal<(typeof _ceilNull)["$"]["TsType"], null>>();

const _floorNull = floor(null);
Expect<Equal<(typeof _floorNull)["$"]["TsType"], null>>();

const _truncNull = trunc(null);
Expect<Equal<(typeof _truncNull)["$"]["TsType"], null>>();

const _powerNull1 = power(null, 2);
Expect<Equal<(typeof _powerNull1)["$"]["TsType"], null>>();

const _powerNull2 = power(Users.id, null);
Expect<Equal<(typeof _powerNull2)["$"]["TsType"], null>>();

// Arithmetic functions: add, sub, mul, div
const _addNull1 = add(null, 5);
Expect<Equal<(typeof _addNull1)["$"]["TsType"], null>>();

const _addNull2 = add(Users.id, null);
Expect<Equal<(typeof _addNull2)["$"]["TsType"], null>>();

const _addColNum = add(Users.id, 5);
Expect<Equal<(typeof _addColNum)["$"]["TsType"], number>>();

const _subNull = sub(Users.id, null);
Expect<Equal<(typeof _subNull)["$"]["TsType"], null>>();

const _mulNull = mul(null, Users.id);
Expect<Equal<(typeof _mulNull)["$"]["TsType"], null>>();

const _divNull = div(Users.id, null);
Expect<Equal<(typeof _divNull)["$"]["TsType"], null>>();

// Nested null sensitivity preservation
const _nestedLenLowEmail = length(lower(Users.email));
Expect<Equal<(typeof _nestedLenLowEmail)["$"]["TsType"], number | null>>();

const _nestedLenLowNull = length(lower(null));
Expect<Equal<(typeof _nestedLenLowNull)["$"]["TsType"], null>>();

const _nestedAbsModNull = abs(mod(Users.id, null));
Expect<Equal<(typeof _nestedAbsModNull)["$"]["TsType"], null>>();

const _nestedAbsModCol = abs(mod(Users.id, 2));
Expect<Equal<(typeof _nestedAbsModCol)["$"]["TsType"], number>>();

// --- Coalesce and NullIf Type Tests ---

// coalesce drops null when a non-nullable fallback is present
const _coalNotNull = coalesce(Users.email, "fallback@example.com");
Expect<Equal<(typeof _coalNotNull)["$"]["TsType"], string>>();

// coalesce preserves nullable when all operands can be null
const _coalNullable = coalesce(Users.email, null);
Expect<Equal<(typeof _coalNullable)["$"]["TsType"], string | null>>();

// coalesce with non-null first operand stays non-null
const _coalFirstNotNull = coalesce(Users.username, "other");
Expect<Equal<(typeof _coalFirstNotNull)["$"]["TsType"], string>>();

// nullif returns union with null
const _nullIfUser = nullif(Users.username, "admin");
Expect<Equal<(typeof _nullIfUser)["$"]["TsType"], string | null>>();

const _nullIfNum = nullif(10, 10);
Expect<Equal<(typeof _nullIfNum)["$"]["TsType"], number | null>>();

// --- Concat and ConcatWs Type Tests ---

const _concatBasic = concat(Users.username, " - ", "suffix");
Expect<Equal<(typeof _concatBasic)["$"]["TsType"], string>>();

const _concatWsBasic = concatWs(" ", Users.username, Users.email);
Expect<Equal<(typeof _concatWsBasic)["$"]["TsType"], string>>();

const _concatWsNullSep = concatWs(null, Users.username);
Expect<Equal<(typeof _concatWsNullSep)["$"]["TsType"], null>>();

// --- Sql and BigInt Operand Type Tests ---

const _lowSql = lower(sql<string>`'HELLO'`);
Expect<Equal<(typeof _lowSql)["$"]["TsType"], string>>();

const _addSql = add(Users.id, sql<number>`5`);
Expect<Equal<(typeof _addSql)["$"]["TsType"], number>>();

const _addBigInt = add(Users.id, 10n);
Expect<Equal<(typeof _addBigInt)["$"]["TsType"], number>>();

const _modBigInt = mod(Users.id, 2n);
Expect<Equal<(typeof _modBigInt)["$"]["TsType"], number>>();

// --- Concat with non-text columns ---
const _concatWithId = concat(Users.username, "#", Users.id);
Expect<Equal<(typeof _concatWithId)["$"]["TsType"], string>>();

const _concatWithDate = concat(Users.username, Users.createdAt);
Expect<Equal<(typeof _concatWithDate)["$"]["TsType"], string>>();

// --- Greatest and Least ---
const _greatestDate = greatest(Users.createdAt, Users.createdAt);
Expect<Equal<(typeof _greatestDate)["$"]["TsType"], Date>>();

const _greatestNull = greatest(null, null);
Expect<Equal<(typeof _greatestNull)["$"]["TsType"], null>>();

const _leastNum = least(10, 0);
Expect<Equal<(typeof _leastNum)["$"]["TsType"], number>>();

const _leastBigInt = least(Users.id, 0n);
Expect<Equal<(typeof _leastBigInt)["$"]["TsType"], bigint>>();

// --- Raw SQL with SqlFn parameter ---
const _sqlWithFn = sql`SELECT ${lower(Users.username)} FROM users`;
Expect<Equal<typeof _sqlWithFn, Sql>>();

// --- stDistance with null point ---
const GeoTestTable = table("public", "geo_test", {
  id: pk(),
  loc: geography.point({ notNull }),
});
const _stDistNull = stDistance(GeoTestTable.loc, null);
Expect<Equal<(typeof _stDistNull)["$"]["TsType"], null>>();
