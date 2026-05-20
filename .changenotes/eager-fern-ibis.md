---
bump: minor
---

# feat(cli/squash): validate db state and sync tracking records

The `squash` command now connects to the database to validate migration state and keep the `durcno.migrations` tracking table consistent after a squash.

**Mixed-state validation**: if the squash range contains a mix of applied and unapplied migrations, the command exits with an error listing which are in each bucket.

**Tracking sync**: when all migrations in the range are applied, the individual tracking records are deleted and replaced with a single entry pointing to the squashed migration's start name.

**`--skip-db` flag**: pass `--skip-db` to bypass all database interaction entirely — useful in environments where the database is unavailable.

```sh
# Normal usage — connects to DB for validation and tracking sync
durcno squash 2024-01-01T00-00-00.000Z 2024-06-01T00-00-00.000Z

# Skip DB — no validation, no tracking update
durcno squash 2024-01-01T00-00-00.000Z 2024-06-01T00-00-00.000Z --skip-db
```