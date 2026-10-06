#!/usr/bin/env node
/**
 * Regression guard for Phase 4's `X6`, a pooled render target in
 * `SqlFn.toSQL()` that measured **6–25% slower** than the per-call
 * `new Query("", () => [])` and was reverted. `shared` and `perCall` are
 * therefore the same code today: the script stays so the revert is checkable —
 * anyone who reintroduces a shared or pooled target sees `shared` diverge, and
 * the divergence is what pooling cost. **A flat result is the expected result.**
 *
 * Both sides run inside one build and one process, alternating round by round,
 * and `perCall` below is the shipped body verbatim, so the only difference
 * between them is the thing under test.
 *
 * Usage (from the repo root): `node perf/sqlfn-tosql.paths.ts [case...]`
 * With no argument it runs every case. Reading the numbers: AGENTS.md
 * (Performance).
 */
import {
  coalesce,
  concat,
  greatest,
  least,
  lower,
  Query as QueryClass,
  SqlFn,
} from "durcno";
import * as schema from "./schema.ts";

/** The only thing both sides need: render into a `Query`, and hand back a string. */
type Renderable = { toSQL(): string; toQuery(query: QueryClass): void };

/**
 * The shipped body, verbatim: a `Query` and a closure per call.
 *
 * Faithful rather than approximate — it is what `SqlFn.toSQL()` does today, so
 * the difference the measurement reports is exactly whatever `toSQL()` changed
 * and nothing else.
 */
function perCall(fn: Renderable): string {
  const query = new QueryClass("", () => []);
  fn.toQuery(query);
  return query.sql;
}

/** Whatever `SqlFn.toSQL()` currently does — the scratch, or this again, or worse. */
function shared(fn: Renderable): string {
  return fn.toSQL();
}

/**
 * A `SqlFn` that reaches `toSqlValue` for its operand, which is how a render
 * calls `toSQL()` on a nested expression — and therefore how `toSQL()` re-enters
 * itself while an outer render is still appending. This is the case a shared
 * render target has to survive, so it is the one to re-measure before shipping
 * any change to `toSQL()`.
 */
class WrappingFn extends SqlFn<never, false, "scalar", string, string> {
  /** An explicit field, not a parameter property — node strips types, it does not compile. */
  private readonly inner: Renderable;

  constructor(inner: Renderable) {
    super();
    this.inner = inner;
  }

  toQuery(query: QueryClass): void {
    query.sql += "wrap(";
    query.sql += this.inner.toSQL();
    query.sql += ")";
  }

  toDriverValue(value: string | null): unknown {
    return value;
  }

  toSQLValue(value: string | null): string {
    return String(value);
  }

  fromDriverValue(value: unknown): string | null {
    return value as string | null;
  }
}

const { Articles } = schema;

const cases: Record<string, Renderable> = {
  /** One operand — the smallest thing `toSQL()` is ever asked for. */
  scalar: lower(Articles.authorName),

  /** Many operands, so the per-call cost is amortised over more work. */
  wide: concat(
    Articles.title,
    Articles.slug,
    Articles.category,
    Articles.language,
    Articles.status,
    Articles.authorName,
  ),

  /** Nested: each operand is itself a `SqlFn`, so this is several renders deep. */
  nested: coalesce(
    lower(Articles.authorName),
    greatest(Articles.wordCount, Articles.viewCount),
    least(Articles.commentCount, Articles.likeCount),
  ),

  /** Re-entrant — the nesting a shared render target has to survive. */
  reentrant: new WrappingFn(new WrappingFn(lower(Articles.authorEmail))),
};

const names = process.argv.slice(2);
const selected = names.length === 0 ? Object.keys(cases) : names;

const variants = { shared, perCall };

// A side that renders different SQL is not a comparison of the same work.
for (const name of selected) {
  const fn = cases[name];
  if (fn === undefined) {
    console.error(
      `unknown case ${name}; try ${Object.keys(cases).join(" | ")}`,
    );
    process.exit(1);
  }
  const expected = perCall(fn);
  for (const [variant, render] of Object.entries(variants)) {
    const actual = render(fn);
    if (actual !== expected) {
      console.error(
        `${variant} on ${name} does not match the per-call body:\n  ${actual}\n  ${expected}`,
      );
      process.exit(1);
    }
  }
}

const WARMUP = 2_000;
const SAMPLES = 3_000;

function stats(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (q: number) =>
    sorted[Math.min(sorted.length - 1, (sorted.length * q) | 0)];
  return { min: sorted[0], p10: at(0.1), median: at(0.5) };
}

for (const name of selected) {
  const fn = cases[name];
  const samples: Record<string, number[]> = { shared: [], perCall: [] };

  for (let i = 0; i < WARMUP; i++) {
    for (const render of Object.values(variants)) render(fn);
  }

  for (let i = 0; i < SAMPLES; i++) {
    // Alternate inside the sample loop: drift hits both sides equally.
    for (const key of ["shared", "perCall"] as const) {
      const t = process.hrtime.bigint();
      variants[key](fn);
      samples[key].push(Number(process.hrtime.bigint() - t) / 1e6);
    }
  }

  const a = stats(samples.shared);
  const b = stats(samples.perCall);
  const pct = (x: number, y: number) => (((y - x) / x) * 100).toFixed(1);
  console.log(
    `${name.padEnd(9)} shared min=${a.min.toFixed(4)} p10=${a.p10.toFixed(4)} ` +
      `med=${a.median.toFixed(4)} | perCall min=${b.min.toFixed(4)} ` +
      `p10=${b.p10.toFixed(4)} med=${b.median.toFixed(4)} µs | ` +
      `min ${pct(a.min, b.min)}% p10 ${pct(a.p10, b.p10)}% med ${pct(a.median, b.median)}%`,
  );
}
