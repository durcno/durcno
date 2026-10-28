---
name: durcno
description: Durcno usage guide for its PostgreSQL query builder and migration manager. Use when defining schemas, tables, columns, enums, relations or indexes, writing CRUD or relational queries, using joins, filters, aggregates, window functions, row locking, bulk updates, scalar subqueries, transactions, CTEs or prepared statements, validating input with Zod, generating and applying migrations, or running SQL through the Durcno CLI. Read the relevant doc files before writing or reviewing Durcno code.
---

# Durcno

A PostgreSQL query builder and migration manager for TypeScript. Everything below is the minimum you need; route to `docs/` for anything deeper.

## Documentation

`docs/` is a symlink to this project's `website/docs/`, so the skill always carries the current docs with no duplicated copies to drift. If your tooling does not follow symlinks and the directory looks empty, read the same files from `website/docs/`. `package.json` is likewise a symlink to the project's — read it to check the current version.

Directory names are case-sensitive (`CRUD/`, `Schema/`, `Expressions/`, `Validation/`, `Migrations/`, `Advanced/`, `Conventions/`, `Extensions/`, `Guides/`).

Read `docs/intro.md` first for the mental model, then read **only the files matching your task** — do not read all of `docs/`. When reading a doc file, ignore the YAML frontmatter (`sidebar_position`) and Docusaurus `:::note` / `:::tip` / `:::warning` admonition markers; they are site chrome, not part of the API.

### Task → file routing

| Working on                                                              | Read                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Column types, custom columns, sequences                                 | `docs/Schema/columns.md`, `docs/Schema/custom-columns.md`, `docs/Schema/sequences.md` |
| Enums                                                                   | `docs/Schema/enums.md`                                                                |
| Relations / eager loading                                               | `docs/Schema/relations.md`, `docs/CRUD/relational-query.md`                           |
| Indexes, constraints                                                    | `docs/Schema/indexes.md`, `docs/Schema/constraints.md`                                |
| SELECT, GROUP BY, HAVING, pagination, scalar subqueries                 | `docs/CRUD/select.md`                                                                 |
| Joins, left-join nullability                                            | `docs/CRUD/joins.md`                                                                  |
| Row locking (`FOR UPDATE`, `NOWAIT`, `SKIP LOCKED`)                     | `docs/CRUD/locking.md`                                                                |
| INSERT, conflict updates, `returning`                                   | `docs/CRUD/insert.md`                                                                 |
| UPDATE, bulk `UPDATE ... FROM`, values aliases, `returning`             | `docs/CRUD/update.md`                                                                 |
| DELETE, `returning`                                                     | `docs/CRUD/delete.md`                                                                 |
| Transactions                                                            | `docs/CRUD/transaction.md`                                                            |
| CTEs (`db.with()`)                                                      | `docs/CRUD/with.md`                                                                   |
| Prepared statements                                                     | `docs/CRUD/prepare.md`                                                                |
| Raw SQL                                                                 | `docs/CRUD/raw-sql.md`                                                                |
| `db.$count` / `$sum` / `$first` / etc.                                  | `docs/CRUD/query-shortcuts.md`                                                        |
| Filters (`eq`, `like`, `and`, …)                                        | `docs/Expressions/filters.md`                                                         |
| SQL functions, aggregates, window functions, `numNonNulls` / `numNulls` | `docs/Expressions/functions.md`                                                       |
| Zod validation                                                          | `docs/Validation/zod.md`                                                              |
| Config / connectors / logging                                           | `docs/configuration.md`, `docs/connectors.md`, `docs/Advanced/logger.md`              |
| CLI, migrations, migration options                                      | `docs/cli.md`, `docs/Migrations/`, `docs/Guides/concurrent-indexing.md`               |
| PostGIS / pgvector                                                      | `docs/Extensions/postgis.md`, `docs/Extensions/pgvector.md`                           |
| Naming and casing conventions                                           | `docs/Conventions/casing.md`                                                          |
| Type inference helpers                                                  | `docs/Advanced/types.md`                                                              |

## Configuration

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";

export default defineConfig({
  schema: "db/schema.ts",
  out: "migrations",
  connector: pg({ dbCredentials: { url: process.env.DATABASE_URL! } }),
});
```

Connector subpaths: `durcno/connectors/pg`, `durcno/connectors/postgres`, `durcno/connectors/bun`, `durcno/connectors/pglite`. Each accepts `dbCredentials` (or `url`/`host`/`port`/`user`/`password`), `pool`, `ssl`, and `logger` — see `docs/connectors.md`. PGlite v0.5 embeds PostgreSQL 18; data directories created by older PGlite versions must be recreated or dumped and restored.

## Schema Definition

```typescript
// db/schema.ts
import {
  bigint,
  enumtype,
  fk,
  index,
  many,
  notNull,
  pk,
  relations,
  table,
  unique,
  varchar,
} from "durcno";

export { Migrations } from "durcno"; // Required for migration tracking

export const UserTypeEnm = enumtype("public", "userType", ["admin", "user"]);

export const Posts = table(
  "public",
  "posts",
  {
    id: pk(),
    userId: bigint({ notNull }).references(() => Users.id),
    title: varchar({ length: 255, notNull }),
  },
  { indexes: (t) => [index([t.userId])] },
);

export const Users = table("public", "users", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  email: varchar({ length: 255, notNull, unique }),
  type: UserTypeEnm.enumed({ notNull }),
});

// Relations use a lazy callback, so forward references are fine.
export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));

export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users), // many-to-one
  // profile: one(UserProfiles, UserProfiles.userId), // one-to-one
}));
```

Notes:

- Naming: tables are PascalCase plurals, relations use the `Relations` suffix.
- `pk()` is a `bigint` identity column, so all ids are `bigint` at runtime and in TypeScript.
- Column helpers accept flags like `notNull`, `unique`, `references()`, `defaultTo()`, `generatedAlways()`.

## Database Connection

```typescript
// db/index.ts
import { database } from "durcno";
import config from "../durcno.config.ts";
import * as schema from "./schema.ts";

export const db = database(schema, config);
```

## Queries

```typescript
import { asc, count, desc, eq, gte } from "durcno";
import { db } from "./db/index.ts";
import { Posts, Users } from "./db/schema.ts";

// Select all
const users = await db.from(Users).select("*");
// Type: { id: bigint; name: string; email: string; type: "admin" | "user" }[]

// Select specific columns, filter, order
const activeUsers = await db
  .from(Users)
  .select(() => ({ id: Users.id, name: Users.name }))
  .where(() => eq(Users.type, "user"))
  .orderBy(() => asc(Users.name));

// Aggregate, group, filter groups, order by alias, paginate
const byType = await db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => [Users.type])
  .having(() => gte(count("*"), 2))
  .orderBy((_, { total }) => desc(total))
  .limit(10)
  .offset(20);

// Insert / update / delete — ids are bigint, use `1n` not `1`
const created = await db
  .insertInto(Users)
  .values({ name: "Jane", email: "jane@example.com", type: "user" })
  .returning({ id: true });

await db.update(Users).set({ name: "Jane Doe" }).where(eq(Users.id, 1n));
await db.deleteFrom(Users).where(eq(Users.id, 1n));
```

### Where-clause arity — read this before writing filters

| Builder                                     | `where()` argument          |
| ------------------------------------------- | --------------------------- |
| `db.from(...).select(...)`                  | callback — `() => eq(...)`  |
| `db.update(...)`, `db.deleteFrom(...)`      | filter — `eq(...)` directly |
| `db.query(T).findMany/findFirst({ where })` | filter — `eq(...)` directly |
| `db.$count/$exists/$first/$sum/...`         | filter — `eq(...)` directly |

### Joins

Base and inner-joined tables are referenced directly. **Only left-joined tables** are destructured from the `select` callback parameter, and their columns are inferred as nullable.

```typescript
// innerJoin — direct column references
const postsByAuthor = await db
  .from(Users)
  .innerJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .select(() => ({ name: Users.name, title: Posts.title }));

// leftJoin — destructure the joined table, columns are `| null`
const authorsAndPosts = await db
  .from(Users)
  .leftJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({ name: Users.name, postTitle: posts.title }));
// Type: { name: string; postTitle: string | null }[]
```

### Relational queries

`findMany` / `findFirst` take an options object. `where` and `orderBy` are **direct values, not callbacks**; `columns` (include with `true` or exclude with `false` — never mixed) and `select` (aliased projections) are mutually exclusive at each level.

```typescript
const usersWithPosts = await db.query(Users).findMany({
  where: eq(Users.type, "user"),
  orderBy: asc(Users.name),
  with: {
    posts: {
      columns: { id: true, title: true },
      orderBy: desc(Posts.title),
      limit: 5,
    },
  },
});

const oneUser = await db.query(Users).findFirst({ where: eq(Users.id, 1n) });
// Type: { ... } | null
```

`where` / `orderBy` / `limit` / `offset` inside a `with` block are only available on `many` relations, not on `fk` or `one`. See `docs/CRUD/relational-query.md`.

### Scalar subqueries

A single-column `db.from(...).select(...)` query is a scalar expression: it can be projected, used in an insert `values()` or update `set()` payload, compared, or passed to a SQL function. The value is typed `T | null`, because a scalar subquery returns `NULL` when it has no row.

```typescript
const users = await db.from(Users).select(() => ({
  id: Users.id,
  postCount: db
    .from(Posts)
    .select(() => ({ total: count("*") }))
    .where(() => eq(Posts.userId, Users.id)),
}));
// postCount: number | null
```

The subquery must select exactly one column. Use `.limit(1)` for non-aggregate row subqueries, and wrap the value in `coalesce(...)` when the target cannot be `null`. Aggregates inside a subquery stay scoped to it and out of the outer `GROUP BY`.

### Window functions

Aggregates and pure window functions accept `.over(spec)`. The spec carries `partitionBy`, `orderBy`, and a `frame`; window calls never trigger the automatic `GROUP BY`.

```typescript
import { asc, count, rowNumber, rows, unboundedPreceding } from "durcno";

const posts = await db.from(Posts).select(() => ({
  id: Posts.id,
  grandTotal: count("*").over(),
  authorTotal: count("*").over({ partitionBy: [Posts.userId] }),
  position: rowNumber().over({
    partitionBy: [Posts.userId],
    orderBy: [asc(Posts.id)],
    frame: rows(unboundedPreceding()),
  }),
}));
```

Pure window functions: `rowNumber`, `rank`, `denseRank`, `percentRank`, `cumeDist`, `ntile`, `lag`, `lead`, `firstValue`, `lastValue`, `nthValue`. Frames use `rows`/`range`/`groups` with `unboundedPreceding`, `preceding(n)`, `currentRow`, `following(n)`, `unboundedFollowing`. An aggregate's inline `.orderBy()` cannot be combined with `.over()`; move the ordering into the spec. Window expressions are rejected in `WHERE`, `ON`, `GROUP BY`, and insert/`set` values, like aggregates.

### Bulk updates (`UPDATE ... FROM`)

`update().from()` accepts tables, CTEs, and typed values aliases. `.from()` must be chained before `.set()`; repeated calls append sources.

```typescript
const V = db.values("v", { id: Users.id, email: Users.email }).as([
  { id: 1n, email: "a@example.com" },
  { id: 2n, email: "b@example.com" },
]);

await db
  .update(Users)
  .from(V)
  .set({ email: V.email })
  .where(eq(Users.id, V.id));
```

Each alias column wraps a source column (or a fresh column definition), so cells are type-checked and encoded with the source column's SQL type. `undefined` cells render `NULL`; an alias with no rows throws when the statement is built. `returning()` returns rows of the updated table only. A `FROM` source cannot alias the updated table; use a values alias or a CTE for self-joins.

### Row locking

`SELECT` supports `.forUpdate()`, `.forNoKeyUpdate()`, `.forShare()`, and `.forKeyShare()`. All accept `{ of, noWait, skipLocked }`; `noWait` and `skipLocked` are mutually exclusive. A query holds at most one locking clause, and the methods disappear after `groupBy`/`having`. The clause is emitted after `limit`/`offset` regardless of call order. Locks only matter inside a transaction.

```typescript
const [next] = await db.transaction(async (tx) => {
  return await tx
    .from(Users)
    .select("*")
    .forUpdate({ skipLocked: true })
    .limit(1);
});
```

Use `of` to lock only named `FROM`/`JOIN` tables, e.g. `.forUpdate({ of: [Posts] })`.

### Transactions, shortcuts, CTEs, prepared queries

```typescript
await db.transaction(async (tx) => {
  const user = await tx
    .insertInto(Users)
    .values({ name: "A", email: "a@x.com", type: "user" })
    .returning({ id: true });
  await tx.insertInto(Posts).values({ userId: user.id, title: "Hi" });
}); // throwing inside rolls back

const total = await db.$count(Users, eq(Users.type, "user"));
const names = await db.$distinct(Users, Users.name);
const latest = await db.$first(Users, eq(Users.type, "admin")); // row | null
```

CTEs are declared with `db.with(name).as(query)` and then attached to the outer query with `db.with(cte)`, passing the CTE itself to `.from()`:

```typescript
const activeUsers = db.with("activeUsers").as(
  db
    .from(Users)
    .select(() => ({ id: Users.id, name: Users.name }))
    .where(() => eq(Users.type, "user")),
);

const rows = await db.with(activeUsers).from(activeUsers).select("*");
```

`prepare()` compiles SQL once and re-runs it with different args:

```typescript
import { prepare } from "durcno";

const findByEmail = prepare({ email: Users.email.arg() }, (args) =>
  db
    .prepare()
    .from(Users)
    .select("*")
    .where(() => eq(Users.email, args.email)));

const rows = await findByEmail.run(db, { email: "jane@example.com" });
```

`$insertFn` / `$updateFn` generated values are produced on every `.run()` and bound as query arguments, so the SQL text stays stable while generated values stay unique.

`db.raw(sql, args?, rowsHandler?)` executes literal SQL with `$1`-style placeholders, returning the rows unchanged when `rowsHandler` is omitted.

### Query promises

Every builder is a `QueryPromise<T>`: it is a real `Promise<T>` (so `await`, `.then`, `.catch`, `.finally` all work) and additionally exposes `.toQuery()`, which returns `{ sql, arguments }` for debugging.

## Validation

Generate Zod schemas from table definitions. Import from the `durcno/validators/zod` subpath.

```typescript
import { createInsertSchema, createUpdateSchema } from "durcno/validators/zod";
import { db } from "./db/index.ts";
import { Users } from "./db/schema.ts";

const insertUserSchema = createInsertSchema(Users, {
  email: (f) => f.email(), // refine a column
});
const updateUserSchema = createUpdateSchema(Users);

const result = insertUserSchema.safeParse({
  name: "Jane",
  email: "jane@example.com",
  type: "user",
});

if (!result.success) {
  throw new Error(result.error.issues[0].message);
}

const inserted = await db.insertInto(Users).values(result.data).returning("*");
```

Semantics: `createInsertSchema` omits always-generated columns (e.g. `pk()`), makes columns with defaults/insert functions optional, and marks nullable columns as `.nullable().optional()`. `createUpdateSchema` drops primary keys and makes every field optional.

## Migrations

`durcno.config.ts` `schema` points at the schema file, and the schema must re-export `Migrations`.

```sh
durcno status               # Check which migrations are applied
durcno generate             # Diff the schema and write a new migration
durcno migrate              # Apply pending migrations
durcno down <migration>     # Roll back a specific migration
durcno squash <start> <end> # Squash a range into one
```

Run `generate` after every schema change, then `migrate`.

Each migration folder has a `up.ts` and `down.ts` file.

## Running SQL

Use `durcno exec` to run SQL against the configured database without opening a REPL. Prefer it over `psql`: it uses the connector and credentials from `durcno.config.ts`.

```sh
durcno exec -c 'select * from "public"."users" limit 5' --json   # one-shot
durcno exec -f db/seed.sql                                       # run a file
cat db/seed.sql | durcno exec --json                             # piped script
durcno exec -c '\dt' --json                                      # meta command
```

Statements run sequentially and stop at the first error. Exit code is `0` on success and `1` on failure; data goes to stdout and errors to stderr. `--json` prints one JSON array for the whole run (64-bit integers as strings, `[]` for DDL-only), and `-q` suppresses timings and row counts. `durcno repl` opens an interactive REPL when a human is at the keyboard.

## Query Logging

```typescript
import { pg } from "durcno/connectors/pg";
import { createQueryLogger } from "durcno/logger";

export default defineConfig({
  schema: "db/schema.ts",
  connector: pg({
    dbCredentials: { url: process.env.DATABASE_URL! },
    logger: createQueryLogger(),
  }),
});
```

Any object with `info(message, meta?)` and `error(message, meta?)` satisfies the `QueryLogger` interface — Winston, Pino, or a custom object.

## Requirements

PostgreSQL 14+ and Node.js 24.14+. Durcno targets Postgres semantics — prefer SQL features over application-side workarounds, and let the type system reject invalid SQL rather than casting around it.
