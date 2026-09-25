---
bump: patch
---

# fix(types): resolve cte contravariance and relation return type inference

Widen `AnyCteWithColumns` generic from `Record<any, any>` to `any`. This resolves function-parameter contravariance issues on `extra.indexes` when passing multiple CTEs to `db.with(cte1, cte2)`.

```ts
const q = db.with(cte1, cte2).from(cte1).select("*");
```

In relational queries (`db.query()`), update `RelationReturnType` to directly inspect the relation discriminant (`TRelation["t"] extends "Many"`) and remove the internal `AnyMany` type alias, ensuring consistent `O[]` array inference for one-to-many relations.
