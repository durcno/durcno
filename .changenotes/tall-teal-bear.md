---
bump: major
---

# change(types)!: narrow widened any slots to unknown

Driver rows, query handlers, subqueries and rejection values are now typed instead of widened to `any`. Runtime behavior is unchanged; strongly typed code that relied on `any` may need a cast.

A new `RawRow` type (`Record<string, unknown>`) names what every driver returns and is reused across the row pipeline:

```ts
type RawRow = Record<string, unknown>;

db.raw("SELECT id FROM users", [], (rows) => rows); // rows: RawRow[]
```

`RawRow[]` now flows through `$Client.getRows`, `$Pool.getRows`, `Query.rowsHandler`, `QueryPromise.handleRows` and `db.raw`'s handler. A handler that returns rows unchanged no longer needs an explicit generic or a cast:

```ts
// before
await db.raw<{ id: string; }[]>("SELECT id FROM users", [], (rows) => rows);
// after
await db.raw<{ id: string; }[]>("SELECT id FROM users");
```

`QueryPromise.catch` and `.then` now receive `unknown` for the rejection reason, matching `Promise`.

Subqueries reuse a single widened `SelectQuery` alias (`WidenedSelectQuery`) instead of inlining wildcard arguments at each use site. `SqlFn` and `AggregateSqlFn` default `TTsType` to `unknown`.

Two wildcard aliases no longer collapse to `any`: `AnyTableWithColumns` and `AnyCteWithColumns`. As a result `db.$.tables` excludes relation factories instead of carrying `never`-typed entries.
