---
bump: patch
---

# fix(migrations): use backticks instead of quotes on column types

Fixes generated migration statements for `addColumn` and `alterColumnType` to wrap column types in template literal backticks instead of double quotes.

This prevents syntax errors in generated migrations when column types contain double quotes, such as qualified enum types (e.g., `"public"."role"`), aligning them with `createTable` column definitions.