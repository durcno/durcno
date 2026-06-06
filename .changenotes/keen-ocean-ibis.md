---
bump: minor
---

# feat(qb): add CTE support via db.with()

Adds first-class Common Table Expression (CTE) support through a new `db.with()` API with two overloads.

**Define a CTE** by name, binding it to a subquery:

```javascript
const activeCte = db
  .with("activeUsers")
  .as(
    db
      .from(Users)
      .select({ id: true, name: true })
      .where(eq(Users.active, true)),
  );
```

**Use CTEs** in SELECT, INSERT, UPDATE, and DELETE statements via `db.with(...ctes)`:

```javascript
const rows = await db
  .with(activeCte)
  .from((ctes) => ctes.activeUsers)
  .select();
```

Multiple CTEs can be declared together and referenced in any statement. CTE columns are fully type-inferred from the bound subquery.

Internally, this introduces a `VirtualTable` base class, a `Cte` class, a `WithStatement` builder, and shared query-builder helpers. A fix was also applied to `InCondition` to pass the parent query context when rendering subquery values in `IN (...)` expressions.