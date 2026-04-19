---
sidebar_position: 3
---

# push

Generate and migrate in a single step.

`push` is a convenience command that combines [`generate`](./generate) and [`migrate`](./migrate) into one call. It diffs your schema, creates a new migration, and immediately applies it to the database.

## Usage

```bash npm2yarn
npx durcno push [--config path/to/durcno.config.ts]
```

### Common options

- `--config <path>` — Path to config file (defaults to `durcno.config.ts`).

## What it does

1. Runs `generate` to compare your current schema with the last recorded snapshot.
2. Then runs `migrate` to apply any pending migrations.

## Example

```bash npm2yarn
npx durcno push
```

When there are schema changes:

```
Migration 2026-02-26T10-15-30.456Z created at migrations/2026-02-26T10-15-30.456Z.
[SUCCESS] Migration 2026-02-26T10-15-30.456Z applied.
```

When the database is already up to date:

```
No changes detected. Skipping migration creation.
```

## Tips

- Use `push` during **local development** for a fast generate-and-apply workflow.
- For **production**, prefer running `generate` and `migrate` separately so you can review the generated `up.ts` and `down.ts` before applying.

Next: roll back a migration with `npx durcno down`.