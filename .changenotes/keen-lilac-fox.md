---
bump: patch
---

# fix(filters/array): use column toSQL methods with explicit type cast

Array filters (`arrayContains`, `arrayContainedBy`, `arrayOverlaps`, `arrayHas`, `arrayAll`) previously generated SQL using local helper functions (`arrayToSql`, `valueToSql`) that produced string literals without proper PostgreSQL type casts. This caused failures with enum array columns, where PostgreSQL requires an explicit cast (e.g., `::status_enum[]`) to resolve the type.

The fix delegates SQL generation to the column's own `toSQL` / `toSQLScalar` methods and appends an explicit cast using the column's `sqlType`:

```ts
// before
`${col.fullName} @> ARRAY['active']`
// after
`${col.fullName} @> ${col.toSQL(["active"])}::status_enum[]`;
```

The array integration tests were restructured into isolated per-type `describe` blocks with `returning({ id: true })` for row-level isolation.