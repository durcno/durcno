---
bump: patch
---

# fix(connectors/pglite): run migrations without transactions for pglite

PGlite does not support DDL statements inside transactions and requires sequential
execution. Previously, the `generate` command always emitted migration files with
`transaction: true`, which caused migrations to fail silently or error out when
using the PGlite connector.

`PgLiteConnector` now declares a static `migrationOptions` override on the base
`Connector` class:

```typescript
class PgLiteConnector extends Connector {
  ...
  static override migrationOptions = {
    transaction: false,
    execution: "sequential" as const,
  };
  ...
}
```

The `generate` command reads `connector.migrationOptions` and passes
those values through `generateMigration` / `generateNoOpMigration` so that the
emitted `options` export in `up.ts` and `down.ts` reflects the connector's
requirements automatically — no manual edits needed.