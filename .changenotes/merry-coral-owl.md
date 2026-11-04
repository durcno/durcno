---
bump: minor
---

# feat: accept boolean literals as filter expressions

Boolean literals are now valid wherever a filter expression is expected and render as the PostgreSQL constants `TRUE` / `FALSE`. This works in `SELECT`, `UPDATE`, and `DELETE` `where` clauses, `having`, join `on`, upsert `DO UPDATE ... WHERE`, aggregate `filter`, `caseWhen`, relational `where`, query shortcuts, check constraints, and partial index predicates.

```ts
await db.from(Users).select("*").where(() => true);

const filter = and(
  input.status ? eq(Orders.status, input.status) : true,
);

count(Users.id).filter(false);
```

`and()` and `or()` treat booleans like any other condition while continuing to ignore `null` and `undefined` entries. Boolean conditions contribute no referenced columns, so they do not affect grouped-query inference.

Aggregate `.filter()` accepts a `Filter | boolean` union, so conditional predicates can be passed directly. `.filter(true)` and `.filter(false)` keep the aggregate's column scope unchanged, while `.filter(condition)` still widens it with the filter's referenced columns.
