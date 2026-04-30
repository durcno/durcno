---
bump: minor
---

# feat(rq): support where, orderBy, and limit on nested many relations

Nested `many` (one-to-many) relations inside `with` now accept `where`, `orderBy`, and `limit` options. These are applied as additional SQL clauses within the relation subquery, making it possible to filter, sort, and cap related rows directly in the relational query.

```typescript
const posts = await db.query(Posts).findMany({
  with: {
    comments: {
      where: eq(Comments.isEdited, true),
      orderBy: desc(Comments.createdAt),
      limit: 5,
    },
  },
});
```

At the type level, `where`, `orderBy`, and `limit` are **disallowed** on nested `fk` (many-to-one) and `one` (one-to-one) relations — the TypeScript compiler will reject such usage with a clear error. The join condition for those relation types already uniquely identifies the related row, so further filtering is not meaningful.