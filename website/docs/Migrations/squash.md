---
sidebar_position: 6
---

# squash

Squash a range of migrations into a single migration.

Why use it

- Reduce clutter when many small migrations accumulate over time.
- Combine related schema changes into one clean migration for easier review and maintenance.
- Simplify migration history before merging a feature branch.

Usage

```bash npm2yarn
npm exec durcno squash <start> <end> [--config path/to/durcno.config.ts] [--force] [--skip-db]
```

Arguments

- `<start>` — the folder name of the first migration in the range. Use `durcno status` to find migration identifiers.
- `<end>` — the folder name of the last migration in the range.

Common options

- `--config <path>` — Path to config file (defaults to `durcno.config.ts`).
- `--force` — Squash even if custom statements (`ddl.custom(...)`) exist in the migration range. Without this flag, the command will abort when custom statements are detected because they cannot be preserved during squash.
- `--skip-db` — Skip all database interaction. No mixed-state validation is performed and the `durcno.migrations` tracking table is not updated. Useful in CI environments or when the database is unavailable.

What it does

1. Replays all migrations **before** the range to build a baseline snapshot.
2. Replays all migrations **through** the range to build the target snapshot.
3. Generates a single squashed `up.ts` and `down.ts` by diffing the two snapshots.
4. Deletes all migration folders in the range.
5. Writes the squashed migration into a single folder using the **start** migration's timestamp as its name.
6. If the database is reachable and all migrations in the range are applied, removes the individual `durcno.migrations` tracking records and inserts a single record for the squashed migration.

Example

Suppose you have three migrations from iterating on a feature:

```
migrations/
├── 2025-10-01T10-00-00.000Z/   # created users table
├── 2025-10-02T12-30-00.000Z/   # added bio column
└── 2025-10-03T09-15-00.000Z/   # added age column
```

Squash them into one:

```bash npm2yarn
npm exec durcno squash 2025-10-01T10-00-00.000Z 2025-10-03T09-15-00.000Z
```

Result:

```
migrations/
└── 2025-10-03T09-15-00.000Z/   # creates users table with bio and age
```

The squashed migration's `up.ts` contains the full combined effect of all three original migrations, and its `down.ts` reverses everything back.

:::warning
Do not squash migrations that have already been deployed to production or any shared environment. Other databases running those migrations will have no record of the squashed result, causing `durcno migrate` to fail or apply duplicate changes. Only squash migrations that exist exclusively in your local or development environment.
:::

Important notes

- **Custom statements**: If any migration in the range contains `ddl.custom(...)` statements, the squash will abort unless you pass `--force`. Custom statements cannot be automatically preserved because they are opaque to the snapshot diffing process.
- **Mixed applied/unapplied migrations**: If the range contains a mix of applied and unapplied migrations, the command exits with an error listing which are in each bucket. Either apply all pending migrations first, or pass `--skip-db` to bypass the check.
- **Tracking sync**: When all migrations in the range are applied, the command connects to the database, deletes the individual tracking records from `durcno.migrations`, and inserts a single record pointing to the squashed migration. Pass `--skip-db` to skip this update.

Next: verify the result with `durcno status`.