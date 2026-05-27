---
bump: minor
---

# feat(query-builder): support wildcard RETURNING \* syntax in update/delete

Added support for `RETURNING *` wildcard syntax in UPDATE and DELETE queries, allowing users to return all columns from modified rows without explicitly specifying each column.

## Key Changes

- **UpdateQuery**: Added overload for `returning("*")` method that returns all columns with full type safety
- **DeleteQuery**: Added overload for `returning("*")` method that returns all columns with full type safety
- **SQL Generation**: Proper handling of `RETURNING *` clause in generated SQL queries

## Usage Example

```typescript
// Return all columns from updated rows
const updated = await db
  .update(Users)
  .set({ email: "new@example.com" })
  .where(eq(Users.id, 1n))
  .returning("*");

// Return all columns from deleted rows
const deleted = await db.delete(Users).where(eq(Users.id, 1n)).returning("*");
```

Type inference correctly provides all table columns when using the wildcard.