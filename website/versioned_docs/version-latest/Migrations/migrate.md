---
sidebar_position: 2
---

# migrate

Apply pending migrations to your configured database.

Usage

```bash npm2yarn
npx durcno migrate [--config path/to/durcno.config.ts]
```

What it does

- Finds migrations in the configured `out` directory that have not yet been applied.
- Executes the DDL statements exported by each migration's `up.ts` in order.
- Records applied migrations in the `durcno.migrations` table.

Before you run

- Make sure the generated `up.ts` files (which export arrays of DDL statement objects) are reviewed and safe for your target environment.
- Back up your database if applying to production.

Example

```bash npm2yarn
npx durcno migrate
```

Troubleshooting

- If a migration fails mid-apply, check the database state and the migration SQL. You may need to roll back the partial changes manually, fix the SQL, then re-run.
- If a migration was applied outside Durcno or manually altered, `status` can help diagnose mismatches.

Next: check migration status with `npx durcno status` or roll back with `npx durcno down`.