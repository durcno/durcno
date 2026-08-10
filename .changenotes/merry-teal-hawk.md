---
bump: minor
---

# feat(ddl): add extension and schema existence helper functions

Introduces PostgreSQL extension DDL support (`CREATE EXTENSION` and `DROP EXTENSION`) to the migration DDL API, along with `IF NOT EXISTS` / `IF EXISTS` helper functions for schemas and extensions.

The new helper functions include `createExtension`, `createExtensionIfNotExists`, `dropExtension`, `dropExtensionIfExists`, `createSchemaIfNotExists`, and `dropSchemaIfExists`.

```typescript
ddl.createExtensionIfNotExists("vector").withSchema("public");
// CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

ddl.createSchemaIfNotExists("analytics");
// CREATE SCHEMA IF NOT EXISTS analytics;
```