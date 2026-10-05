---
bump: patch
---

# perf(select): resolve row converters once per result set

Converting driver rows to JS objects is the single hottest path in Durcno, and it now does a fraction of the per-cell work. Values are unchanged, and no public type or generated SQL changed.

## One converter per column, not a lookup per cell

`Column.fromDriver` re-checks `null` and the array dimensions on every value and then makes a second, polymorphic call to `fromDriverScalar`. With a dozen different `Column` subclasses in one result set, both call sites are megamorphic — and that dispatch was repeated for every single cell.

The conversion plan now resolves the converter once, when the plan is built from the first row, and stores one closure per column. A new shared `resolveFromDriver` returns the cheapest correct converter for a column, so `select("*")`, explicit projections, and relational queries cannot drift apart:

```ts
// one closure per column, built once per result set
((row, out) => {
  out[outKey] = fromDriver(row[key]);
});
```

`resolveFromDriver` keeps the full `fromDriver` for array-dimension columns (`varchar({ dimension: array() })` and friends), whose values still need array parsing. No `Column` subclass overrides `fromDriver`, so the scalar branch is equivalent for every other column.

The explicit-projection path is the one exception: it keeps calling `fromDriver` directly, because its converter array interleaves per-column closures with shared module-level converters, and drawing them all from one shared literal pushed that call site further into polymorphism — measurably ~20% _slower_ than the status quo.

On the relational path the redundant `plan.keys` array is gone as well: each closure already closed over its own key, so the loop was loading the same key twice per cell.

## `SELECT *` converts in place when no key has to be renamed

When every driver key already equals its camelCase output key — true for any all-lowercase, single-word column — the driver row already has the right keys. Those rows are now converted in place and handed straight back, instead of allocating a copy of every row:

```ts
// id, name, kind, price, enabled — all already their output keys
const rows = db.from(Tokens).select("*"); // -> the driver's own row objects
```

**This is the one intentional behaviour change here.** When at least one key needs renaming (`user_name` → `userName`), a fresh array of fresh objects is returned exactly as before and the input rows are left untouched.

Two consequences for **custom connectors**:

- Returned rows may be the driver's own row objects. The built-in connectors construct rows fresh per query and never retain them, so this is contained there; a connector that reuses row objects — a row cache, a streaming cursor — must return fresh ones from `getRows()`.
- The conversion plan is built from the first row's keys. On the in-place path a later row carrying a key the first row did not have keeps that value **unconverted**, where the allocating path dropped it. No built-in connector produces heterogeneous row keys.

## Measured

Median of three runs, `min`, from `perf/handle-rows.ab.ts` — which loads the old and new `dist` into **one process** and alternates them inside the sample loop, so machine load and thermal drift cannot favour either side. Cross-process A/B (rebuilding and swapping `dist` between runs) proved too noisy on a shared machine to resolve differences of this size; it initially hid a real 20% regression in the opposite direction, and initially reported the in-place path as noise when it is a consistent win.

| Benchmark                         | Before  | After   |          |
| --------------------------------- | ------- | ------- | -------- |
| `select("*")` — 10000 rows x 12   | 6.96 ms | 4.71 ms | **−32%** |
| relational nested — 2000 x 5 x 2  | 6.33 ms | 4.24 ms | **−33%** |
| `select({...})` mixed — 10000 x 8 | 0.69 ms | 0.66 ms | neutral  |

The `select("*")` benchmark uses a snake_case fixture, so it only exercises the allocating path.

The in-place path is measured separately by `perf/handle-rows.paths.ts`, which cannot be compared across builds — the allocating path never mutates its input while the in-place path does, so a shared fixture would time `BigInt(1n)` against `BigInt("1")`. Fed identical fresh driver rows, the in-place path wins **6 runs out of 6** on both `min` and `p10`, by ~20% and ~12% respectively. That is a real but modest win, and it is the only part of this change with an observable behavior difference.

Both harnesses ship alongside the benchmarks in `perf/` as development tools — they are not part of `pnpm bench` and are not picked up by `vitest bench`. `perf/handle-rows.bench.ts` also gains a case for the in-place path, which builds its rows per iteration because that path consumes them.
