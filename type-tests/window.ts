import {
  asc,
  coalesce,
  count,
  cumeDist,
  denseRank,
  desc,
  eq,
  firstValue,
  lag,
  lastValue,
  lead,
  length,
  nthValue,
  ntile,
  percentRank,
  rank,
  rowNumber,
  rows,
  sum,
  unboundedPreceding,
} from "durcno";
import { db, Posts } from "./schema";
import { type Equal, Expect } from "./utils";

// ============================================================================
// Aggregates as window functions — no auto GROUP BY
// ============================================================================

// windowed sum alongside plain columns — a non-grouping projection
const grandTotalQuery = db.from(Posts).select(() => ({
  id: Posts.id,
  title: Posts.title,
  grandTotal: sum(Posts.userId).over(),
}));
type GrandTotal = Awaited<typeof grandTotalQuery>;
Expect<
  Equal<
    GrandTotal,
    { id: bigint; title: string | null; grandTotal: bigint | null }[]
  >
>();

// windowed count keeps the number type
const windowedCountQuery = db.from(Posts).select(() => ({
  id: Posts.id,
  total: count("*").over({ partitionBy: [Posts.userId] }),
}));
type WindowedCount = Awaited<typeof windowedCountQuery>;
Expect<Equal<WindowedCount, { id: bigint; total: number }[]>>();

// coalesce over a windowed aggregate stays fully typed
const coalescedWindowQuery = db.from(Posts).select(() => ({
  grandTotal: coalesce(sum(Posts.userId).over(), 0n),
}));
type CoalescedWindow = Awaited<typeof coalescedWindowQuery>;
Expect<Equal<CoalescedWindow, { grandTotal: bigint }[]>>();

// ============================================================================
// Pure window functions
// ============================================================================

const numberedQuery = db.from(Posts).select(() => ({
  position: rowNumber().over({
    partitionBy: [Posts.userId],
    orderBy: [desc(Posts.createdAt)],
  }),
  rank: rank().over({ orderBy: [desc(Posts.userId)] }),
  dense: denseRank().over({ orderBy: [desc(Posts.userId)] }),
  percentile: percentRank().over({ orderBy: [asc(Posts.userId)] }),
  dist: cumeDist().over({ orderBy: [asc(Posts.userId)] }),
  quartile: ntile(4).over({ orderBy: [desc(Posts.userId)] }),
}));
type Numbered = Awaited<typeof numberedQuery>;
Expect<
  Equal<
    Numbered,
    {
      position: number;
      rank: number;
      dense: number;
      percentile: number;
      dist: number;
      quartile: number;
    }[]
  >
>();

const offsetQuery = db.from(Posts).select(() => ({
  previous: lag(Posts.id).over({ orderBy: [asc(Posts.id)] }),
  nextWithOffset: lead(Posts.id, 2).over({ orderBy: [asc(Posts.id)] }),
  first: firstValue(Posts.createdAt).over({
    partitionBy: [Posts.userId],
  }),
  last: lastValue(Posts.title).over({ partitionBy: [Posts.userId] }),
  second: nthValue(Posts.title, 2).over({ partitionBy: [Posts.userId] }),
}));
type Offset = Awaited<typeof offsetQuery>;
Expect<
  Equal<
    Offset,
    {
      previous: bigint | null;
      nextWithOffset: bigint | null;
      first: Date | null;
      last: string | null;
      second: string | null;
    }[]
  >
>();

// lag default restores the exact value type
const lagDefaultQuery = db.from(Posts).select(() => ({
  previous: lag(Posts.id, 1, 0n).over({ orderBy: [asc(Posts.id)] }),
}));
type LagDefault = Awaited<typeof lagDefaultQuery>;
Expect<Equal<LagDefault, { previous: bigint | null }[]>>();

// ============================================================================
// Frame clauses and window ORDER BY referencing columns and fns
// ============================================================================

const frameQuery = db.from(Posts).select(() => ({
  running: sum(Posts.userId).over({
    orderBy: [asc(Posts.id)],
    frame: rows(unboundedPreceding()),
  }),
}));
type Frame = Awaited<typeof frameQuery>;
Expect<Equal<Frame, { running: bigint | null }[]>>();

// window orderBy accepts fn expressions
const windowFnOrderQuery = db.from(Posts).select(() => ({
  total: sum(Posts.userId).over({
    orderBy: asc(length(Posts.title)),
  }),
}));
type WindowFnOrder = Awaited<typeof windowFnOrderQuery>;
Expect<Equal<WindowFnOrder, { total: bigint | null }[]>>();

// ============================================================================
// Window functions in ORDER BY of the query itself
// ============================================================================

const orderByWindowQuery = db
  .from(Posts)
  .select(() => ({ id: Posts.id, title: Posts.title }))
  .orderBy(() => desc(sum(Posts.userId).over()));
type OrderByWindow = Awaited<typeof orderByWindowQuery>;
Expect<Equal<OrderByWindow, { id: bigint; title: string | null }[]>>();

// ============================================================================
// Placement rules
// ============================================================================

const windowed = sum(Posts.userId).over();

// The static contract and the runtime flag agree: a windowed expression is
// aggregate-like, while `hasWindow` keeps it out of auto GROUP BY.
Expect<Equal<(typeof windowed)["_"]["sqlFnType"], "window">>();
Expect<Equal<(typeof windowed)["_"]["hasAggregate"], true>>();

const pureWindowed = rowNumber().over();
Expect<Equal<(typeof pureWindowed)["_"]["sqlFnType"], "window">>();
Expect<Equal<(typeof pureWindowed)["_"]["hasAggregate"], true>>();

// Not allowed in WHERE
db.from(Posts)
  .select(() => ({ id: Posts.id }))
  // @ts-expect-error: window functions are not allowed in WHERE
  .where(eq(sum(Posts.userId).over(), 1n));

// Not allowed in GROUP BY
db.from(Posts)
  .select(() => ({ id: Posts.id }))
  // @ts-expect-error: window functions are not allowed in GROUP BY
  .groupBy(() => [windowed]);

// Not allowed in UPDATE SET
db.update(Posts)
  // @ts-expect-error: window functions are not allowed in UPDATE SET
  .set({ title: windowed });
