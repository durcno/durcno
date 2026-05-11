import { avg, count, countDistinct, max, min, sum } from "durcno";
import type { ExprReturnType } from "../src/functions/index";
import { ArrayTest, db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

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

// Negative tests for avg and sum with boolean columns
// @ts-expect-error
avg(Users.isActive); // Assuming isActive exists, or use enum column
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

// -------------------------------------------------------------------------
// fromDriver return types
// -------------------------------------------------------------------------

// avg.fromDriver returns string | null
const _avgFn = avg(Posts.id);
Expect<Equal<ReturnType<typeof _avgFn.fromDriver>, string | null>>();

// sum.fromDriver returns number | null
const _sumFn = sum(Posts.id);
Expect<Equal<ReturnType<typeof _sumFn.fromDriver>, number | null>>();

// count.fromDriver returns number
const _countFn = count(Posts.id);
Expect<Equal<ReturnType<typeof _countFn.fromDriver>, number>>();

// count(*).fromDriver returns number
const _countStarFn = count("*");
Expect<Equal<ReturnType<typeof _countStarFn.fromDriver>, number>>();

// min.fromDriver return type matches inner column's ExprReturnType
const _minFn = min(Posts.id);
type _MinReturn = ReturnType<typeof _minFn.fromDriver>;
Expect<Equal<_MinReturn, ExprReturnType<typeof Posts.id> | null>>();

// max.fromDriver return type matches inner column's ExprReturnType
const _maxFn = max(Posts.id);
type _MaxReturn = ReturnType<typeof _maxFn.fromDriver>;
Expect<Equal<_MaxReturn, ExprReturnType<typeof Posts.id> | null>>();
