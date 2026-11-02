---
name: commit-message
description: "Commit name and changenote title guidelines. Use when: writing a commit message, naming a changenote, writing a PR title, choosing a conventional commit type or scope."
---

# Commit Message and Changenote Title

Durcno commits and changenotes share one title. `cngpac commit` uses the changenote title as the commit message, so write a title that works for both.

## Format

Titles follow the [Conventional Commits](https://www.conventionalcommits.org/) style:

```
<type>[optional scope]: <description>
```

- **`<type>`** — the category of the change (see the table below)
- **`[optional scope]`** — a parenthesized chain of one or more nouns describing the section of the codebase affected, e.g. `fix(parser/tokenizer):`, `feat(cli):`
- **`<description>`** — a short, imperative-tense summary of the change (lowercase, no trailing period)

## Types

| Type     | Purpose                                                | Example                                      |
| -------- | ------------------------------------------------------ | -------------------------------------------- |
| `feat`   | A new feature or capability                            | `feat(qb): add left join support`            |
| `change` | A breaking or non-breaking behavior change             | `change: remove deprecated API`              |
| `impr`   | An improvement to a feature                            | `impr(cli): add error handling`              |
| `fix`    | A bug fix                                              | `fix(migration): resolve duplicate tracking` |
| `refac`  | Code restructuring with no behavior change             | `refac(select): simplify join compilation`   |
| `docs`   | Documentation only                                     | `docs: update configuration guide`           |
| `agents` | Agent instructions, skills, and repo automation        | `agents: split changenote skill`             |
| `test`   | Adding or updating tests                               | `test(qb): add insert conflict coverage`     |
| `chore`  | Maintenance tasks (deps, tooling, config)              | `chore: upgrade vitest to v5`                |
| `perf`   | Performance improvement with no behavior change        | `perf: cache compiled select columns`        |
| `style`  | Formatting, whitespace, or cosmetic changes (no logic) | `style: fix indentation in select.ts`        |
| `ci`     | CI/CD configuration changes                            | `ci: add Node 26 to test matrix`             |
| `build`  | Build system or external dependency changes            | `build: switch bundler to tsdown`            |
| `revert` | Reverts a previous change                              | `revert: undo feat(qb): add row locking`     |
| `meta`   | Repo metadata                                          | `meta: update sponsors`                      |

Use `docs` for website and README changes; use `agents` for agent instructions, skills, and automation.

## Scopes

Use a scope that matches the area of `src/` being changed:

| Scope         | Area                                     |
| ------------- | ---------------------------------------- |
| `qb`          | Query builders (`src/query-builders/`)   |
| `cli`         | CLI commands (`src/cli/`)                |
| `columns`     | Column types (`src/columns/`)            |
| `filters`     | Filter builders (`src/filters/`)         |
| `functions`   | SQL function builders (`src/functions/`) |
| `constraints` | Constraint builders (`src/constraints/`) |
| `migration`   | Migration handling (`src/migration/`)    |
| `schema`      | Table, enum, and sequence definitions    |
| `ddl`         | DDL helpers                              |
| `connectors`  | Database connectors (`src/connectors/`)  |
| `indexes`     | Index definitions (`src/indexes.ts`)     |
| `logger`      | Logging (`src/logger.ts`)                |

`schema` covers `src/table.ts`, `src/enumtype.ts`, and `src/sequence.ts`; `ddl` covers `src/migration/ddl/`.

Prefer the narrowest accurate scope. Chain nested areas with `/`, e.g. `functions/comparison`, `cli/squash`, `migration/ddl`. Omit the scope when the change crosses several areas.

Feature-level scopes are also valid when they are more precise than the folder name: `select`, `insert`, `update`, `delete`, `rq`, `prepare`, `db`, `types`, `table`, `sql`. Prefer `qb` over `query-builder`/`query-builders`, and `migration` over `migrations`.

## Tips

- Use **imperative mood** in the description: "add" not "added" or "adds".
- Keep the description under ~70 characters when possible.
- The scope is optional — omit it when the change is broad or the context is obvious.
- Add `!` to the title if the change is a **breaking change**.
- Use the same title for the changenote, commit message, and PR title.
