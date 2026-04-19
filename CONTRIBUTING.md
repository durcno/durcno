# Contributing to Durcno

Thank you for your interest in contributing to Durcno! We welcome contributions from the community and are grateful for any help you can provide.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Changenotes](#changenotes)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Guidelines](#pull-request-guidelines)
- [Questions](#questions)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone. Please be kind and constructive in all interactions.

## Getting Started

1. **Fork the repository** from https://github.com/durcno/durcno
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/you/durcno.git
   cd durcno
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/durcno/durcno.git
   ```

## Development Setup

### Prerequisites

- **Node.js 25.8+**
- **pnpm 10+**
- **Docker Desktop** — must be installed and **running** before executing integration tests (`pnpm test`)

### Dependencies

Install all the development dependencies:

```bash
pnpm install ---frozen-lockfile
```

### Available Scripts

| Script                     | Description                                              |
| -------------------------- | -------------------------------------------------------- |
| `pnpm run build-src:watch` | Watch mode for main code compilation                     |
| `pnpm run build-cli:watch` | Watch mode for CLI compilation                           |
| `pnpm run tsclint`         | (`/src`) TypeScript type checking                        |
| `pnpm run tsclint-cli`     | (`/src/cli`) TypeScript type checking                    |
| `pnpm run test-types`      | (`/type-tests`) TypeScript type checking                 |
| `pnpm run tsclint-all`     | Run all tsc checks (/src, /src/cli, /type-tests, /tests) |
| `pnpm run lint`            | Run Biome linter                                         |
| `pnpm run test`            | Build and run tests                                      |
| `pnpm run format`          | Format code                                              |
| `pnpm run build`           | Full production build                                    |

## Project Structure

For an overview of the project structure, see [AGENTS.md](AGENTS.md).

## Development Workflow

1. **Make your changes** following the project conventions outlined in [AGENTS.md](AGENTS.md)

2. **Write tests** for your changes:
   - Type tests in `type-tests/` for TypeScript type inference
   - Integration tests in `tests/` for runtime behavior

3. **Update documentation** if your changes affect public APIs or usage

4. **Run lints, type checks, and tests**:

   ```bash
   pnpm run lint      # Linting
   pnpm run tsclint-all    # tsc checks and type tests
   pnpm test          # Integration tests
   ```

5. **Create a branch and your first commit** using the [add-changenote skill](.agents/skills/add-changenote/SKILL.md), which walks you through creating a changenote, naming the branch, and staging your first commit following the [commit guidelines](#commit-guidelines)

## Testing

Durcno uses two distinct testing approaches:

### Type Tests (`type-tests/`)

Type tests ensure TypeScript type inference works correctly. These are compile-time validations.

Run type tests:

```bash
pnpm run test-types
```

### Integration Tests (`tests/`)

Integration tests validate runtime behavior using `Vitest` and [dockerode](https://npmjs.com/package/dockerode).

Run integration tests:

```bash
pnpm test
```

## Changenotes

This project uses [cngpac](https://cngpac.dev) to manage changenotes and releases. Every contribution that changes behavior, adds a feature, or fixes a bug must include a changenote.

### Creating a changenote

Run the `change` command to generate a changenote markdown file:

```bash
pnpm exec cngpac change <bump> "<title>"
```

- `<bump>` — one of `patch`, `minor`, or `major`
- `<title>` — a [Conventional Commits](https://www.conventionalcommits.org/) style message, e.g. `feat(qb): add left join support`

This creates a file under `.changenotes/` with the following structure:

```markdown
---
bump: patch
---

# feat(qb): add left join support
```

You can (and should) add a short body below the title to describe the change in more detail.

### Committing with cngpac

Instead of `git commit`, use the `commit` command, which picks up the changenote title as the commit message automatically:

```bash
pnpm exec cngpac commit
```

Stage your changes (including the changenote file) before running this command.

## Commit Guidelines

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) style. The [add-changenote skill](.agents/skills/add-changenote/SKILL.md) guides you through naming your branch, writing a commit message, and creating a changenote — refer to it when making your first commit on a change.

## Pull Request Guidelines

### Before Opening a PR

1. **Rebase on latest `main`** to avoid merge conflicts:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```
2. **Run the full validation suite**:
   ```bash
   pnpm run lint      # Linting
   pnpm run tsclint-all    # All type checks
   pnpm test          # Integration tests
   ```
3. **Ensure no unrelated changes** are included

### PR Requirements

- **One concern per PR** — a single feature, fix, or refactor
- **Title** follows commit message format: `feat(qb): add left join support`
- **Description** must include:
  - **What**: What does this PR change?
  - **Why**: What problem does it solve or what feature does it add?
  - **How**: Brief explanation of the approach
  - **Testing**: What tests were added/updated and how to verify
- **Type tests are mandatory** if the change affects public TypeScript types
- **Integration tests are mandatory** if the change affects runtime behavior
- **Documentation updates** are required if public APIs change

### Review Process

- A maintainer will review your PR and may request changes
- Address review feedback by adding new commits (don't force-push during review)
- Once approved, your PR will be squash-merged into `main`

## Questions

If you have questions about contributing, feel free to:

- Read [AGENTS.md](AGENTS.md) for detailed codebase insights
- Check existing issues and PRs for context
- Join our [Discord server](https://discord.gg/JuVrdjeNeQ) to chat with the community
- Or open a [discussion](https://github.com/durcno/durcno/discussions)

Thank you for contributing to Durcno! 🎉