# Agent Instructions for this Codebase

## Table of Contents

1. Overview
2. Usage
3. Core Concepts
4. Project Structure
5. Development Workflow
6. Testing
7. Performance
8. Documentation
9. Best Practices
10. Guides

## Overview

This is **Durcno**. A PostgreSQL query builder and migration manager for TypeScript. It is designed around these core principles:

- **Intuitive**: Clean definitions and queries that map to PostgreSQL
- **Type-safe**: Full TypeScript inference across all operations
- **Runtime-safe**: Built-in validators for runtime data safety
- **Robust**: Auto generated, reversible, and squashable migrations

This is NOT a Drizzle-based project - it's a custom query builder and migration manager with its own unique patterns and conventions.

- **Language**: TypeScript
- **Package manager**: pnpm
- **Repository**: `github.com/durcno/durcno`
- **Website**: Docusaurus (https://durcno.dev)
- **License**: Apache-2.0

**Important**: Durcno only supports **PostgreSQL 14 and above**, **Node.js 24.14 and above**.

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
import { enumtype, notNull, pk, table, unique, varchar } from "durcno";

export { Migrations } from "durcno"; // Required for migrations tracking

export const UserTypeEnm = enumtype("public", "userType", ["admin", "user"]);

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
import config from "../durcno.config.ts";
import * as schema from "./schema.ts";

export const db = database(schema, config);
```

### Basic Queries

Executing type-safe queries:

```typescript
// Select all users
const users = await db.from(Users).select("*");

// Select specific columns with filter and ordering
const activeUsers = await db
  .from(Users)
  .select(() => ({ id: Users.id, name: Users.name }))
  .where(() => eq(Users.type, "user"))
  .orderBy(() => asc(Users.name));

// Insert a new user
await db.insertInto(Users).values({
  name: "John Doe",
  email: "john@example.com",
  type: "user",
});

// Update user
await db.update(Users).set({ name: "Jane Doe" }).where(eq(Users.id, 1n));
```

> **SELECT** takes a callback `(() => eq(...))`,
> while **UPDATE/DELETE** take the filter directly `(eq(...))`.

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

- `.select()` - Define columns to return (e.g. `select("*")` for all columns, or `select(() => ({ id: Users.id }))` for specific columns; use callback view `({ posts }) => ...` only for left-joined tables)
- `.where()` - Add filtering conditions; SELECT takes a callback (`() => eq(Users.type, "user")`), UPDATE/DELETE take the filter directly (`eq(Users.type, "user")`)
- `.orderBy()` - Sort results via callback (`() => asc(Users.name)` or `(_, { alias }) => asc(alias)`)
- `.groupBy()` - Group results via callback (`() => [Users.type]` or `(_, { alias }) => [alias]`)
- `.having()` - Filter grouped results via callback (`() => ...`)
- `.limit()` / `.offset()` - Paginate results

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

### Core Folders

```
src/
├── index.ts              # All public exports
├── columns/              # Column type implementations
├── query-builders/       # Query builder classes
├── filters/              # Filter builders
├── functions/            # SQL function builders
├── constraints/          # Constraint builders
├── connectors/           # Database connectors
├── migration/            # Migration handling
└── cli/                  # CLI entry and commands

type-tests/               # Inferred type safety checks
tests/                    # Runtime integration tests
├── columns/              # Column read/write tests
├── qb/                   # Query builders integration tests
├── unit/                 # No-database unit tests of internal helpers
├── cli/                  # CLI integration tests
perf/                     # Benchmarks of hot paths, plus A/B harnesses

website/                  # Website
├── src/                  # Pages and components
└── docs/                 # Documentation

scripts/                  # Utility scripts
dist/                     # Production compiled output
```

### Core Files

- **`src/index.ts`**: All public exports - **EXPORT NEW PUBLIC APIs HERE**
- **`src/db.ts`**: Query builder creator classes
- **`src/table.ts`**: Table and column types
- **`src/indexes.ts`**: Index definitions (`using`, `unique`, partial `where`, custom name)
- **`src/types.ts`**: Shared TypeScript utility types
- **`src/models.ts`**: Migration tracking table definition
- **`src/columns/common.ts`**: Base column class
- **`src/connectors/common.ts`**: Base connector class

## Development Workflow

### Environment Setup

1. **Setup Node.js**: Ensure Node.js 24.14+ is installed (see `engines.node` in `package.json`)
2. **Install Dependencies**: Run `pnpm i`

### Available Scripts

- **`pnpm run lint`**: Run Biome linter
- **`pnpm run format`**: Format with Biome + dprint + oxfmt
- **`pnpm run tsclint`**: Run TypeScript type checking `src/`
- **`pnpm run tsclint-cli`**: Run CLI TypeScript type checking `src/cli/`
- **`pnpm run tsclint-tests`**: Run TypeScript type checking `tests/`
- **`pnpm run tsclint-perf`**: Run TypeScript type checking `perf/`
- **`pnpm run test-types`**: Run only type tests `type-tests/`
- **`pnpm run tsclint-all`**: Run all type checks (tsclint + tsclint-cli + test-types + tsclint-tests + tsclint-perf)
- **`pnpm run build`**: Build `src/` (tsdown) and `cli/` (esbuild) into `dist/`
- **`pnpm run test`**: Build src & cli then run integration tests `tests/`
- **`pnpm test tests/cli/`**: Run a single folder/file of integration tests (requires Docker)
- **`pnpm bench`**: Build src then run the benchmarks in `perf/` (no Docker)

### Development Process

1. **Code Changes**: Make changes to source files
2. **Type Validation**: Add if necessary, and ensure TypeScript compilation passes
3. **Micro optimization**: Add if necessary, and run appropriate micro-optimization tests
4. **Testing**: Add if necessary, and run appropriate integration tests
5. **Linting**: Verify code quality with Biome
6. **Documentation**: Update documentation

## Testing

Durcno uses two clearly separated test suites — **Type tests** and **Integration tests** — with distinct scope and rules.

- **Type tests (`type-tests/`)** — compile-time checks for TypeScript inference (use `Expect`, `Equal` / `@ts-expect-error`). Things that are not practical for integration tests. Required for any change that affects exported types or API shapes.
- **Integration tests (`tests/`)** — runtime tests (Vitest) validating columns, query builders, migrations, and CLI behavior. Keep them deterministic, and fast.

Quick rules:

- Add/Update/Run **type tests** for type/API validation.
- Add/Update/Run **integration tests** for runtime behavior validation.
- Cover positive, negative, and edge cases
- Separate concerns, and avoid redundancy in tests
- Always import from `durcno` in tests; use relative imports only if not exported.

Commands:

- `pnpm run test-types` — runs "Type tests" in `type-tests/`
- `pnpm run test` — runs all integration tests in `tests/`

> 💡 Tip: Run a single folder or file while running integration tests to speed feedback,
> by using `pnpm test tests/cli/` or `pnpm test tests/qb/my.test.ts`

---

### Type tests (type-tests/)

Purpose: Assert TypeScript behavior, constrains, and inference (return types, input types, overloads).

When: Add/Update/Remove for any changes that alters types or public api in `src/`, excluding `src/cli`.

How:

- Keep tests minimal, assert exact shapes/constrains rather than runtime behavior.
- Place `// @ts-expect-error` **directly above the line that causes the error**, not above the entire statement.
- Use \_ prefix for unused variables in type tests.

Utilities: `type-tests/utils.ts`.

Examples:

```typescript
// ✅ Positive test: Assert return type
const q = db.from(Users).select("*");
type R = Awaited<typeof q>;
Expect<Equal<R, User[]>>();

// ❌ Negative test: Invalid usage (should not compile)
db.from(Users)
  .select("*")
  // @ts-expect-error: eq expects a column, not a string
  .where(() => eq("invalid", 123));
```

### Integration tests (tests/)

Integration tests are run using Vitest and Docker.

Purpose: Verify runtime behavior.

When: Add/Update/Remove for any changes that affects Schema, Columns, Queries, migrations, and CLI.

How:

- Use Vitest, `dockerode` and existing helpers.
- Keep tests deterministic and fast; prefer small focused cases.
- Use `runDurcno` function for CLI interactions.

Utilities: `tests/helpers.ts`, `tests/docker-utils.ts`.

## Performance

`perf/` holds benchmarks and A/B harnesses for the hot paths, with no database involved.

Purpose: Measure a hot-path change before shipping it, and keep the claim checkable.

When: Add/Update/Remove for any change to SQL generation, query construction, row conversion, or column encode/decode.

How:

- Keep one case per changed path, grouped by the **kind of optimization** it holds.
- `*.bench.ts` is the regression guard for a hot path; `*.ab.ts` answers what a single bench run cannot — build two `dist` snapshots and alternate them in one process, so a difference this small is not read as machine noise. `*.paths.ts` does the same for two bodies inside one build.
- Before shipping a micro-optimization with no measured gain, A/B both bodies in one process; revert what does not pay and keep the harness.
- Every harness opens with a header of 10-15 lines at the top of the file: what it measures, why the number isolates that, the fixture constraint that would make a run wrong, how to run it, and the sibling harnesses.

Utilities: `perf/schema.ts`, `perf/stub-connector.ts` — no database needed.

### Reading the numbers

- Throughput on a shared machine varies up to ~2× run to run: compare `min` across several runs, never a single one.
- **Never A/B by rebuilding and swapping `dist` between separate runs** — that is too noisy, it reports a real 20% regression as noise. Use the `.ab.ts` harnesses, which alternate both builds inside one sample loop.
- Flip the order each round: always finishing the second side last biases cases under ~2 µs by 5–10%, and those cases already sit at a ±5% noise floor.

Commands:

- `pnpm bench` — builds `src/` then runs the benchmarks in `perf/` (no Docker)
- `pnpm run tsclint-perf` — type-check `perf/`

## Documentation

Website is built using [Docusaurus 3.9](https://docusaurus.io/).

- Home is at `website/src/pages/index.tsx`
- Docs are in `website/docs`
- Blogs are in `website/blog`

**Important:** Do not touch `website/versioned_docs/` — unless you're explicitly told to do so. The term `docs` usually refers to `website/docs/`.

### When to update

- **New Features**: Added new public API or functionality
- **API Changes**: Modified existing public API (parameters, return types, behavior)
- **Bug Fixes**: Resolved issues that affect usage or behavior

### Pre-requisites

- All new features must be covered by type tests
- All new features must be covered by integration tests

## Best Practices

### Code Quality

- **Type Safety**: Try not to use `any`, prefer proper type guards or `unknown`
- **Import Paths**: Use relative imports (e.g., `./common`, `../table`) in all TypeScript files within the root `src` folder.
- **Importing**: Always use `type` modifier for type-only imports
- **Public API Exports**: Ensure all new public types, builders, functions, operators, and schemas are exported from `src/index.ts`
- **Feature & Architectural Parity**: Maintain consistency and parity across parallel query builders, column types, and filter builders
- **Arity Conventions**: Follow established where-clause conventions (callback `() => eq(...)` for SELECT, direct filter `eq(...)` for UPDATE/DELETE)
- **Code Documentation**:
  - Keep JSDoc and inline comments brief and scannable
  - State high-level intent (_what_) and crucial constraints (_why_)
  - Do not write essays or explain internal mechanics in exhaustive detail
  - Avoid narrating obvious code, step-by-step algorithms, or benchmark notes
- **Node builtins**: Prefix with `node:`
- **Don't append code at the end of files** — find the right place for it based on its purpose and related entities

### Code structuring

- **Files**: Group related files in the same folder (e.g., `src/columns`, `src/query-builders`)
- **Definitions**: Colocate entities in the same file that are closely related

### Naming Conventions

- **Tables**: PascalCase plural nouns (e.g., `Users`, not `User`)
- **Relations**: Use `Relations` suffix for relation objects (e.g., `UsersRelations`)

### Performance Considerations

- **Hot vs. Cold Paths**: Distinguish hot paths (`toSQL()`, `build()`, SQL generation, column encode/decode, `handleRows`) from cold paths (CLI, migrations, DDL). Focus performance optimizations on hot paths.
- **Memoization**: Cache fixed per-entity work in a `WeakMap` on the entity — tables and columns are per-schema singletons, so the cache is bounded and needs no invalidation. Never cache user-mutable state without documenting the staleness boundary.
- **SQL String Building**: Prefer direct `query.sql += ...` appends; avoid intermediate template literals or `.map(...).join()` allocations in compilation loops.
- **Loop Hoisting**: Hoist escaping repeated computations outside loops. An options object that is identical for every operand belongs outside the loop too.
- **Loop Form**: Use `for...of` when the index is unused; index only when it is load-bearing — an `i !== 0` separator, stepping **two arrays in lockstep**, calling `converts[i]`, reverse iteration, or a bound that is not the array's own length. Reaching a second array with a counter is a wash, and `forEach` over a captured accumulator measured ~2× the indexed loop (`perf/sql-loops.paths.ts`).
- **Clause Separators**: Emit `", "` (or `",\n"`, or `"), "`) at the **top** of a loop body, guarded by `if (i !== 0)`.
- **Hot-Path Allocations**: Avoid object/array spreads, unnecessary `.filter().map()` chains, and defensive copying on hot paths.

## Guides

### Debugging & Troubleshooting

#### Common Issues

- **Import Errors**: Verify all public APIs are exported in `src/index.ts`
- **Test failing**: First validate the test, then proceed to validate the core implementations

### Critical Reminders

#### When Adding/Modifying Features

- All database operations must be type-safe
- Export all new public APIs from `src/index.ts`
- Maintain backward compatibility in public APIs
- Create/Update comprehensive type tests in `type-tests/`
- Run type tests (`pnpm run test-types`) - MUST PASS
- Create/Update necessary integration tests in `tests/`
- Run integration tests (`pnpm test`) - MUST PASS
- Update documentation - AFTER RELATED TESTS PASS

---

**Important :** Update this (AGENTS.md) file when you change anything mentioned here.
