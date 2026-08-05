---
bump: minor
---

# impr(qb): support Sql and Arg in insert and update and type non-updateable columns

- Enhanced `update.set()`, `insert.values()`, and conflict's `doUpdateSet()` methods to accept raw `Sql` instances for setting column values.
- Enhanced `update.set()` to accept parameterized `Arg` values.
- Strengthened TypeScript constraints for update and insert payloads. Columns that are strictly non-updateable (e.g., primary keys) or non-insertable (e.g., `generatedAlways()`) are now strictly excluded from the allowed object properties at compile-time, resulting in clearer TypeScript errors.