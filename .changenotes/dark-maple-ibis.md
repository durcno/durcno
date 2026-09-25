---
bump: minor
---

# feat: add json functions, case expressions, and aggregate filters

Introduces PostgreSQL JSON and JSONB function builders for constructing nested JSON structures directly in SQL queries:

- `jsonBuildObject` and `jsonbBuildObject` build key-value objects from columns, scalar expressions, or literals with compile-time object typing and runtime JSON deserialization.
- `jsonBuildArray` and `jsonbBuildArray` assemble structured JSON arrays from heterogeneous or homogeneous elements.
- `jsonAgg` and `jsonbAgg` aggregate rows into JSON arrays, supporting `.orderBy(...)`, `.filter(...)`, and `.distinct()`.
- `toJson` and `toJsonb` convert scalar values or entire table row views (e.g. `toJson(users)`) into JSON representations.
- `jsonStripNulls` and `jsonbStripNulls` strip null object fields from JSON structures.

Refactors aggregate functions (`count`, `countDistinct`, `countStar`, `sum`, `avg`, `min`, `max`, `jsonAgg`, `jsonbAgg`) onto an `AggregateSqlFn` base class, adding support for PostgreSQL `FILTER (WHERE ...)` clauses via `.filter()` and element ordering via `.orderBy()`.

Adds `caseWhen(condition, then)` builder for type-safe conditional `CASE` expressions. Supports chaining multiple `.when(...)` branches, `.else(...)`, and `.end()`, with full TypeScript union inference across all branch results. Direct selection without `.end()` or `.else()` evaluates with an implicit `null` fallback.

Enhances `coalesce` and function operand serialization to support plain object literals, arrays, `Date`, and `BigInt` with automatic JSON/JSONB type detection. Also detects nested aggregates inside `coalesce` and extracts referenced columns from scalar SQL functions during automatic `GROUP BY` clause generation.

```typescript
// Querying nested relations with jsonBuildObject and jsonAgg
const postsWithComments = await db
  .from(Posts)
  .leftJoin(Comments, ({ posts, comments }) => eq(comments.postId, posts.id))
  .select(({ posts, comments }) => ({
    id: posts.id,
    title: posts.title,
    comments: coalesce(
      jsonAgg(
        jsonBuildObject({
          id: comments.id,
          body: comments.body,
        }),
      )
        .orderBy(asc(comments.id))
        .filter(isNotNull(comments.id)),
      [],
    ),
  }))
  .groupBy(({ posts }) => [posts.id]);

// Conditional classification with caseWhen
const users = await db.from(Users).select(({ users }) => ({
  username: users.username,
  roleBadge: caseWhen(eq(users.type, "admin"), "Administrator")
    .when(eq(users.type, "moderator"), "Moderator")
    .else("Member"),
}));
```
