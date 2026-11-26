---
bump: minor
---

# feat(qb): add cross join support

`SelectBuilder` now supports `.crossJoin(table)` for Cartesian products without an `ON` callback. It accepts tables and CTEs, keeps joined columns non-nullable, and composes with inner and left joins and the existing `SELECT` clauses.

```typescript
const rows = await db
  .from(Users)
  .crossJoin(Posts)
  .select(() => ({ username: Users.username, title: Posts.title }));
```
