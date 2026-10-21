#!/usr/bin/env node
/**
 * Regression guard for the operand-walk call shape in `SqlFn._hasAggregate`:
 * a `[left, right]` array against one call per operand. Both sides answer the
 * same question about the same operands, so the only difference is one
 * 2-element allocation and the array walk it feeds — which is what this
 * measures.
 *
 * The two bodies are inlined here rather than taken from the constructors,
 * because the shipped constructor holds only one of them. The timed batch
 * rotates over many operand pairs: with a fixed pair the call is loop-invariant
 * and V8 hoists the whole batch, and with two pairs it unrolls and folds both.
 * A run that reports sub-nanosecond calls has hit one of those, and a body whose
 * answer is unused is deleted outright.
 *
 * Usage (from the repo root): `node perf/sqlfn-operands.paths.ts [case...]`
 * With no argument it runs every case. Reading the numbers: AGENTS.md
 * (Performance). Siblings: `sqlfn-tosql.paths.ts`, `sql-loops.paths.ts`.
 */
import { avg, coalesce, count, lower, SqlFn, sum } from "durcno";
import * as schema from "./schema.ts";

const { Articles } = schema;

/** One array holding both operands, walked once. */
function arrayShape(left: unknown, right: unknown): boolean {
  return SqlFn._hasAggregate([left, right]);
}

/** Two calls, one per operand, no allocation. */
function pairShape(left: unknown, right: unknown): boolean {
  return SqlFn._hasAggregate(left) || SqlFn._hasAggregate(right);
}

/** Text columns — `lower`/`coalesce` only accept these. */
const textCols = [
  Articles.title,
  Articles.slug,
  Articles.category,
  Articles.language,
  Articles.status,
  Articles.authorName,
  Articles.summary,
  Articles.authorEmail,
];

/** Numeric columns — `avg`/`sum` only accept these. */
const numericCols = [
  Articles.wordCount,
  Articles.viewCount,
  Articles.commentCount,
  Articles.likeCount,
];

/** Every column, for the operand shapes that take any. */
const cols = [...textCols, ...numericCols];

const rotated = <T>(make: (col: (typeof cols)[number], i: number) => T): T[] =>
  cols.map(make);

const rotatedText = <T>(
  make: (col: (typeof textCols)[number], i: number) => T,
): T[] => textCols.map(make);

const rotatedNumeric = <T>(
  make: (col: (typeof numericCols)[number], i: number) => T,
): T[] => numericCols.map(make);

/** Operand pairs, cheapest walk first; `aggregate` is the one that recurses. */
const cases: Record<string, [unknown, unknown][]> = {
  "literal-literal": rotated((_c, i) => [i, "x"] as [unknown, unknown]),
  "col-literal": rotated((c) => [c, 1] as [unknown, unknown]),
  "col-col": rotated(
    (c, i) => [c, cols[(i + 1) % cols.length]] as const as [unknown, unknown],
  ),
  "fn-col": rotatedText((c) => [lower(c), c] as [unknown, unknown]),
  "fn-fn": rotatedText(
    (c) => [lower(c), coalesce(c, "none")] as [unknown, unknown],
  ),
  aggregate: rotatedNumeric(
    (c, i) =>
      [avg(c), sum(numericCols[(i + 1) % numericCols.length])] as [
        unknown,
        unknown,
      ],
  ),
  "aggregate-star": rotatedNumeric(
    (c) => [count("*"), avg(c)] as [unknown, unknown],
  ),
};

const names = process.argv.slice(2);
const selected = names.length === 0 ? Object.keys(cases) : names;

const variants = { array: arrayShape, pair: pairShape };

// A side that answers differently is not a comparison of the same work.
for (const name of selected) {
  const pairs = cases[name];
  if (pairs === undefined) {
    console.error(
      `unknown case ${name}; try ${Object.keys(cases).join(" | ")}`,
    );
    process.exit(1);
  }
  for (const [left, right] of pairs) {
    if (pairShape(left, right) !== arrayShape(left, right)) {
      console.error(`${name}: the two bodies disagree on ${String(left)}`);
      process.exit(1);
    }
  }
}

const WARMUP = 200;
const SAMPLES = 1_000;
const BATCH = 1_000;

/** Pure bodies plus a JIT: an unused answer is a deletable call. */
let sink = 0;

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, (sorted.length * q) | 0)];
  return { min: sorted[0], p10: at(0.1), median: at(0.5) };
}

for (const name of selected) {
  const pairs = cases[name];
  const mask = pairs.length - 1;
  const samples: Record<string, number[]> = { array: [], pair: [] };

  for (let i = 0; i < WARMUP; i++) {
    for (const body of Object.values(variants)) {
      for (let j = 0; j < BATCH; j++) {
        const p = pairs[j & mask];
        sink ^= body(p[0], p[1]) ? 1 : 0;
      }
    }
  }

  for (let i = 0; i < SAMPLES; i++) {
    // Alternate inside the sample loop: drift hits both sides equally.
    for (const key of ["array", "pair"] as const) {
      const body = variants[key];
      const t = process.hrtime.bigint();
      for (let j = 0; j < BATCH; j++) {
        const p = pairs[j & mask];
        sink ^= body(p[0], p[1]) ? 1 : 0;
      }
      // `hrtime` is nanoseconds; dividing by `1e6` would report milliseconds and
      // then dividing by `BATCH` would round the answer away entirely.
      const perCall = Number(process.hrtime.bigint() - t) / BATCH;
      samples[key].push(perCall);
    }
  }

  const a = stats(samples.array);
  const b = stats(samples.pair);
  const pct = (x: number, y: number) => (((y - x) / x) * 100).toFixed(1);
  console.log(
    `${name.padEnd(16)} array min=${a.min.toFixed(2)} p10=${a.p10.toFixed(2)} ` +
      `med=${a.median.toFixed(2)} | pair min=${b.min.toFixed(2)} ` +
      `p10=${b.p10.toFixed(2)} med=${b.median.toFixed(2)} ns | ` +
      `min ${pct(a.min, b.min)}% p10 ${pct(a.p10, b.p10)}% med ${pct(a.median, b.median)}%`,
  );
}

if (sink === -1) console.log("");
