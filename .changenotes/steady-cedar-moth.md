---
bump: patch
---

# fix(qb): omit shared column names from select-all with joins

`select("*")` no longer returns field names declared by two or more tables in the join. Ambiguous names are removed from both the inferred result type and the converted rows. An explicit `.select(() => ({ ... }))` projection still reads any of those columns.

```typescript
const rows = await db
  .from(Users)
  .innerJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .select("*");
// `id` and `createdAt` are absent when both tables declare them
```
