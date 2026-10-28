---
bump: minor
---

# feat(cli): make generate usable for non-interactive agents

`durcno generate` no longer blocks on rename prompts in non-interactive environments. Interactive terminals still prompt, while runs without a TTY or with `CI=true` exit with code `1` and print the exact flags needed to resolve ambiguous table/column renames.

Declare renames explicitly with repeatable `--rename-table old=new` and `--rename-column table.old=new` flags; the schema defaults to `public`. Pass `--yes` to treat any remaining potential renames as drop + create.

```sh
durcno generate --rename-table public.users=public.members \
  --rename-column public.members.username=handle
durcno generate --yes
```

`durcno push` accepts the same flags and forwards them to `generate`.
