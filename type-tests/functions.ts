import type { now, Sql, uuidv4, uuidv7 } from "durcno";
import {
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
  right,
  round,
  sum,
  trim,
  upper,
} from "durcno";
import type { MaxFn, MinFn, SumFn } from "../src/functions/aggregate";
import type {
  AbsFn,
  CeilFn,
  FloorFn,
  ModFn,
  RoundFn,
} from "../src/functions/numeric";
import type {
  LeftFn,
  LengthFn,
  LowerFn,
  PositionFn,
  RightFn,
  TrimFn,
  UpperFn,
} from "../src/functions/string";
import { Users } from "./schema";
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

Expect<Equal<typeof absFn, AbsFn<typeof Users.id>>>();
Expect<Equal<typeof mFn, ModFn<typeof Users.id, 2>>>();
Expect<Equal<typeof rndFn, RoundFn<typeof Users.id, undefined>>>();
Expect<Equal<typeof cFn, CeilFn<typeof Users.id>>>();
Expect<Equal<typeof fFn, FloorFn<typeof Users.id>>>();

// @ts-expect-error: abs expects a numeric column
abs(Users.username);
// @ts-expect-error: round expects a numeric column
round(Users.username);

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
