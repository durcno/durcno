---
bump: patch
---

# fix(functions): cast Date results in caseWhen

`caseWhen(...)` rendered a `Date` branch as a bare string literal when no branch referenced a column. A CASE made only of Date branches was therefore resolved by PostgreSQL as `text`: comparisons and inserts into timestamp columns failed, and `SELECT` only worked because the value was converted back to a `Date` after reading it.

Date-only CASE results now render each branch as `'<ISO>'::timestamptz`, so the expression keeps a timestamp type. A CASE that also has a column, function, or other value operand is unchanged, since that operand already determines the type.

```ts
const at = new Date("2025-01-01T00:00:00.000Z");
const fallback = new Date("2020-01-01T00:00:00.000Z");

// CASE WHEN ... THEN '...'::timestamptz ELSE '...'::timestamptz END
await db.from(Users).select(() => ({
  at: caseWhen(eq(Users.id, id), at).else(fallback),
}));
```
