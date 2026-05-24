---
bump: minor
---

# change(connectors): reduce default connection pool size from 10 to 5

The default maximum connection pool size (`DEFAULT_POOL_MAX`) has been lowered from `10` to `5`.

This change affects all connectors (`pg`, `postgres`, `pglite`, `bun`) when no explicit `pool.max` is configured. The previous default of 10 was unnecessarily high for most use cases and could exhaust database connection limits in environments with many application instances.

Users who need more than 5 concurrent connections should set `pool.max` explicitly:

```ts
connector: pg({
  dbCredentials: { url: process.env.DATABASE_URL! },
  pool: { max: 10 },
});
```