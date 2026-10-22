---
bump: major
---

# change(cli)!: rename shell command to repl

The interactive SQL command is now `durcno repl`. The old `durcno shell` command and its `shel` alias are removed, making this a breaking CLI change.

The REPL behavior is unchanged: multi-line input, query history, formatted table output, and psql-style meta commands all work as before.

```bash
npm exec durcno repl
```
