---
bump: minor
---

# feat(logger): add query logging support

Introduces a `logger` option to `Config` that enables per-query logging across all connectors and query builders.

A new `DurcnoLogger` interface is exported from `durcno`. Any object with a compatible `info(message, meta?)` method satisfies it, making the logger adapter-agnostic (Winston, Pino, custom objects, etc.).

A ready-to-use Winston logger is available via `durcno/logger`:

```ts
import { createDurcnoLogger } from "durcno/logger";

export default defineConfig(pg(), {
  schema: "db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL! },
  logger: createDurcnoLogger(),
});
```

The built-in logger renders each query in a box-drawing style with the SQL and bound arguments printed inline:

```
2026-04-24T10:00:00.000Z [durcno] INFO: Query
  ┌ SQL
  │ SELECT "id", "name" FROM "public"."users" WHERE "id" = $1
  ├ Arguments
  │ $1 = 42
  └
```

Internally, all query builders now call `execQuery()` on the executor (`$Client` / `$Pool`) instead of `query()` directly. `execQuery()` logs the query before forwarding it to the underlying driver, and is a no-op when no logger is configured.