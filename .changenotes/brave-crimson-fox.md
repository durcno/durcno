---
bump: minor
---

# feat(cli): add exec command for non-interactive SQL

`durcno exec` runs SQL against the configured database without opening a REPL. It uses the connector and credentials from `durcno.config.ts`, so scripts, CI jobs, and AI agents get a `psql` alternative that shares the project's configuration. The interactive `durcno shell` is unchanged.

SQL comes from `-c/--command`, `-f/--file`, or piped stdin. Statements are split on top-level semicolons — semicolons inside strings, quoted identifiers, dollar-quoted bodies, and comments do not split — and run sequentially. The first failure is written to stderr and exits `1`; success exits `0`. Query data goes to stdout.

```bash
durcno exec -c 'select * from "public"."users" limit 5'
durcno exec -f db/seed.sql
cat db/seed.sql | durcno exec --json
```

`--json` prints a single valid JSON array containing the rows returned by the whole run, with 64-bit integers serialized as strings and byte arrays as hex. DDL-only input prints `[]`. `-q/--quiet` suppresses timings and row counts. Data-returning meta commands are supported when they make up the entire input:

```bash
durcno exec -c '\dt' --json
```

`--command` and `--file` cannot be combined. Without either, `exec` reads piped stdin and never starts an interactive prompt.
