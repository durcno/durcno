---
bump: minor
---

# impr(functions): improve aggregate return type inference

`sum`, `avg`, `min`, and `max` aggregate functions now infer their return type
from the wrapped column's TypeScript type instead of returning a hardcoded
`number | null` or `string | null`.

```typescript
// Before
const result = await db.from(Orders).select({ total: sum(Orders.amount) });
// total: number | null  ← always number, even for bigint columns

// After
const result = await db.from(Orders).select({ total: sum(Orders.amount) });
// total: bigint | null  ← matches the column's actual TypeScript type
```

The `SqlFn` base class was also refactored: the `TReturn` type parameter was
moved to the last position and renamed `TTsType`, and a `bigint` pass-through
was added to `fromDriver` to preserve precision.

The `SqlFnFor` utility type has been removed in favour of direct `SqlFn` usage.