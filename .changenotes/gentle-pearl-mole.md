---
bump: patch
---

# fix(cli/migration): combine transaction statements into single query for joined execution

Previously, even in `joined` execution mode, `BEGIN` and `COMMIT` were issued as separate `client.query()` calls around the batched SQL. This meant three round-trips to the database instead of one.

The fix embeds `BEGIN;` and `COMMIT;` directly into the single SQL string sent for `joined` execution, reducing it to a single round-trip and making joined migrations significantly faster.

For `sequential` execution the behavior is unchanged: `BEGIN`/`COMMIT` are still sent as individual queries between each statement. The `ROLLBACK` on error is also now correctly scoped to `sequential` mode only, since a failed `joined` query is already rolled back by the database.