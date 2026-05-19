---
bump: major
---

# change!: auto-convert schema identifiers from camelCase to snake_case

Durcno now automatically converts all schema identifiers from camelCase to snake_case when generating SQL and migration files. You can write your entire schema in TypeScript-idiomatic camelCase — Durcno handles the PostgreSQL side.

This affects every identifier passed to a schema builder:

| Builder                       | Identifiers converted            |
| ----------------------------- | -------------------------------- |
| `table(schema, name, ...)`    | schema, table name, column names |
| `enumtype(schema, name, ...)` | schema, enum name                |
| `sequence(schema, name, ...)` | schema, sequence name            |

Enum _values_ are **not** converted — they remain exactly as written.

```typescript
export const BlogPosts = table("public", "blogPosts", {
  id: pk(),
  authorId: bigint({ notNull }),
  publishedAt: timestamp({ notNull }),
});
```

Generates:

```sql
CREATE TABLE "public"."blog_posts" (
  "id" bigserial PRIMARY KEY,
  "author_id" bigint NOT NULL,
  "published_at" timestamp NOT NULL
);
```

**Breaking changes:**

- Any existing schema using camelCase identifiers that relied on the raw (unconverted) name being used in SQL or migrations will now produce snake_case identifiers instead. Re-generate your migrations after upgrading.

- Constraint name helpers (`check()`, `primaryKey()`, `unique()`) no longer auto-prefix or auto-suffix names. The name you provide is used exactly as-is. Previously, `primaryKey` and `unique` would prepend the table name if it wasn't already present, and `check` would append `_check` if missing. You must now supply the full constraint name yourself. The recommended conventions are:
  - Primary key: `pk_<table>`
  - Unique: `unique_<table>_<col>[_and_<col>]*`
  - Check: `check_<table>_<col>[_and_<col>]*[_<suffix>]?`