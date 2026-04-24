---
bump: major
---

# change!: unify connector options into single-object defineConfig API

`defineConfig` now accepts a single configuration object with a required `connector` field, instead of taking the connector as a first argument and the config as a second.

`dbCredentials`, `logger`, and `pool` are no longer top-level fields of `Config`. They are now passed directly inside the connector factory call as `ConnectorOptions`.

```typescript
// Before
export default defineConfig(pg(), {
  schema: "db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL! },
  logger: createDurcnoLogger(),
});

// After
export default defineConfig({
  schema: "db/schema.ts",
  connector: pg({
    dbCredentials: { url: process.env.DATABASE_URL! },
    logger: createDurcnoLogger(),
  }),
});
```

The `DurcnoSetup<T>` type has been removed. Use `Config<T>` instead — it now carries the connector type generic directly.

`ConnectorOptions` is now exported as a public type for use in tests or shared config helpers.