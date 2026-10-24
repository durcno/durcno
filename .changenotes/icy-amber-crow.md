---
bump: patch
---

# impr(connectors/pglite): upgrade to PGlite v0.5

The connector is now built and tested against `@electric-sql/pglite` v0.5.

PGlite v0.4+ runs initdb in a separate WASM module and changes the default database from `template1` to `postgres`; v0.5 moves to PostgreSQL 18 and ships extensions as separate packages. Data directories created by older PGlite versions cannot be opened by v0.5 and must be recreated or dumped and restored.

`connect()` waits for PGlite to finish initializing, so startup failures surface at connection time instead of on the first query.

PGlite migrations run sequentially inside a transaction, so a failing statement rolls the whole migration back:

```ts
export const options: MigrationOptions = {
  transaction: true,
  execution: "sequential",
};
```
