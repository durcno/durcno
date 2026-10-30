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
- `-y, --yes` — Treat unconfirmed potential renames as drop + create instead of prompting.
- `--rename-table <old=new>` — Declare a table rename; repeat for multiple tables. The schema defaults to `public`.
- `--rename-column <table.old=new>` — Declare a column rename; repeat for multiple columns. The schema defaults to `public`.

Renames and non-interactive runs

When a table or column is dropped while another is added in the same schema, Durcno cannot tell a rename from a delete + create. In an interactive terminal it asks you to confirm each pair.

When stdin is not a TTY (CI, scripts, AI agents), `generate` never prompts. It exits with code `1` and prints the matching `--rename-table` / `--rename-column` flags. Pass those flags to record a rename, or pass `--yes` to treat the unresolved changes as drop + create.

```bash npm2yarn
# Rename public.users to public.members and its username column to handle
npm exec durcno generate --rename-table public.users=public.members --rename-column public.members.username=handle

# Accept drop + create for anything left unconfirmed
npm exec durcno generate --yes
```

Rename flags also work in an interactive terminal; only the remaining ambiguous pairs are prompted.

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
