---
bump: minor
---

# feat(schema): add expression indexes

Index keys now accept SQL expressions in addition to columns, enabling GIN full-text search indexes and other expression-based indexes. Prefer scalar function builders, which keep expressions type-checked:

```ts
index("posts_content_tsv_idx", [
  toTsvector(t.content, "english"),
]).using("gin"),
  index("posts_user_lower_title_idx", [t.userId, lower(t.title)]);
```

Use the `sql` tag only when no builder exists:

```ts
index("posts_content_tsv_raw_idx", [
  sql`to_tsvector('english', ${t.content})`,
]).using("gin");
```

Expression indexes require an explicit name. The migration generator emits `sql.raw(...)` keys, snapshots round-trip expressions so unchanged schemas produce no diff, and DDL builders accept `Sql`/`SqlFn` keys directly. Prepared `Arg` values are rejected in index expressions.
