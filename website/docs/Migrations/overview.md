---
sidebar_position: 0
---

# Overview

Durcno's migration system helps you track, generate, apply and rollback schema changes to your PostgreSQL database.

This section covers the CLI commands you need to manage migrations:

- `npx durcno generate` — create a new migration for schema changes. [See more](./generate)
- `npx durcno migrate` — apply pending migrations to database. [See more](./migrate)
- `npx durcno push` — generate and apply a migration in one step. [See more](./push)
- `npx durcno down <migration>` — rollback a specific migration. [See more](./down)
- `npx durcno squash <start> <end>` — squash a range of migrations into one. [See more](./squash)
- `npx durcno status` — view the status of migrations. [See more](./status)

Durcno tracks your schema changes automatically, so you can focus on building features instead of writing SQL migration scripts by hand.

## How Migrations Work

Durcno generates migrations by comparing your current schema definition with the DDL statements from previous migrations. Each migration contains `up.ts` and `down.ts` files that export DDL statement objects.

This approach keeps your migration history clean and makes it easy to understand what changed in each migration.

### ISO Timestamp Naming

Durcno uses a modified ISO timestamp format (e.g., `2025-12-20T14-30-52.123Z`) for migration folder names.

:::note
Standard ISO format uses `:` (e.g., `2025-12-20T14:30:52.123Z`), but Durcno replaces `:` with `-` to ensure compatibility with Windows file systems where `:` is not allowed in folder names.
:::

This naming convention offers significant advantages when working with git branches or remote teams:

- **No merge conflicts**: Unlike sequential numbering, timestamp-based names are unique per creation time, so migrations created on different branches won't clash
- **Easy to merge**: Team members can create migrations independently without coordinating migration numbers
- **Clear chronology**: The ISO format naturally sorts migrations by creation time, making history easy to follow
- **Self-contained migrations**: Each migration's DDL statements stand on their own, making it straightforward to merge branches with different migration histories

## Notes

- Migrations are stored in the `out` directory configured by `durcno.config.ts` (default: `migrations`).
- Each migration folder contains:
  - `up.ts` — exports DDL statement objects to apply the migration
  - `down.ts` — exports DDL statement objects to rollback the migration

Next: read the detailed guide for each CLI command.