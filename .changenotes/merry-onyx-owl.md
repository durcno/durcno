---
bump: minor
---

# feat(migration/ddl): add type DDL API and split ddl module into files

Introduced a new generic type DDL API to replace the old enum-specific helpers. The old methods (`createEnum`, `dropEnum`, `alterEnumAddValue`) are still available but now marked `@deprecated`.

**New API:**

```typescript
// Create a PostgreSQL enum type
ddl.createType("public", "user_type", { asEnum: ["admin", "user"] });

// Drop a type
ddl.dropType("public", "user_type");

// Alter a type — fluent chainable builder
ddl
  .alterType("public", "user_type")
  .addValue("moderator", { after: "admin" })
  .renameValue("guest", "visitor");
```

`alterType` introduces a new `renameValue` capability that was not available in the old API.

The `src/migration/ddl/` module was also refactored from a single monolithic file into focused modules (`enum.ts`, `indexes.ts`, `schema.ts`, `sequence.ts`, `statement.ts`, `table.ts`, `types.ts`, `utils.ts`) with a re-exporting `index.ts`. This is a purely internal restructuring with no public API changes.

The migration generator (`durcno generate`) now emits the new type API in freshly generated migration files.