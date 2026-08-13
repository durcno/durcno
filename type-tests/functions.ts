import type { now, Sql, uuidv4, uuidv7 } from "durcno";
import {
  Arg,
  abs,
  ceil,
  count,
  floor,
  left,
  length,
  lower,
  max,
  min,
  mod,
  position,
  power,
  right,
  round,
  sum,
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

// now(), uuidv4(), uuidv7() return Sql
Expect<Equal<ReturnType<typeof now>, Sql>>();
Expect<Equal<ReturnType<typeof uuidv4>, Sql>>();
Expect<Equal<ReturnType<typeof uuidv7>, Sql>>();

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
Expect<Equal<typeof lFn, LeftFn<typeof Users.username, false>>>();
Expect<Equal<typeof rFn, RightFn<typeof Users.username, false>>>();
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
