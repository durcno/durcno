---
bump: minor
---

# feat(qb): support aliased projections in returning

`.returning()` now accepts aliased projections on `INSERT`, `UPDATE`, and `DELETE`, mirroring `.select()` projections. Values can be columns of the affected table, non-aggregate scalar `SqlFn`s, or raw `Sql` expressions.

```ts
const [row] = await db
  .insertInto(Users)
  .values({ username: "jane_doe", type: "user" })
  .returning({
    userId: Users.id,
    name: Users.username,
    loweredName: lower(Users.username),
  });
// { userId: bigint; name: string; loweredName: string }
```

Alias keys are used in the returned rows and become the CTE column names when a DML query is wrapped with `db.with(...).as(...)`. Boolean `true`/`false` inclusion maps and `"*"` behave as before, and cannot be mixed with aliased expressions in the same object. Aggregate and window expressions are rejected, matching PostgreSQL. Aliased columns stay qualified against the target table in `UPDATE ... FROM`, so a same-named `FROM` column cannot make `RETURNING` ambiguous.
