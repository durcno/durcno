---
bump: minor
---

# feat(select): add groupBy and having clauses

`SelectQuery` now supports explicit `GROUP BY` and `HAVING` clauses via `.groupBy()` and `.having()` methods.

`.groupBy()` accepts a column, a scalar `SqlFn`, or an array of either. It also supports a callback form that lets you reference named aliases from your `.select({...})` map — useful when grouping by computed expressions.

`.having()` filters grouped results using aggregate expressions. Comparison filters (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`) were extended to accept aggregate `SqlFn` operands, enabling aggregate-to-literal and aggregate-to-aggregate comparisons.

```ts
// Direct form
const result = await db
  .from(Users)
  .select({ type: Users.type, total: count("*") })
  .groupBy(Users.type)
  .having(gte(count("*"), 5));

// Callback form — reference select aliases
const result2 = await db
  .from(Users)
  .select({ lname: lower(Users.username), total: count("*") })
  .groupBy(({ lname }) => [lname]);
```

Both methods are one-time — calling `.groupBy()` or `.having()` a second time is a compile-time error. Aggregate functions are rejected by the type system as `GROUP BY` operands (only scalar expressions and columns are valid).