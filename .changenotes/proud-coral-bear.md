---
bump: major
---

# change(cte)!: use CTE instances directly in .from()

Removes the `db.with(...).from((ctes) => ctes.name)` callback form. CTEs are now passed to `.from()` directly, exactly like normal tables, and their columns are referenced directly from the CTE variable.

```typescript
// Before
const rows = await db
  .with(activeUsers)
  .from((ctes) => ctes.activeUsers)
  .select("*")
  .orderBy(({ activeUsers }) => asc(activeUsers.username));

// After
const rows = await db
  .with(activeUsers)
  .from(activeUsers)
  .select("*")
  .orderBy(() => asc(activeUsers.username));
```

CTEs used in `.leftJoin()` are unaffected — left joined tables are still accessed through the callback view parameter, just like normal tables.