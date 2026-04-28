---
bump: minor
---

# impr(columns)!: map bigint and bigserial to JS bigint

The `bigint` and `bigserial` column types now map to JavaScript's native `bigint` instead of `number`.

PostgreSQL's 64-bit integer (`bigint`) can exceed `Number.MAX_SAFE_INTEGER` (2^53 - 1), making `number` an unsafe representation. Using `bigint` ensures full precision for all values.

**Breaking change for `bigint` and `bigserial` columns:** values read from the database and values passed in queries/filters must now use `bigint` literals (e.g. `1n` instead of `1`).

```typescript
// Before
await db.from(Users).select().where(eq(Users.id, 1));
// After
await db.from(Users).select().where(eq(Users.id, 1n));
```

The Zod validator for these columns has also been updated to use `z.coerce.bigint()`.