---
bump: minor
---

# feat(sql): add lazy evaluation and support for prepared arguments in sql template

Refactored the `Sql` class to lazily evaluate template string fragments and parameters when `.toSQL()`, `.string`, or `.toQuery()` is called.

Added support for interpolating prepared query arguments (`Arg`) into `sql` tagged template expressions, allowing `Arg` placeholders to be used inside raw SQL fragments for prepared queries. Attempting to call `.toSQL()` directly on a `Sql` template containing an `Arg` outside of a query context will throw a descriptive error.

```typescript
const selectPre = prepare({ age: Arg.number() }, (args) =>
  db
    .prepare()
    .from(Users)
    .select()
    .where(sql`age = ${args.age}`),
);
```