---
bump: minor
---

# feat(qb): add .with() support for .query()

Add `.query()` support on `WithStatement` (`db.with().query(table)`), allowing Common Table Expressions (CTEs) to be declared and scoped to relational queries.

```typescript
const activeUsers = db.with("activeUsers").as(
  db
    .from(Users)
    .select(() => ({ id: Users.id }))
    .where(() => eq(Users.status, "active")),
);

const users = await db
  .with(activeUsers)
  .query(Users)
  .findMany({
    where: isIn(
      Users.id,
      db.from(activeUsers).select(() => ({ id: activeUsers.id })),
    ),
    with: {
      posts: {},
    },
  });

// Or evaluate CTE subqueries directly inside the select option using exists() / isIn():
const usersWithStatus = await db
  .with(activeUsers)
  .query(Users)
  .findMany({
    select: {
      id: Users.id,
      name: Users.name,
      isActive: exists(
        db
          .from(activeUsers)
          .select(() => ({ id: activeUsers.id }))
          .where(() => eq(activeUsers.id, Users.id)),
      ),
    },
  });
```
