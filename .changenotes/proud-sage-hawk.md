---
bump: patch
---

# fix(db): release the pooled connection when a transaction ROLLBACK fails

Fix a resource leak in `db.transaction()` that permanently exhausted the connection pool after repeated failures.

Every transaction acquires a dedicated client from the pool. When the transaction body threw, the error path rolled back and released that client — but if the `ROLLBACK` itself failed, which it does on an aborted or already-dead connection, `client.close()` was never reached and the pool slot was lost. After `pool.max` such failures (5 by default) every subsequent query waited forever for a connection that would never come back.

The client is now released from a `finally` block, so it is returned to the pool exactly once on every path, and a failing `ROLLBACK` is reported through the configured logger instead of replacing the error that caused the transaction to fail:

```ts
try {
  await db.transaction(async (tx) => {
    await tx.insertInto(Users).values({ name: "John Doe" });
    throw new Error("Intentional failure");
  });
} catch (error) {
  // Still the "Intentional failure" error, and the connection is back in the pool.
  console.error(error);
}
```

In addition, `durcno/logger` now exports `createLogger` as its primary factory function (with `createQueryLogger` and `createDurcnoLogger` preserved as aliases), and `LogMetadata` groups query execution telemetry (`sql`, `arguments`, `durationMs`) into a strongly-typed `query: QueryLogData` object, cleanly separating query events from database lifecycle errors.
