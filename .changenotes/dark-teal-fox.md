---
bump: minor
---

# feat(select): add window function support (OVER, PARTITION BY, frame)

Every aggregate now accepts `.over(spec)`, turning it into a window function
call, and a full set of pure window functions shipped: `rowNumber`, `rank`,
`denseRank`, `percentRank`, `cumeDist`, `ntile`, `lag`, `lead`, `firstValue`,
`lastValue`, `nthValue`.

```typescript
const orders = await db.from(Orders).select(() => ({
  id: Orders.id,
  grandTotal: sum(Orders.amount).over(),
  cartTotal: sum(Orders.amount).over({ partitionBy: [Orders.userId] }),
  position: rowNumber().over({
    partitionBy: [Orders.userId],
    orderBy: [asc(Orders.createdAt)],
    frame: rows(unboundedPreceding()),
  }),
}));
```

- The spec object carries `partitionBy` (columns, non-aggregate functions or
  raw SQL), `orderBy` (`asc()`/`desc()` items) and a `frame` built by
  `rows()`/`range()`/`groups()`, with `unboundedPreceding()`, `preceding(n)`,
  `currentRow()`, `following(n)`, `unboundedFollowing()` endpoints and an
  optional `EXCLUDE` kind.
- The result is a `WindowedSqlFn` that renders
  `fn(...) [FILTER (WHERE ...)] OVER (spec)` and delegates value conversion to
  the wrapped function, so defaults and deserialization keep their column
  types (`coalesce(sum(x).over(), 0)`, `lag(timestamptz)` → `Date | null`).
- `FILTER` before `OVER` is allowed, as in PostgreSQL; an aggregate with an
  inline `.orderBy()` combined with `.over()` throws at build time, mirroring
  PostgreSQL's "not implemented" error.
- `SqlFnType` gained `"window"`. Windowed expressions are refused exactly
  where aggregates are (`WHERE`, `ON`, `GROUP BY`, insert/set values); at
  runtime a window function never triggers grouping — the auto-`GROUP BY`
  scan now skips windowed items in mixed projections via a mirrored
  `hasWindow` flag threaded through all operand-walking functions.
