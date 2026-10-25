---
bump: patch
---

# fix(prepare): renumber placeholders and evaluate generated values per run

Prepared `INSERT` and `UPDATE` queries called `$insertFn` / `$updateFn` while the statement was built, then reused the generated values for every `.run()`. A unique `$insertFn` column failed on the second run with a duplicate key.

Generated values are now bound as dynamic arguments and produced on every execution: once per omitted insert cell and once per update. The SQL text stays stable across runs.

```ts
const createLog = prepare(
  { action: AuditLogs.action.arg() },
  (args) => db.prepare().insertInto(AuditLogs).values({ action: args.action }),
);

// createdAt and publicId are generated separately for each run.
await createLog.run(db, { action: "first" });
await createLog.run(db, { action: "second" });
```

Placeholders now take their numbers in write order instead of the sorted argument names, so previously built statements written out of name order produce different SQL. A reused `Arg` writes its `$N` at every occurrence while binding its value once, and declared arguments the statement never references send no parameter. `Arg.index` now reports the placeholder number of the argument's first use instead of its sorted declaration position.

Rendering an `Arg` placeholder outside `prepare()` emits `$1` instead of the broken `$0`, and the ad-hoc `Query.pushArg` helper joins the same numbering: it never reuses a number an `Arg` already took, and pushed values now reach prepared statements, re-bound on every `run()`.
