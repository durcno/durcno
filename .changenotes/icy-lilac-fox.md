---
bump: major
---

# fix(functions)!: nested aggregates in select no longer become GROUP BY keys

A `SELECT` whose projection contains a nested aggregate — an aggregate wrapped in another function, such as `round(avg(rating), 1)` — used to treat it as a scalar and put it in `GROUP BY`, producing `aggregate functions are not allowed in GROUP BY`. When every projection item is an aggregate, the query now emits no `GROUP BY` and returns one aggregate row.

```ts
// aggregates only: no GROUP BY, one row
await db.from(Reviews).select(() => ({
  totalCount: count("*"),
  averageRating: round(avg(Reviews.rating), 1),
}));

// a wrapped aggregate beside a plain column: group by the column alone
await db.from(Reviews).select(() => ({
  productId: Reviews.productId,
  averageRating: round(avg(Reviews.rating), 1),
}));
// GROUP BY "reviews"."product_id"
```

## Clause rules

- `GROUP BY`, `WHERE`/`ON`, `INSERT`/`SET` values and `FILTER (WHERE ...)` refuse an aggregate at any nesting depth, at compile time. `WHERE` now also rejects a bare `count("*")`.
- `HAVING`, `ORDER BY` and grouped `CASE WHEN` conditions accept one, wrapped or not.
- `ORDER BY` only applies when the query aggregates; otherwise PostgreSQL rejects the query itself.
- An aggregate in a `CASE WHEN` condition is part of the CASE, not a grouping key; columns read by a plain condition join the auto `GROUP BY`.

## Also fixed

- `caseWhen(...)` is accepted in `.set()`; the `coalesce(...)` workaround is unnecessary.
- `avg(round(sum(x), 2))` is invalid SQL and is now a compile error.
- `having(() => gt(round(avg(x), 1), 2))` and `orderBy(() => asc(round(avg(x), 1)))` now compile.
- `where(() => gt(round(avg(x), 1), 5))` no longer compiles — it was invalid SQL.

```ts
await db
  .from(Users)
  .select(() => ({ type: Users.type, avgScore: round(avg(Users.score), 1) }))
  .groupBy(() => Users.type)
  .having(() => gt(round(avg(Users.score), 1), 2))
  .orderBy(() => desc(round(avg(Users.score), 1)));
```

## Performance

Aggregate detection walks a function's operands once at construction. The binary constructors call it once per operand instead of allocating a pair — roughly 10–40% faster per call against the pair shape; `perf/sqlfn-operands.paths.ts` measures it.

## API

`SqlFn.isAggregate` is now `SqlFn.hasAggregate`, and `SqlFn.sqlFnType` exposes the function kind (`"aggregate"` or `"scalar"`).
