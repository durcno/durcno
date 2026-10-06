#!/usr/bin/env node
/**
 * Compares the loop forms `Sql.toSQL()` and `Sql.toQuery()` could use, all of
 * them inside one build and one process, alternating round by round so no
 * machine-load or thermal skew can favour one side. The question is genuinely
 * open rather than stylistic: an indexed `for`, `forEach`, a counter-carrying
 * `for...of` and `for...of` over `.entries()` all emit byte-identical SQL, and
 * the index is load-bearing because `strings` and `params` are walked in
 * lockstep.
 *
 * The renderers are hand-written because `#strings` and `#params` are private
 * and a subclass cannot read them. Everything but the loop is shared, so the
 * per-param dispatch cancels out of the comparison. They are `toSQL()`-shaped —
 * a local accumulator; `toQuery()` is the same loop with `query.sql` in place of
 * it, and `query-build.bench.ts` pins that absolute cost.
 *
 * Usage (from the repo root): `node perf/sql-loops.paths.ts [variant...]`
 * With no argument it runs all of them, in the order below. Reading the numbers:
 * AGENTS.md (Performance).
 */
import { concat, lower, Sql, sql } from "durcno";
import * as schema from "./schema.ts";

/** Whatever `Sql` accepts as an interpolation. */
type Param = NonNullable<ConstructorParameters<typeof Sql>[1]>[number];

/** A captured template: the `(strings, params)` pair `Sql` is constructed from. */
type Fixture = { strings: TemplateStringsArray; params: Param[] };

/** Captures a tagged template instead of building a `Sql` from it. */
function capture(strings: TemplateStringsArray, ...params: Param[]): Fixture {
  return { strings, params };
}

/**
 * Renders one parameter, the way `Sql.toSQL()` does: an identifier as itself, a
 * `SqlFn` or nested `Sql` through `toSQL()`, anything else as a literal.
 *
 * Duck-typed rather than a type cascade, and shared by every variant so the
 * dispatch is not what is measured. `isCol` is not exported, so a `fullName`
 * stands in for it — the dispatch costs every variant the same either way.
 */
function paramSql(param: Param): string {
  if (typeof param === "string") return `'${param}'`;
  if (typeof param === "number" || typeof param === "bigint") {
    return param.toString();
  }
  if (typeof param === "boolean") return param ? "TRUE" : "FALSE";
  if (param === null) return "NULL";
  if (typeof (param as { fullName?: unknown }).fullName === "string") {
    return (param as { fullName: string }).fullName;
  }
  return (param as { toSQL(): string }).toSQL();
}

// The common shape: one column, one literal.
const narrow = capture`${schema.Articles.title} = ${"draft"}`;

// Wide, and mixed on purpose — every branch of the dispatch is on the path.
const wide = capture`coalesce(${schema.Articles.title}, ${
  schema.Articles.slug
}) = ${"a-b-c"} AND ${schema.Articles.wordCount} > ${100} AND ${sql`lower(${
  schema.Articles.authorEmail
})`} IS NOT NULL AND ${lower(schema.Articles.authorName)} <> ${
  schema.Articles.language
} AND ${true} AND ${2024} AND ${1_000n}`;

// Nesting three deep, so the render re-enters itself.
const nested = capture`(${sql`coalesce(${sql`${schema.Articles.slug}::text`}, ${"none"})`}) IS NOT NULL AND ${concat(
  schema.Articles.title,
  schema.Articles.language,
)} <> ${""}`;

// ============================================================================
// Variants — identical bodies, four loop forms.
// ============================================================================

/** Indexed `for`, stepping both arrays. What `src/sql.ts` does today. */
function indexed(fixture: Fixture): string {
  const strings = fixture.strings;
  const params = fixture.params;
  let s = "";
  for (let i = 0; i < strings.length; i++) {
    s += strings[i];
    const param = params[i];
    if (param !== undefined) s += paramSql(param);
  }
  return s;
}

/** `forEach`, which allocates a closure over `s` on every call. */
function forEach(fixture: Fixture): string {
  const params = fixture.params;
  let s = "";
  fixture.strings.forEach((str, i) => {
    s += str;
    const param = params[i];
    if (param !== undefined) s += paramSql(param);
  });
  return s;
}

/** `for...of` over `strings`, with a counter to reach `params`. */
function forOf(fixture: Fixture): string {
  const params = fixture.params;
  let s = "";
  let i = 0;
  for (const str of fixture.strings) {
    s += str;
    const param = params[i++];
    if (param !== undefined) s += paramSql(param);
  }
  return s;
}

/** `for...of` over `strings.entries()`, destructuring the pair V8 already builds. */
function entries(fixture: Fixture): string {
  const params = fixture.params;
  let s = "";
  for (const [i, str] of fixture.strings.entries()) {
    s += str;
    const param = params[i];
    if (param !== undefined) s += paramSql(param);
  }
  return s;
}

const variants = { indexed, forEach, forOf, entries };

const FIXTURES: Record<string, Fixture> = { narrow, wide, nested };

// A variant that is not byte-identical to `Sql`'s own output would invalidate the
// whole comparison, so every one is checked against the real thing up front.
for (const [name, fixture] of Object.entries(FIXTURES)) {
  const expected = new Sql(fixture.strings, fixture.params).toSQL();
  for (const [variant, render] of Object.entries(variants)) {
    const actual = render(fixture);
    if (actual !== expected) {
      console.error(
        `${variant} on ${name} does not match Sql:\n  ${actual}\n  ${expected}`,
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

const names = process.argv.slice(2);
const selected = names.length === 0 ? Object.keys(variants) : names;
for (const name of selected) {
  if (!(name in variants)) {
    console.error(
      `unknown variant ${name}; try ${Object.keys(variants).join(" | ")}`,
    );
    process.exit(1);
  }
}

for (const [fixtureName, fixture] of Object.entries(FIXTURES)) {
  const renders = selected.map(
    (name) => variants[name as keyof typeof variants],
  );
  const samples: Record<string, number[]> = {};
  for (const name of selected) samples[name] = [];

  for (let i = 0; i < WARMUP; i++) {
    for (const render of renders) render(fixture);
  }

  for (let i = 0; i < SAMPLES; i++) {
    // Alternate inside the sample loop: drift hits every variant equally.
    for (let v = 0; v < renders.length; v++) {
      const t = process.hrtime.bigint();
      renders[v](fixture);
      samples[selected[v]].push(Number(process.hrtime.bigint() - t) / 1e6);
    }
  }

  console.log(
    `${fixtureName} (${fixture.params.length} params, ${fixture.strings.length} chunks)`,
  );
  for (const name of selected) {
    const s = stats(samples[name]);
    console.log(
      `  ${name.padEnd(8)} min=${s.min.toFixed(4)} p10=${s.p10.toFixed(4)} med=${s.median.toFixed(4)} µs`,
    );
  }
}
