---
bump: minor
---

# feat(query-builders): add prepare support to shortcut queries

The shortcut query methods `$count`, `$exists`, `$first`, `$sum`, `$avg`, `$min`, `$max`, and `$distinct` now support prepared statements via `db.prepare()`.

Each of these query classes (`CountQuery`, `ExistsQuery`, `FirstQuery`, `AggregateQuery`, `DistinctQuery`) gains a new `TPrepare extends boolean` generic parameter. When in prepare mode, the `WHERE` clause is built using `toQuery()` (which inlines `$N` parameter placeholders) instead of `toSQL()`.

The `Base` class threads `TPrepare` through `BuildFilterExpression` in the overload signatures, so `Arg<T>` values are accepted only when called via `db.prepare()` and are rejected by the type system otherwise.

```typescript
// Prepared shortcut query with a typed argument
const q = prequery({ userType: Users.type.arg() }, (args) =>
  db.prepare().$count(Users, eq(Users.type, args.userType)),
);
const count = await q.run(db, { userType: "admin" });

// Non-prepare usage — Arg<T> is rejected at compile time
// @ts-expect-error
db.$count(Users, eq(Users.type, Users.type.arg()));
```