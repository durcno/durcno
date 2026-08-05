---
bump: patch
---

# fix(qb): fix SqlFn TPrepare generic type constraint in query builders

Refine the `TPrepare` type argument passed to `SqlFn` in `GroupByExpression`, `OrderExpression`, `SelectBuilder`, and `SelectQuery` to `TPrepare extends true ? boolean : false`.

This resolves TypeScript inference and constraint mismatches when using SQL functions in select, `groupBy`, and `orderBy` clauses.