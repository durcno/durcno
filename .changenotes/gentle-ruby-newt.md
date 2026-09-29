---
bump: patch
---

# perf(rows): precompute the row-conversion plan of select and relational queries

Every result row was re-deriving what each of its values should be converted
with, even though the answer only depends on the query, not on the row. The
conversion is now resolved once per query and replayed for each row.

## What changed

`handleRows` is the last step of a query: it maps driver rows to the JS shapes
you get back. It used to do that work per value:

- an explicit `.select({...})` looked up the projection item again for every
  cell and re-ran the same `null` / column / `SqlFn` / literal type dispatch on
  it, walking the prototype chain each time the item was not a column;
- `select("*")` resolved `columnsBySql[key] ?? columns[key]` — plus a scan of
  the joined tables — for every cell of every row, from inside nested callbacks;
- relational queries allocated an `Object.keys` array per row (per nested child
  object too) and re-resolved the alias map, the table columns, and the
  relation map on every key.

All three now build a plan from the keys of the first row and loop over it:

```typescript
// before — per cell
const item = this.#$select[key];
if (item === null) { /* ... */ }
else if (isTCol(item)) row[key] = item.fromDriver(row[key]);
else if (item instanceof SqlFn) { /* ... */ }
else if (typeof item === "bigint") { /* ... */ }

// after — per key, once
const convert = buildSelectItemConverter(this.#$select[key]);
// then, per cell
row[key] = convert(row[key]);
```

Relational queries do the same per level of the relation tree, so the plan for
`users -> posts -> comments` is built once and reused by every parent row and
every nested child.

Two smaller wins on the same path: `Column` caches its array dimensions instead
of reading them back through the config on every conversion, and the converter
of a CTE/virtual column is resolved from its source expression once, at
construction, rather than re-dispatching on the source kind per value.

The five copies of the `SELECT *` row mapper (`select`, `insert`, `update`,
`delete`, `first`) are now one `mapStarRows` helper in
`src/query-builders/helpers.ts`, with `select` caching its plan across rows.

## Results

Measured with the new `pnpm bench` suite (`perf/`), which feeds
synthetic driver rows to `handleRows` so the numbers isolate conversion cost
from SQL generation and network time. Both variants ran interleaved in one
process, medians over 15 rounds:

| Benchmark                          | Before  | After   | Speedup |
| ---------------------------------- | ------- | ------- | ------- |
| `select("*")` — 10k rows × 12 col  | 13.1 ms | 7.8 ms  | 1.7×    |
| `select({...})` — 10k rows × 8 col | 2.2 ms  | 0.77 ms | 2.9×    |
| relational nested — 2k × 5 × 2     | 11.9 ms | 7.0 ms  | 1.7×    |

Results are unchanged. `tests/qb/rows.unit.test.ts` covers the conversion of
star, aliased, joined, and relational results, including NULL handling, the
`Column ... not found in any table` error, and reusing a query's plan across
executions.
