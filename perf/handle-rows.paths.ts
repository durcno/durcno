#!/usr/bin/env node
/**
 * Compares the two `SELECT *` row-conversion paths against each other.
 *
 * `handle-rows.bench.ts` is the regression guard, but throughput on a shared
 * machine varies by up to ~2x run to run, so a single vitest run cannot settle
 * a question like "is the in-place path actually faster?". This script exists
 * for that. It measures both paths **inside one build and one process**, feeds
 * them identical fresh driver-shaped rows, and builds fixtures outside the
 * timed region so only the conversion is counted.
 *
 * Fresh fixtures are not optional. The allocating path never mutates the rows
 * it is handed; the in-place path converts them in place. Reuse one fixture
 * and the in-place side times `BigInt(1n)` where the allocating side times
 * `BigInt("1")`, which flatters the in-place path enormously.
 *
 * For comparing two *builds* rather than two paths, use `handle-rows.ab.ts`.
 *
 * Usage (from the repo root): `node perf/handle-rows.paths.ts [inplace|alloc]`
 * With no argument it runs both, in that order.
 *
 * Run it on an otherwise idle machine — check `uptime` first — and repeat
 * the pair at least three times before believing a difference. Read `min`.
 */
import {
  bigint,
  boolean,
  database,
  defineConfig,
  numeric,
  table,
  varchar,
} from "durcno";
import { pg } from "durcno/connectors/pg";

/** A driver-shaped row: snake_case keys, driver-native value types. */
type Row = Record<string, unknown>;

/**
 * Every column is a single lowercase word, so each driver key already equals
 * its output key and `SELECT *` takes the in-place conversion path.
 */
const Tokens = table("public", "tokens", {
  id: bigint({}),
  name: varchar({ length: 50 }),
  kind: varchar({ length: 20 }),
  price: numeric({}),
  enabled: boolean({}),
});

/** The same shape with one snake_case column, forcing the allocating path. */
const Items = table("public", "items", {
  id: bigint({}),
  itemName: varchar({ length: 50 }),
  kind: varchar({ length: 20 }),
  price: numeric({}),
  enabled: boolean({}),
});

const db = database(
  { Tokens, Items },
  defineConfig({
    schema: "./schema.ts",
    // Never connected to: the pool is lazy and no query is ever issued.
    connector: pg({
      dbCredentials: { url: "postgres://bench:bench@127.0.0.1:5432/bench" },
    }),
  }),
);

const ROWS = Number(process.env.ROWS ?? 10_000);
const POOL = 32;
const WARMUP = 60;
const SAMPLES = 200;

function driverRows(): Row[] {
  return Array.from({ length: ROWS }, (_, i) => ({
    id: String(i),
    name: `token_${i}`,
    kind: i % 2 === 0 ? "a" : "b",
    price: `${i}.50`,
    enabled: i % 3 === 0,
  }));
}

/** Reshapes a fixture to the keys the allocating path sees. */
function allocatingRows(rows: Row[]): Row[] {
  return rows.map((r) => ({
    id: r.id,
    item_name: r.name,
    kind: r.kind,
    price: r.price,
    enabled: r.enabled,
  }));
}

let pool: Row[][] = Array.from({ length: POOL }, driverRows);
let at = 0;

function refill(): void {
  pool = Array.from({ length: POOL }, driverRows);
  at = 0;
}

/** Warms up, then times conversion only — fixtures are built first. */
function measure(variant: string): number[] {
  const convert =
    variant === "inplace"
      ? (rows: Row[]) => db.from(Tokens).select("*").handleRows(rows)
      : (rows: Row[]) =>
          db.from(Items).select("*").handleRows(allocatingRows(rows));

  for (let i = 0; i < WARMUP; i++) {
    if (at === POOL) refill();
    convert(pool[at++]);
  }

  const samples: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    if (at === POOL) refill();
    const rows = pool[at++];
    const started = process.hrtime.bigint();
    convert(rows);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }
  samples.sort((a, b) => a - b);
  return samples;
}

const variants = process.argv.slice(2);
if (variants.length === 0) variants.push("inplace", "alloc");

for (const variant of variants) {
  const samples = measure(variant);
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const p10 = samples[(samples.length / 10) | 0];
  console.log(
    `${variant}\tmin=${samples[0].toFixed(3)}\tp10=${p10.toFixed(3)}` +
      `\tmean=${mean.toFixed(3)}\t(n=${samples.length}, rows=${ROWS})`,
  );
}
