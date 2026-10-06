---
bump: patch
---

# perf(query): cut repeated per-render work across the query builders

Building a query asks the same question in several places, and the answer was being worked out again every time. Across `select`, `insert`, `update`, `delete` and relational queries the same SQL now costs 7–21% less to produce, and a query on left-joined tables costs up to 94% less. Generated SQL is byte-identical in every case, and no public type changed.

Three kinds of change, in descending order of what they were worth.

## Cached per table, per class

### One columns view per query, not one per chained method

A `LEFT JOIN` hands its clause callbacks a copy of the joined table's columns with `notNull` / `primaryKey` stripped, so `.where()`, `.orderBy()`, `.groupBy()` and `.having()` each needed that copy. The view was memoised per builder instance — but every chained method returns a **new** instance, so the copy was rebuilt from scratch on each one:

```ts
// 20 columns x 2 left-joined tables, for every method after the joins
db.from(Articles)
  .leftJoin(ArticleRevisions, ...)
  .leftJoin(ArticleRatings, ...)
  .select("*")
  .where(...)   // <- clones every joined column again
  .orderBy(...) // <- and again
  .groupBy(...) // <- and again
```

The view is now built once and carried into the derived builder. It only describes a builder when its `table` **and** `joins` are unchanged, so every method that forwards both hands its view along, and `innerJoin` / `leftJoin` — which change `joins` — pass none. `limit()` and `offset()` do not read the view at all, so they forward whatever their builder already had without building one.

The nullable copies are memoised per joined table in a `WeakMap` keyed on the table object, which covers the join methods too. Tables are per-schema singletons, so the cache is bounded and does not leak.

Cost per query is now flat in the number of methods chained after the joins: **−80%** for two left joins with nothing after them, **−94%** with five methods after them.

**One behavioural note:** a nullable column in the view is now the same object in every query that joins that table, rather than a fresh copy each time. The view is read-only by convention — it exists to be handed to `eq(...)`, `asc(...)` and friends — and durcno already passes the table's own live column records to callbacks, so this makes the existing contract uniform. A callback that mutated a view column would now be visible to later queries.

### The rest of the caches

- **`INSERT` no longer rebuilds its column list.** The `("id", "title", ...)` list and the field names are fixed by the table, yet both were rebuilt per query — one string and one array allocation per column, per insert. They are now resolved once per table in a `WeakMap`. Together with the streamed row loop: **−7%** on a 50-row insert that leaves five of nine columns out. A value function is still resolved **per row**, as before: `.$insertFn(() => crypto.randomUUID())` on a `unique` column has to produce a different value for each row of a batch, so it is not memoised across rows.
- **`UPDATE` no longer scans every column per query.** Reading the `hasUpdateFn` getter off each column is now done once per table and cached in a `WeakMap`: **−7%** on an update of a table carrying `$updateFn` columns.
- **A column's `sqlType` / `sqlCast` are built once** rather than rebuilding the array-dimension suffix on every read. They are read on every cast and every `toSQLExpression` of an array column.
- **`detectJsonKind` no longer lowercases the class name per operand.** The JSON kind of a `SqlFn` class is resolved once per class in a `WeakMap`: **−13%** on a projection of `json_build_object`, `jsonb_build_object` and `json_build_array`.
- **The auto-`GROUP BY` set is keyed on the column.** Columns are per-table singletons, so the object is a free identity key and the cached `fullName` string no longer has to be hashed per projection entry.

## Streamed, not assembled

Every variadic function used to build an array of fragments and join it, or allocate a closure per element to thread a comma through:

```ts
// before, per render
this.exprs.forEach((expr, i) => {
  appendOperand(query, expr, ctx, { leadOperand: this.exprs[0] });
  if (i < this.exprs.length - 1) query.sql += ", ";
});

// after
const exprs = this.exprs;
const options = { leadOperand: exprs[0] }; // once, not per operand
for (let i = 0; i < exprs.length; i++) {
  if (i !== 0) query.sql += ", ";
  appendOperand(query, exprs[i], ctx, options);
}
```

That ran in `concat`, `concat_ws`, `coalesce`, `greatest`, `least`, `json_build_object`, `jsonb_build_object`, `json_build_array`, `jsonb_build_array`, and an aggregate's `ORDER BY`. The `{ leadOperand }` object was additionally rebuilt for every operand of every `coalesce` / `greatest` / `least` call, although it is the same object each time.

The same treatment covers the array literal in `appendOperand`, the `ARRAY[...]` branches of a dimension column, `DISTINCT ON`, an `ON CONFLICT` target list, a `DO UPDATE SET` list, and the `json_build_object` argument list of every relation in a relational query — all appended straight to `query.sql`. The relational path was the worst offender: each level assembled an array of fragments, joined it, then embedded the result in a template literal.

`RETURNING` was the other one. Both `resolveReturningColumns` and `buildReturningClause` allocated three throwaway arrays (`Object.values`, `Object.keys`, `filter`, `map`, `join`) over a column list that is fixed per table. The clause is now streamed into the SQL, and the resolved column map is built in table-column order as before — which the `RETURNING` type inference depends on. A map that selects nothing still emits no clause.

`WITH` went further: it used to pick between `"), "` and `") "` by index, and now closes the previous CTE before opening the next and closes the last one after the loop.

Measured on their own paths: variadic functions **−10%**, array filters **−17%**, a `RETURNING` exclusion map **−8%**, `ON CONFLICT … DO UPDATE SET` plus `RETURNING *` **−8%**, a nested relational `findMany` with per-level `columns` **−21%**.

## Loop form, separators and hoisted invariants

Where items are comma-separated, the separator moved to the top of the loop body under an `i !== 0` guard, so no loop computes a last index any more:

```ts
// before: a hoisted last index that every loop had to get right
const lastIdx = items.length - 1;
for (let i = 0; i < items.length; i++) {
  render(items[i]);
  if (i < lastIdx) query.sql += ", ";
}

// after
for (let i = 0; i < items.length; i++) {
  if (i !== 0) query.sql += ", ";
  render(items[i]);
}
```

That is the projection list, `ORDER BY`, `GROUP BY` (explicit and auto-generated), `DISTINCT ON`, `IN (...)`, `ARRAY[...]` for both operands and dimension columns, `concat` / `concat_ws`, `coalesce` / `greatest` / `least`, the four `json_build_*` functions, an aggregate's `ORDER BY`, `ON CONFLICT` targets, the rows of a bulk `INSERT`, and `RETURNING`. Loops over an array now use `for...of` wherever the index is not load-bearing — two arrays stepped in lockstep, a `converts[i](...)` call, reverse iteration, and a bound that is not the array's own length keep it.

The reads that used to happen per iteration now happen once:

- **A projection iterates keys, not `Object.entries(select)`** — which built a `[key, value]` pair per projection entry per query.
- **`referencedColumns` is read once.** It is a rebuilding getter: it allocates a new array and recurses into nested expressions, and the auto-`GROUP BY` loop read it three times per projection entry.
- **`hasAggregate` breaks out of the loop** instead of running `entries.some(...)` over every entry.
- **The select-alias view is built with a loop** rather than `Object.fromEntries(Object.keys(...).map(...))`.
- **Emptiness is tested without `Object.keys(...)`** in the relational `select` / `columns` checks, and a record's first value is read without `Object.values(...)` in `to_json` / `toJsonb` and in the `referencedColumns` getters.
- **`Sql.toSQL()` and `Sql.toQuery()` index their template strings** rather than `forEach`-ing a closure: **−28%** on an 11-parameter template.

Combined on a 12-column projection with an aggregate, an auto-`GROUP BY` and an `orderBy` on a select alias: **−27%**.

## Measured

Median of five runs, from `perf/query-build.ab.ts` — which loads the old and new `dist` into **one process** and alternates them inside the sample loop, with the order inside each round flipped, so machine load, thermal drift and cache warmth cannot favour either side. Rebuilding and swapping `dist` between runs is too noisy on a shared machine to resolve differences of this size.

`min`, median of five runs of 200 alternating samples each:

| Case                                 | Before  | After   |          |
| ------------------------------------ | ------- | ------- | -------- |
| left joins + 5 chained methods       | 84.5 µs | 5.5 µs  | **−94%** |
| 2 left joins                         | 12.2 µs | 2.4 µs  | **−80%** |
| 12-col projection + auto `GROUP BY`  | 10.1 µs | 7.3 µs  | **−27%** |
| raw `sql` template, 11 params        | 3.7 µs  | 2.7 µs  | **−28%** |
| nested relational `findMany`         | 7.6 µs  | 6.1 µs  | **−21%** |
| array filters                        | 4.7 µs  | 3.9 µs  | **−17%** |
| `json_build_object` + `jsonb_...`    | 4.1 µs  | 3.6 µs  | **−13%** |
| variadic functions × 8               | 6.5 µs  | 5.8 µs  | **−10%** |
| aggregate `ORDER BY` × 2             | 3.2 µs  | 3.0 µs  | **−8%**  |
| `ON CONFLICT … DO UPDATE SET`        | 10.6 µs | 9.2 µs  | **−8%**  |
| 50-row `INSERT`, 5 columns omitted   | 49.5 µs | 45.8 µs | **−7%**  |
| `UPDATE` with `$updateFn` columns    | 3.5 µs  | 3.4 µs  | **−7%**  |
| `DELETE … RETURNING` (exclusion map) | 1.4 µs  | 1.3 µs  | **−8%**  |
| `IN (…)` with 6 values               | 2.2 µs  | 2.2 µs  | neutral  |
| `DISTINCT ON` (3 columns)            | 1.3 µs  | 1.3 µs  | neutral  |
| `WITH` — 3 CTEs                      | 24.8 µs | 25.7 µs | neutral  |
| `select("*")`, no join               | 1.1 µs  | 1.1 µs  | neutral  |

Three honest notes. The three flat cases each render a handful of items, and a case under about 2 µs has a ±5% noise floor on this machine: `WITH` even flips sign when the two snapshots are loaded in the opposite order, and it is dominated by `db.with()` / `.as()` rather than by the clause that changed. `DISTINCT ON` and `IN (…)` changed a loop and a separator, not a list — there was no list to remove.

**No claim for row conversion.** `helpers.ts`, `rq.ts` and `select.ts` also had their row-conversion loops swept, and `perf/handle-rows.ab.ts` over three runs puts all three paths inside ±3% of where they were. The loop form was applied as a rule, and nothing is claimed for it.
