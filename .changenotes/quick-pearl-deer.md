---
bump: major
---

# change(qb)!: adopt callback-based column views in select queries

Refactors `SelectBuilder` and `SelectQuery` to adopt a unified, callback-based columns-view pattern across query clauses: `.where()`, `.select()`, `.orderBy()`, `.groupBy()`, `.having()`, `.distinctOn()`, `.innerJoin()`, and `.leftJoin()`.

Instead of passing top-level column references from table objects (e.g. `Users.id`), clauses now receive a scoped columns view keyed by table name (e.g. `({ users, posts }) => ...`). This eliminates ambiguous column references in multi-table queries and aligns syntax across all clauses.

Columns from left-joined tables are now automatically projected as nullable types in the callback view, with runtime support via `cloneAsNullable()` on column instances.

Output column aliases in `.groupBy()` and `.orderBy()` are now accessed via a second callback parameter (`selects`), replacing the previous `GroupByAlias` wrapper class with direct alias references.

```typescript
// Querying with scoped column views
const result = await db
  .from(Users)
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    userId: users.id,
    postTitle: posts.title, // typed as string | null
  }))
  .where(({ users }) => eq(users.isActive, true))
  .groupBy(({ users }, { userId }) => [userId])
  .orderBy(({ users }) => asc(users.createdAt));
```
