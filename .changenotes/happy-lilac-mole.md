---
bump: patch
---

# fix(cli/generate): correct column and index statement ordering in migrations

The `generate` command produced migrations with incorrect DDL ordering, causing PostgreSQL errors when columns and indexes changed together on the same table.

Two issues were fixed in `generateAlterTableStmts`:

- **Missing `dropIndex`**: removed indexes were never emitted as `ddl.dropIndex()`, so dropping a column that had an index would fail.
- **`createIndex` before `addColumn`**: new index statements were emitted before the `alterTable` block containing `addColumn`, so indexing a newly added column would fail.

The corrected order is now: `dropIndex` → `alterTable` → `createIndex`.