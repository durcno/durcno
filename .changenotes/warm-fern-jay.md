---
bump: minor
---

# feat: support exists and subquery functions

Adds `exists` and `notExists` subquery functions implementing PostgreSQL's `EXISTS (...)` and `NOT EXISTS (...)` expressions. They accept `SelectQuery` instances, virtual subqueries, or raw `Sql` expressions, supporting both independent and correlated subqueries with outer scope column references.

Unifies subquery expressions under `src/functions/subquery.ts`: `isIn` and `notIn` now extend `SubquerySqlFn`, allowing them to be projected directly in `.select()` as typed boolean fields in addition to their use in `.where()`, `.having()`, and `caseWhen()` conditional expressions.

Expands `notIn` to support subquery results alongside literal arrays. Both `isIn` and `notIn` handle empty literal arrays safely at runtime, generating `FALSE` and `TRUE` respectively.

Adds full type-safe parameter tracking (`Arg`) for prepared queries across all subquery functions, preventing unprepared queries from executing with unresolved arguments while propagating argument types in prepared statements.

Subquery function projections in `.select()` are automatically identified as non-aggregate SQL functions, preventing erroneous automatic `GROUP BY` clause generation when combined with aggregate expressions.

```typescript
import { eq, exists, isIn, notExists, notIn } from "durcno";

// Project subquery results as boolean columns in .select()
const userProfiles = await db.from(Users).select(({ users }) => ({
  id: users.id,
  hasPosts: exists(
    db
      .from(Posts)
      .select("*")
      .where(({ posts }) => eq(posts.userId, users.id)),
  ),
  isAdmin: isIn(users.type, ["admin", "superadmin"]),
}));

// Filter using correlated EXISTS subquery
const authors = await db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    exists(
      db
        .from(Posts)
        .select("*")
        .where(({ posts }) => eq(posts.userId, users.id)),
    )
  );

// Filter using NOT IN subquery
const usersWithoutOrders = await db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    notIn(
      users.id,
      db.from(Orders).select(({ orders }) => ({ userId: orders.userId })),
    )
  );
```
