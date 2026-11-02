---
bump: major
---

# change(columns)!: remove default on delete action for references

Column-level `.references()` no longer adds an implicit `ON DELETE CASCADE`. A plain reference now produces no `ON DELETE` clause, so PostgreSQL's `NO ACTION` default applies.

The object form `.references({ column, onDelete })` is removed. Use the lazy getter and chain the delete action instead:

```ts
userId: bigint({ notNull }).references(() => Users.id),
ownerId: bigint({ notNull })
  .references(() => Users.id)
  .onDeleteCascade(),
reviewerId: bigint({})
  .references(() => Users.id)
  .onDeleteSetNull(),
```

Available actions are `.onDelete(action)`, `.onDeleteCascade()`, `.onDeleteSetNull()`, `.onDeleteSetDefault()`, `.onDeleteRestrict()`, and `.onDeleteNoAction()`. The table-level `fk()` builder follows the same rule and emits no `ON DELETE` clause by default.

Existing schemas that relied on the implicit `CASCADE` — on column-level references or table-level foreign keys — must add `.onDeleteCascade()`. Without it, the next `generate` run emits a migration that replaces those foreign keys with `NO ACTION`.
