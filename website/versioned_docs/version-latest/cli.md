---
sidebar_position: 4.5
---

# CLI

Durcno ships a command-line interface for project scaffolding, database interaction, and migration management.

```bash npm2yarn
npm exec durcno <command> [options]
```

## Commands

| Command                | Description                                  |
| ---------------------- | -------------------------------------------- |
| `init`                 | Initialize a new Durcno project              |
| `shell`                | Open an interactive SQL REPL shell           |
| `generate`             | Generate a new migration from schema changes |
| `migrate`              | Apply pending migrations                     |
| `push`                 | Generate and apply a migration in one step   |
| `down <migration>`     | Rollback a specific migration                |
| `squash <start> <end>` | Squash a range of migrations into one        |
| `status`               | Show migration status                        |

Migration commands (`generate`, `migrate`, `push`, `down`, `squash`, `status`) are covered in the [Migrations](./Migrations/overview) section.

---

## init

Initialize a new Durcno project with an interactive setup wizard.

```bash npm2yarn
npm exec durcno init [--force]
```

### Options

- `--force` — Overwrite existing files without prompting.

### What it does

The `init` command walks you through an interactive prompt to configure your project:

1. **Select a database connector** — Choose from:
   - `pg` (node-postgres)
   - `postgres` (postgres.js)
   - `bun` (Bun SQL)
   - `pglite` (WASM)
2. **Enter a connection URL** — Your PostgreSQL connection string, or leave empty to use `process.env.DATABASE_URL!`
3. **Schema file path** — Where to create your schema file (default: `db/schema.ts`)
4. **Migrations directory** — Where to store migration files (default: `migrations`)
5. **Set `"type": "module"`** — Optionally update your `package.json` (required for migration files)

### Generated files

After completion, the following files are created:

- **`durcno.config.ts`** — Database configuration file
- **`db/schema.ts`** — Starter schema with an example `Users` table
- **`db/index.ts`** — Database query API

### Example

```bash npm2yarn
npm exec durcno init
```

```
🚀 Durcno Project Setup

? Select a database connector: pg (node-postgres)
? Connection URL (leave empty to use process.env.DATABASE_URL!):
? Schema file: db/schema.ts
? Migrations directory: migrations
? Set "type": "module" in package.json? Yes

📄 Creating files ...

✔ Created durcno.config.ts
✔ Created db/schema.ts
✔ Created db/index.ts

✨ Project initialized successfully!
```

After initialization, follow the next steps printed in the terminal to generate and apply your first migration.

:::tip
In non-interactive environments (CI, piped input), `init` uses default values automatically.
:::

---

## shell

Open an interactive SQL REPL connected to your database.

```bash npm2yarn
npm exec durcno shell [--config path/to/durcno.config.ts]
```

### Options

- `--config <path>` — Path to the config file (defaults to `durcno.config.ts`).

### Features

- Execute any SQL query directly against your database
- Multi-line input — queries are executed when they end with `;`
- Query results displayed in a formatted table
- Execution time reported for each query
- Command history (up to 100 entries)

### Meta commands

The shell supports psql-style meta commands:

| Command       | Description                  |
| ------------- | ---------------------------- |
| `\dt`, `\d`   | List all tables              |
| `\dn`         | List all schemas             |
| `\du`         | List all roles               |
| `\clear`      | Clear the screen             |
| `\?`, `\help` | Show available meta commands |

### Example

```bash npm2yarn
npm exec durcno shell
```

```
✔ Connected to database

 DURCNO SHELL
Type SQL queries and press Enter to execute.
Enter "exit" or "quit" to close the shell.

durcno> SELECT * FROM "public"."users";

id | name     | email
---+----------+-----------------
1  | John Doe | john@example.com

(1 row) (12.34ms)

durcno> \dt

Tables:
  • public.users

durcno> exit
✔ Connection closed.
```

:::tip
Press `Ctrl+C` during multi-line input to cancel the current query. Press `Ctrl+C` at the prompt to close the shell.
:::