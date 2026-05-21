---
bump: major
---

# change(migration/ddl)!: remove deprecated enum DDL helpers

Removed the deprecated enum-specific DDL helpers that were superseded by the generic type API in v1.0.0-alpha.4.

**Removed from `ddl`:**

- `ddl.createEnum()` → use `ddl.createType(schema, name, { asEnum: [...] })` instead
- `ddl.alterEnumAddValue()` → use `ddl.alterType(schema, name).addValue(...)` instead
- `ddl.dropEnum()` → use `ddl.dropType(schema, name)` instead

**Removed classes** (were re-exported from `durcno/migration`):

- `CreateEnumStatement`
- `AlterEnumAddValueStatement`
- `DropEnumStatement`

**Removed from `DDLStatementType`:** `"createEnum"`, `"alterEnum"`, `"dropEnum"`.