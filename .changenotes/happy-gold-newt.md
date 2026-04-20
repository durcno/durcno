---
bump: minor
---

# feat(migration): add sequential execution mode option

Adds an `execution` option to `MigrationOptions` that controls how migration statements are sent to the database.

By default (`"joined"`), all statements are concatenated into a single query. With `"sequential"`, each statement is sent individually — useful for migrations that include `CREATE INDEX CONCURRENTLY` or `DROP INDEX CONCURRENTLY`, which must be executed as standalone commands.

```typescript
export const options: MigrationOptions = {
  transaction: false, // Required for concurrent operations
  execution: "sequential", // Run each statement one at a time
};
```

The `execution` option is supported in both `migrate` (up) and `down` commands.