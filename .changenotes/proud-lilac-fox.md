---
bump: patch
---

# perf(query): cut per-query promise allocations and redundant string work

Query building and per-query overhead are noticeably cheaper. Generated SQL is byte-identical in every case, and no public type changed.

## Fewer promises per awaited query

Awaiting a query allocated a second promise and added a microtask hop, because `QueryPromise.then` chained a trailing `.catch()` that ran even with no rejection handler:

```ts
return this.execute().then(onFulfilled).catch(onRejected);
```

It now passes both handlers to a single `.then(onFulfilled, onRejected)`, and returns `execute()`'s promise untouched when there is neither handler — which is exactly what `await query` compiles to. Two `async` pass-through layers in the connector base class (`execQuery`, `execStrArgs`) were also dropped; they only forwarded a promise.

## `.then()` no longer swallows errors from your own handler

The old `then(a).catch(b)` shape fed an error **thrown by `a`** into `b`. That is not `Promise.then` semantics, and it silently swallowed errors from mapping callbacks:

```ts
// before: the TypeError vanished, and onRejected saw it instead
await db.from(Users).select("*").then((rows) => rows.map(r => r.id));

// after: rejects with the TypeError
```

Both handlers now go to one `.then()`, so `onRejected` only ever sees a rejection from `execute()`. `.catch()` and `.finally()` are unchanged.

## Cheaper SQL generation

Measured against a revert of this change on the same machine (best of 3, `min`):

| Benchmark                  | Before  | After   |
| -------------------------- | ------- | ------- |
| `select(12 explicit cols)` | 3.5 µs  | 1.5 µs  |
| `select + 2 left joins`    | 7.8 µs  | 4.3 µs  |
| `insert 50 rows`           | 44.5 µs | 30.0 µs |

Gains scale with the number of columns rendered per query, which is where the wins came from:

- A column's `"table"."column"` identifier is cached instead of rebuilt on every reference. The cache is invalidated when a column is named or attached to a table, so cloned and left-join columns still resolve correctly.
- `camelToSnake` memoizes its result. It runs once per column per `clone()` / `cloneAsNullable()`, and the table constructor no longer computes the same name twice.
- `escIdentifier` / `escLiteral` skip the regex scan when the string contains no quote to escape.
- `database()` calls each relations factory once instead of three times. Besides the wasted rebuilds, three calls could disagree with each other — a factory with side effects could produce a map key from one `Relations` object and a value from another.

## Benchmarks

Two new no-database benchmarks make these paths measurable in future, alongside the existing `handleRows` benchmark:

- `perf/query-build.bench.ts` — construction cost (builder chain + `toQuery()`, never executed)
- `perf/query-overhead.bench.ts` — per-query promise overhead of `await`, against a stub pool

Note that per-query overhead is on the order of 1 µs, so it is invisible next to any real database round-trip. It is a fixed cost removed, not a throughput change.
