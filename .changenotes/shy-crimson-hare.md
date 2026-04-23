---
bump: patch
---

# fix(migration/fk): detect and generate FK reference changes

The migration generator now detects when a column's foreign key `references` changes between schema snapshots and emits the appropriate `ALTER TABLE` statements.

Two new actions are added to `AlterTableBuilder`: `addForeignKey` and `dropForeignKey`. When a column gains a reference, an `ADD CONSTRAINT ... FOREIGN KEY` statement is emitted. When a reference is removed, the corresponding `DROP CONSTRAINT` statement is emitted. If the reference target changes, a drop is followed by an add.

```typescript
// Generated migration when a FK is added to an existing column
alterTable("public", "posts").addForeignKey("posts_user_id_fkey", "user_id", {
  schema: "public",
  table: "users",
  column: "id",
  onDelete: "CASCADE",
});

// Generated migration when a FK is removed from a column
alterTable("public", "posts").dropForeignKey("posts_user_id_fkey", "user_id");
```