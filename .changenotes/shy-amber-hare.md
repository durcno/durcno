---
bump: patch
---

# fix(qb/type): fix type inference for scalar functions inside aggregate functions

Fix type inference when passing scalar functions or scalar arithmetic expressions inside aggregate functions like `sum()`, `avg()`, `min()`, `max()`, and `count()`.

```typescript
const [result] = await db.from(schema.Users).select({
  totalAbs: sum(abs(schema.Users.score)),
  avgAbs: avg(abs(schema.Users.score)),
});
```