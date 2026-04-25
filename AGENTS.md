# Agent Instructions for this Codebase

## Table of Contents

1. Overview
2. Usage
3. Core Concepts
4. Project Structure
5. Development Workflow
6. Testing Guide
7. Documentation
8. Best Practices
9. Guides

## Overview

This is **Durcno**. A PostgreSQL query builder and migration manager for TypeScript. It is designed around these core principles:

- **Intuitive Abstraction**: Clean definitions and queries that map to PostgreSQL
- **Type Safety**: Full TypeScript inference across all operations
- **Migration Management**: Auto generated, reversible, and squashable migrations

This is NOT a Drizzle-based project - it's a custom query builder and migration manager with its own unique patterns and conventions.

- **Language**: TypeScript
- **Package manager**: pnpm
- **Repository**: `github.com/durcno/durcno`
- **Website**: Docusaurus (https://durcno.dev)
- **License**: Apache-2.0

**Important**: Durcno only supports **PostgreSQL 14 and above**, **Node.js 25 and above**.

## Usage

How Durcno Query Builder is supposed to be used.

### Configuration

A configuration file to define database connection and project settings:

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";

export default defineConfig({
  schema: "db/schema.ts",
  out: "migrations",
  connector: pg({
    dbCredentials: {
      url: process.env.DATABASE_URL!,
    },
  }),
});
```

### Basic Schema Definition

Database schema using type-safe table definitions:

```typescript
// db/schema.ts
import { table, pk, varchar, enumtype, notNull, unique } from "durcno";

export { Migrations } from "durcno"; // Required for migrations tracking

export const UserTypeEnm = enumtype("public", "user_type", ["admin", "user"]);

export const Users = table("public", "users", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  email: varchar({ length: 255, notNull, unique }),
  type: UserTypeEnm.enumed({ notNull }),
});
```

### Database Connection

Setting up the query api:

```typescript
// db/index.ts
import { database } from "durcno";
import * as schema from "./schema.ts";
import config from "../durcno.config.ts";

export const db = database(schema, config);
```

### Basic Queries

Executing type-safe queries:

```typescript
// Select all users
const users = await db.from(Users).select();

// Insert a new user
await db.insert(Users).values({
  name: "John Doe",
  email: "john@example.com",
  type: "user",
});

// Update user
await db.update(Users).set({ name: "Jane Doe" }).where(eq(Users.id, 1));
```

## Core Concepts

### Entity System

**Tables** are defined using the `table(schema, name, columns, extra?)` function in a type-safe builder pattern. Each table definition creates a strongly-typed schema object that enables full TypeScript inference.

**Columns** are type-safe definitions located in `src/columns/`. Supported types include:

- String: `char`, `varchar`, `text`
- Numeric: `integer`, `bigint`
- Other: `boolean`, `timestamp`, `enum`, ...
- Geography/Geometry: `postgis/`

**Relations** define table relationships using `relations()` with `many`/`fk`/`one` functions for many-to-one/one-to-many/one-to-one relationships.

### Query System

**QueryPromise Pattern**: All queries return `QueryPromise<T>` objects that implement the Promise interface, enabling both async/await and then/catch patterns.

**Fluent API**: Chainable methods provide an intuitive query-building experience:

- `.select()` - Define columns to return
- `.where()` - Add filtering conditions
- `.orderBy()` - Sort results
- `.limit()` > `.offset()` - Paginate results

**Query Builders**: Separate classes in `src/query-builders/` handle different query types (SELECT, INSERT, UPDATE, DELETE, ...) with consistent patterns and full type safety.

**Type Safety**: Full TypeScript inference ensures compile-time validation of columns, return types, and relationships.

### CLI & Migrations

**Migration Commands**:

- `durcno generate` - Generate new migration from schema changes
- `durcno migrate` - Apply pending migrations to database
- `durcno down <migration>` - Rollback specific migration
- `durcno squash <start> <end>` - Squash a range of migrations into one
- `durcno status` - Show migration status

**Migration Structure**: Each migration creates a folder containing:

- `up.ts` - Forward migration Statements
- `down.ts` - Rollback migration Statements

## Project Structure

### Directory Organization

```
src/
├── index.ts              # All public exports
├── db.ts                 # Query builder creator classes
├── table.ts              # Table and column types
├── enumtype.ts           # Enum builder
├── columns/              # Column type implementations
├── query-builders/       # Query builder classes
├── filters/              # Filter builders
├── constraints/          # Constraint builders
├── connectors/           # Database connectors
├── migration/            # Migration builders
└── cli/                  # CLI entry and commands

type-tests/               # Infered type safety checks
tests/
├── columns/              # Column read/write tests
├── qb/                   # Query builders integration tests
└── cli/                  # CLI integration tests

website/                  # Website

scripts/                  # Utility scripts
dist/                     # Production compiled output
```

### Key Files/Folders

#### Core Files

- **`src/index.ts`**: All public exports - **EXPORT NEW APIS HERE**
- **`src/db.ts`**: Query builder creator classes

#### Column Types (`src/columns/`)

- **`common.ts`**: Common utilities for column definitions
- **`varchar.ts`**, **`integer.ts`**, **`boolean.ts`**, **`timestamp.ts`**, **`enum.ts`**, etc.: Column types

#### Query Builders (`src/query-builders/`)

- **`select.ts`**: SELECT queries
- **`insert.ts`**: INSERT operations
- **`update.ts`**: UPDATE operations
- **`delete.ts`**: DELETE operations
- and more...

#### CLI (`src/cli/`)

- **`index.ts`**: CLI entry point
- **`commands/`**: Individual CLI commands

## Development Workflow

### Environment Setup

1. **Setup Node.js**: Ensure Node.js 25+ is installed
2. **Install Dependencies**: Run `pnpm i`

### Available Scripts

- **`pnpm run lint`**: Run Biome linter
- **`pnpm run tsclint`**: Run TypeScript type checking `src/`
- **`pnpm run tsclint-cli`**: Run CLI TypeScript type checking `src/cli/`
- **`pnpm run tsclint-all`**: Run all checks (lint + tsclint + tsclint-cli + test-types)
- **`pnpm run test-types`**: Run only type tests `type-tests/`
- **`pnpm run test`**: Build src & cli and run integration tests `tests/`

### Development Process

1. **Code Changes**: Make changes to source files
2. **Type Validation**: Add if necessary, and ensure TypeScript compilation passes
3. **Testing**: Add if necessary, and run appropriate integration tests
4. **Linting**: Verify code quality with Biome
5. **Documentation**: Update documentation

## Testing Guide

Durcno uses two clearly separated test suites — **Type tests** and **Integration tests** — with distinct scope and rules.

- **Type tests (`type-tests/`)** — compile-time checks for TypeScript inference (use `Expect`,`Equal` / `@ts-expect-error`). Required for any change that affects exported types or API shapes.
- **Integration tests (`tests/`)** — runtime tests (Vitest) validating columns, query builders, SQL, migrations, and CLI behavior. Keep them deterministic, and fast.

Quick rules:

- Add **type tests** for type/API changes and run `pnpm run test-types`.
- Add **integration tests** for runtime behavior and run `pnpm run test`.
- Cover positive, negative, and edge cases.

Commands:

- `pnpm run test-types` — run "Type tests" in `type-tests/`
- `pnpm run test` — run all integration tests in `tests/`

> 💡 Tip: Run a single folder or file while running integration tests to speed feedback, by using `pnpm test tests/qb/my.test.ts`

---

### Type tests (type-tests/)

Purpose: Assert TypeScript behavior and inference (return types, input types, overloads).

When: REQUIRED for any change that alters types or public api in `src/`, exlcuding `src/cli`.

How:

- Write focused tests in `type-tests/` using `Expect<Equal<...>>`.
- Keep tests minimal: assert exact shapes rather than runtime behavior.
- Each test file must include both positive and negative type tests.
- **Comprehensive negative tests are essential** — ensure invalid usages are properly rejected by the type system.
- Place `// @ts-expect-error` **directly above the line that causes the error**, not above the entire statement.
- Use \_ prefix for unused variables in type tests.

Utilities: `type-tests/utils.ts`.

Examples:

```typescript
// ✅ Positive test: Assert return type
const q = db.from(Users).select();
type R = Awaited<typeof q>;
Expect<Equal<R, User[]>>();

// ❌ Negative test: Invalid usage (should not compile)
db.from(Users)
  .select()
  // @ts-expect-error: eq expects a column, not a string
  .where(eq("invalid", 123));
```

### Integration tests (tests/)

Integrations test are done using Vitest and Docker.

Purpose: Verify runtime behavior.

When: Changes in Queries, Columns, migrations, and CLI.

How:

- Use Vitest, `dockerode` and existing helpers.
- Keep tests deterministic and fast; prefer small focused cases.
- Use `runDurcnoCommand` function for CLI interactions.

Utilities: `tests/helpers.ts`, `tests/docker-utils.ts`.

### Before updating docs

1. Add or update **type tests**, then run `pnpm run test-types` (must pass).
2. Add or update **integration tests**, then run `pnpm run test` (must pass).
3. Update documentation **only after** tests pass.

## Documentation

Website is built using [Docusaurus 3.9](https://docusaurus.io/).

- Home is at `website/src/pages/index.tsx`
- Docs are in `website/docs`
- Blogs are in `website/blog`

**Important:** Do not touch `website/versioned_docs/` — unless you're explicitly told to do so. The term `docs` usually refers to `website/docs/`.

### Updating Documentation

**CRITICAL: Create and run related tests BEFORE updating documentation.** Never proceed to documentation if related tests are failing or incomplete.

**After adding or updating any API and successfully testing it**, you MUST update the documentation.

**Documentation workflow (STRICT ORDER - DO NOT SKIP STEPS)**:

1. Complete the feature implementation or modification
2. **Create type tests** in `type-tests/` for any feature affecting TypeScript types
3. **Run type tests** (`pnpm run test-types`) - must pass before continuing
4. **Create integration tests** in `tests/` for runtime behavior
5. **Run integration tests** (`pnpm run test`) - must pass before continuing
6. **Only after all tests pass** update the relevant documentation files with:
   - Clear usage examples with TypeScript code blocks
   - Type signatures where relevant

## Best Practices

### Naming Conventions

- **Tables**: PascalCase plural nouns (e.g., `Users`, not `User`)
- **Relations**: Use `Relations` suffix for relation objects (e.g., `UsersRelations`)

### Code Quality Standards

- **Type Safety**: Try not to use `any`, prefer `unknown` or proper type guards
- **Import Paths**: Use relative imports (e.g., `./common`, `../table`) in all TypeScript files within the root `src` folder.
- **Importing**: use `import type` for type imports and `import` for value imports
- **Code Documentation**: Add small and concise jsdoc comments to all internal functions, classes, and methods to improve code readability and maintainability.

## Guides

### Debugging & Troubleshooting

#### Common Issues

- **Type Errors**: Verify all exports are included in `src/index.ts`
- **Test failing**: First validate the test, then proceed to validate the core implementations

#### Debug Commands

- **Src Type Checking**: `pnpm run tsclint`
- **CLI Type Checking**: `pnpm run tsclint-cli`
- **All tsc checks**: `pnpm run tsclint-all`
- **Testing specific folder/file**: `pnpm test tests/cli/` or `pnpm test tests/qb/my.test.ts`

### Critical Reminders

#### When Adding/Modifying Features

- **All database operations must be type-safe**
- **Export all new public APIs from `src/index.ts`**
- **Maintain backward compatibility in public APIs**
- **Create/Update comprehensive type tests in `type-tests/`**
- **Ensure both positive and negative type tests**
- **Run type tests** (`pnpm run test-types`) - **MUST PASS**
- **Create/Update necessary integration tests in `tests/`**
- **Run integration tests** (`pnpm test`) - **MUST PASS**
- **Update documentation** - **AFTER RELATED TESTS PASS**

---

**Important :** Update this(AGENTS.md) file when you change anything mentioned here.