---
sidebar_position: 5
---

# status

List migrations and show which ones have been applied.

Usage

```bash npm2yarn
npm exec durcno status [--config path/to/durcno.config.ts]
```

What it shows

- A list of migrations found in your configured `out` directory.
- For each migration: the identifier (folder name), whether it has been applied, and typically a timestamp when it was applied.

When to use

- After generating or applying migrations to confirm the current state.
- Before rolling back to locate the migration identifier you want to target.

Example

```bash npm2yarn
npm exec durcno status
```

Troubleshooting

- If a migration appears applied but you don't find a corresponding record, verify your `durcno.config.ts` database settings and check for multiple environments or databases.

Next: apply or roll back migrations using `durcno migrate` or `durcno down`.