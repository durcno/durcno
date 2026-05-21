---
bump: minor
---

# feat(query-builder): support bigint and Arg for limit/offset

`limit` and `offset` in both `db.from` and `db.query` now accept `bigint` in addition to `number`.

For prepared queries, `limit` and `offset` can be parameterized using the new `Arg.number()` and `Arg.bigint()` static factory methods on `Arg`. This enables paginated prepared statements where the page size and offset vary at runtime.

```typescript
const paginatedUsers = prequery(
  { lim: Arg.number(), off: Arg.number() },
  (args) => db.prepare().from(Users).select().limit(args.lim).offset(args.off),
);
const page1 = await paginatedUsers.run(db, { lim: 10, off: 0 });
const page2 = await paginatedUsers.run(db, { lim: 10, off: 10 });
```

`offset` is also now supported inside nested `many` relation options in `RelationQueryBuilder`, matching the existing `where`, `orderBy`, and `limit` support.