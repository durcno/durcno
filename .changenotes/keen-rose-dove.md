---
bump: patch
---

# fix: properly handle rq nested relation order by

Fixed orderBy clauses in nested relations (many-to-one queries) not properly resolving table aliases. The issue occurred when using orderBy within `options` of nested relation queries, where column references couldn't be correctly mapped to their table aliases.

Changes include:

- Updated `Order.toQuery()` and `OrderSqlFn.toQuery()` methods to accept optional `QueryContext` parameter for proper alias resolution
- Modified nested relation subquery building to pass table alias context through orderBy operations

Now orderBy works correctly in nested relation queries like:

```typescript
db.from(Users).relational({
  posts: {
    orderBy: [desc(Posts.createdAt)],
    limit: 5,
  },
});
```