---
bump: minor
---

# impr(qb): refer non-left-join columns from table directly

Columns from non-left-joined tables can now be referenced directly from the original table objects, without destructuring them from the callback view.

The callback parameter is now only needed for left-joined tables, where the view projects columns as nullable types. All other clauses (`.select()`, `.where()`, `.orderBy()`, `.groupBy()`, `.having()`, `.distinctOn()`, joins, and subqueries) accept parameter-less callbacks that close over table definitions.

Updates JSDoc examples, type tests, integration tests, and website docs to use the direct-reference style.

```typescript
// Before: destructured callback view
const admins = await db
  .from(Users)
  .select(({ users }) => ({ id: users.id }))
  .where(({ users }) => eq(users.type, "admin"));

// After: direct table references
const admins = await db
  .from(Users)
  .select(() => ({ id: Users.id }))
  .where(() => eq(Users.type, "admin"));

// Left joins still use the callback view for nullable inference
const rows = await db
  .from(Posts)
  .leftJoin(Users, () => eq(Users.id, Posts.userId))
  .select(({ users }) => ({
    title: Posts.title,
    author: users.username, // typed as string | null
  }));
```
