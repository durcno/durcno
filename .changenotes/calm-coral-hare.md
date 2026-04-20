---
bump: major
---

# change(connectors)!: introduce connector factory functions

Each connector now exposes a factory function (`pg()`, `postgres()`, `bun()`, `pglite()`) instead of a bare class. `defineConfig` now accepts a connector **instance** rather than a constructor.

```typescript
// Before
import { PgConnector } from "durcno/connectors/pg";
export default defineConfig(PgConnector, { ... });

// After
import { pg } from "durcno/connectors/pg";
export default defineConfig(pg(), { ... });
```

`PgLiteConnector` / `pglite()` now accepts an optional `PGliteOptions` argument (e.g. for extensions), which is forwarded to the underlying `PGlite` client and pool instances.