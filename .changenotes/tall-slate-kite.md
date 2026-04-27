---
bump: patch
---

# fix(insert): use DEFAULT for missing columns and build SQL inline

Previously, insert rows used a two-phase approach: values were collected into intermediate arrays and joined at the end. Columns missing from the input row were filled with `NULL`, even when the column had no explicit value — which could silently override a column's database-level `DEFAULT`.

The column list is now derived directly from `table._.columns`, covering all columns consistently. When a column has no value and no insert function, `DEFAULT` is emitted instead of `NULL`, correctly delegating to the database default.

SQL is now written directly to `query.sql` as each field is processed, eliminating the intermediate `rowValues` and `rowsValue` arrays and reducing allocations per insert.