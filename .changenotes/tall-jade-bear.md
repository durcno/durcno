---
bump: minor
---

# feat(rq): support alias-based selection in relational queries

Adds alias-based selection via the `select` option in relational queries (`findMany` and `findFirst`), mirroring projection behavior in `.select()`. Keys define output aliases, while values are table columns or scalar `SqlFn` expressions.

The `select` option can be used at the top level and within nested relations in `with`. `select` and `columns` are mutually exclusive at every level, enforced at compile time through overloaded signatures and discriminated option types, with runtime validation safeguards.

Driver value deserialization (`fromDriver` and `fromDriverValue`) is preserved across aliased projections, using precomputed conversion contexts to avoid per-row allocations. Expressions are validated to ensure columns belong to the queried table, aggregate SQL functions are rejected, and aliases do not collide with sibling relation keys in `with`.

```typescript
import { lower } from "durcno";

// Top-level alias selection with columns and scalar SqlFns
const users = await db.query(Users).findMany({
  select: {
    userId: Users.id,
    name: Users.username,
    loweredName: lower(Users.username),
  },
  with: {
    posts: {
      select: {
        postId: Posts.id,
        heading: Posts.title,
      },
    },
  },
});
```