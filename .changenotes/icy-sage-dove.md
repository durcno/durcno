---
bump: minor
---

# feat(table): add foreignKeys callback for self-referencing foreign keys

Adds a new optional `foreignKeys` callback to the fourth `TableExtra` argument of `table()`. It is designed specifically for **self-referencing foreign keys** — cases where a column on a table points back to another column on the same table (e.g., a `parentId` that references `id`).

Because the table object is fully constructed before the callback is invoked, column references are available directly without lazy arrow-function wrappers — unlike the column-level `.references()` approach.

```typescript
export const Comments = table(
  "public",
  "comments",
  {
    id: pk(),
    parentId: bigint({}),
    body: varchar({ length: 500, notNull }),
  },
  {
    foreignKeys: (t, fk) => [
      fk(t.parentId).references(t.id).onDelete("SET NULL"),
    ],
  },
);
```

The `fk` helper follows a fluent builder pattern: `fk(sourceColumn).references(targetColumn).onDelete(action)`. The `onDelete` step is optional and defaults to `"CASCADE"`. Accepted actions are `"CASCADE"`, `"SET NULL"`, `"SET DEFAULT"`, `"RESTRICT"`, and `"NO ACTION"`.