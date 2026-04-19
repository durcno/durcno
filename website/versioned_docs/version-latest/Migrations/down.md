---
sidebar_position: 4
---

# down

Roll back a specific migration.

Usage

```bash npm2yarn
npx durcno down <migration-name> [--config path/to/durcno.config.ts]
```

Arguments

- `<migration-name>` — the folder name (or identifier) of the migration to roll back. Use `npx durcno status` to find the identifier.

What it does

- Executes the rollback statements exported by the migration's `down.ts` in the specified migration folder to reverse the changes made by that migration.
- Updates the migration history so the migration is no longer considered applied.

Important notes

- Only roll back migrations when you understand the consequences for data. Rolling back schema changes that drop columns or tables can permanently remove data.
- For production, prefer writing compensating migrations instead of rolling back if data loss is possible.

Example

```bash npm2yarn
# Rollback a migration named 2025-10-01-add-users
npx durcno down 2025-10-01-add-users
```

If the `down.ts` is missing or incomplete

- You may need to write a manual rollback DDL or a new migration that safely reverses the previous change.

Next: verify the result with `npx durcno status`.