---
bump: major
---

# change(filters)!: render null predicates as SQL NULL

JavaScript `null` is accepted anywhere a predicate is expected and renders as PostgreSQL `NULL`. Column comparisons also accept `null` and keep native SQL semantics, so `eq(column, null)` produces `column = NULL`; use `isNull(column)` to match null values.

`undefined` is no longer accepted as a condition, and `and()` / `or()` require at least one argument. Use `true` as the neutral condition for `and()` and `false` as the neutral condition for `or()`.

```typescript
await db
  .from(Users)
  .select("*")
  .where(() =>
    and(
      eq(Users.type, "admin"),
      status ? eq(Users.status, "active") : true,
    )
  );
```
