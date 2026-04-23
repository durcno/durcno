---
bump: minor
---

# impr(columns)!: add sqlCastScalar for prepared statement type casting

Introduces a new abstract `sqlCastScalar` getter on the `Column` base class. Each column type returns either a PostgreSQL type string (e.g. `"uuid"`, `"boolean"`, `"jsonb"`) or `null` when PostgreSQL can infer the type without an explicit cast (e.g. `integer`, `varchar`, `text`).

A derived `sqlCast` getter on `Column` composes `sqlCastScalar` with array dimension suffixes automatically, matching the existing `sqlType` pattern.

`toSQL()` and the internal `#toSQLArray()` now accept an optional `{ cast?: boolean }` option. When `cast: true` is passed the generated SQL literal is suffixed with `::type`, ensuring cases where PostgreSQL cannot infer the type are handled correctly.

`Arg` (used by prepared statements) now stores the `sqlCast` from the column that produced it. `Query.addArg()` appends `::type` automatically, and a new `Query.pushArg()` helper is provided for ad-hoc use.

`InsertReturningQuery` now delegates to `InsertQuery.toQuery()` instead of duplicating the SQL-building logic, eliminating a class of divergence bugs.

`UpdateQuery`'s SET clause is simplified: both prepare and non-prepare modes now use `toSQL(..., { cast: true })` inline, removing the branching that previously forced literal SQL in prepare mode.

All built-in column types now implement `sqlCastScalar`.

Custom column authors must add `sqlCastScalar` to any `Column` subclass:

```typescript
get sqlCastScalar(): string | null {
  return "citext"; // return null if PostgreSQL can infer the type
}
```