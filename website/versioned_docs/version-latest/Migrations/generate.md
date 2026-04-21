---
sidebar_position: 1
---

# generate

Generate a new migration that represents the difference between your current schema and the last recorded state. Each migration includes a forward (`up.ts`) and a rollback (`down.ts`) file, so changes can be applied and reverted reliably.

Usage

```bash npm2yarn
npm exec durcno generate [--config path/to/durcno.config.ts]
```

Common options

- `--config <path>` — Path to config file (defaults to `durcno.config.ts`).

What it produces

After running the command you should see a new folder in your configured `out` directory (commonly `migrations/`) that contains:

- `up.ts` — exports DDL statements to apply the migration
- `down.ts` — exports DDL statements to roll back the migration

Example

1. Update your schema in `db/schema.ts` (add or change tables/columns).
2. Run:

```bash npm2yarn
npm exec durcno generate
```

3. Review the generated `up.ts` and `down.ts` in the new migration folder. Edit the generated DDL statements if you need to tweak or add data migrations.

Tips

- Review `up.ts` and `down.ts` carefully before applying to production.
- If a generated migration contains undesired changes, adjust the DDL statements or fix your schema and re-run `generate`.

Next: apply the migration with `durcno migrate`.