---
bump: minor
---

# feat: support scalar subqueries as values

Single-column `SelectQuery` values can now be used directly wherever a scalar expression is accepted:

```typescript
const users = await db.from(Users).select(() => ({
  id: Users.id,
  postCount: db
    .from(Posts)
    .select(() => ({ total: count("*") }))
    .where(() => eq(Posts.userId, Users.id)),
}));

await db.update(Users).set({
  score: coalesce(
    db
      .from(Posts)
      .select(() => ({ total: count("*") }))
      .where(() => eq(Posts.userId, Users.id)),
    0,
  ),
});
```

The scalar result is typed `T | null`, because PostgreSQL returns `NULL` when the subquery has no row. Use `coalesce(...)` when assigning to a non-null column. A scalar query must select exactly one column; multi-column queries are rejected at compile time when the projection is statically known and throw when the query is built otherwise.

Direct queries work in projections, updates, inserts and conflict updates, comparisons, `coalesce`/`greatest`/`least`/`nullif`, `caseWhen`, arithmetic/math/string functions, JSON builders, and `asc`/`desc`. Prepared subqueries propagate their prepare flag, driver conversion follows the selected column, and subquery aggregates stay scoped to the subquery and out of the outer `GROUP BY`.

For scalar positions not covered directly, use `sql` with a parenthesized subquery and an explicit type parameter, e.g. `Sql<number>`.
