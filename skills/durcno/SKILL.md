---
name: durcno
description: Durcno usage guide for its PostgreSQL query builder and migration manager. Read first when defining schemas, tables, columns, enums, relations or indexes; writing CRUD, relational, aggregate or CTE queries; using filters, joins or transactions; validating with Zod; generating migrations; or running SQL through the CLI. Points to bundled docs for details.
---

# Durcno

[website](https://durcno.dev) · [GitHub](https://github.com/durcno/durcno) · [npm](https://www.npmjs.com/package/durcno)

Type-safe PostgreSQL query builder and migration manager for TypeScript. **This file is a decision map** — read "Choose the query shape" before writing any query, then open `docs/` (a symlink to `website/docs/`) for the full API.

## Choose the query shape first

| Need                                                  | Use                                                    | Why                                                         |
| ----------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------- |
| Rows plus related rows, filters, sorting, pagination  | `db.query(T).findMany/findFirst({ where, with, ... })` | One SQL statement, nested relations, no N+1                 |
| Explicit columns, aggregates, `GROUP BY`, joins, CTEs | `db.from(T).select(() => ({...}))`                     | Precise projection, full SQL control                        |
| One inline value per row (count, exists, latest row)  | scalar subquery in `select`, `values` or `set`         | No extra round-trip; stays inside the statement             |
| Several dependent steps you would otherwise `await`   | `db.with()` CTEs                                       | One round-trip; DML and reads in the same statement         |
| One-off count / exists / first / distinct / sum       | `$count`, `$exists`, `$first`, `$distinct`, `$sum`, …  | One call, no builder                                        |
| Atomic writes or row locks                            | `db.transaction(async tx => ...)`                      | Only when you need atomicity or `FOR UPDATE`-style locks    |
| SQL the builder cannot express                        | `db.raw()`                                             | Last resort — prefer SQL features over app-side workarounds |

**Default to one statement.** Every `await` is a round-trip; ids collected into a JS array and sent back in a second query are data the database could have joined itself. Reach for a CTE before writing sequential awaits.

## Prefer one statement

### Combine multi-step work with CTEs

Define with `db.with(name).as(query)`, attach with `db.with(cte)`, then use the CTE like a table. Its columns are typed from the query.

```typescript
import { db, eq, isIn } from "durcno";
import { Posts, Users } from "./db/schema.ts";

// ❌ Two round-trips; ids travel to the app only to be sent back.
const active = await db.from(Users).select("*").where(() =>
  eq(Users.status, "active")
);
const posts = await db
  .from(Posts)
  .select("*")
  .where(() => isIn(Posts.userId, active.map((u) => u.id)));

// ✅ One statement: the CTE is the shared filter.
const activeUsers = db.with("activeUsers").as(
  db
    .from(Users)
    .select(() => ({ id: Users.id, name: Users.name }))
    .where(() => eq(Users.status, "active")),
);

const rows = await db
  .with(activeUsers)
  .from(activeUsers)
  .leftJoin(Posts)
  .on(() => eq(Posts.userId, activeUsers.id))
  .select(({ posts }) => ({ name: activeUsers.name, title: posts.title }));
```

Chain CTEs by nesting `db.with(cte)` inside a later `.as()`, then attach all of them to the outer statement:

```typescript
const activeNames = db.with("activeNames").as(
  db
    .with(activeUsers)
    .from(activeUsers)
    .select(() => ({ name: activeUsers.name })),
);

const names = await db.with(activeUsers, activeNames).from(activeNames).select(
  "*",
);
```

CTEs can wrap DML with `.returning()`, so a write and the read of its result share one statement:

```typescript
const inserted = db.with("inserted").as(
  db
    .insertInto(Users)
    .values({ name: "Jane", email: "jane@example.com", type: "user" })
    .returning({ id: true, name: true }),
);

const rows = await db.with(inserted).from(inserted).select("*");
```

### Keep `db.query()` when relations are involved

`db.with(cte).query(T)` keeps the relational API while filtering by a CTE — you still get nested `with` loading in one statement:

```typescript
const users = await db
  .with(activeUsers)
  .query(Users)
  .findMany({
    where: isIn(
      Users.id,
      db.from(activeUsers).select(() => ({ id: activeUsers.id })),
    ),
    with: { posts: { columns: { id: true, title: true }, limit: 5 } },
  });
```

Use `exists(...)` for correlated checks in the same query. Prefer `db.query()` over manual joins when loading a graph of related rows; use `db.from().select()` when you need aggregates, grouping or exact column control.

### Inline aggregates as scalar subqueries

A single-column `db.from(...).select(...)` is a scalar expression anywhere a value is accepted — `select`, insert `values`, update `set`, comparisons, functions:

```typescript
import { asc, count, eq } from "durcno";

const users = await db.from(Users).select(() => ({
  id: Users.id,
  postCount: db
    .from(Posts)
    .select(() => ({ total: count("*") }))
    .where(() => eq(Posts.userId, Users.id)),
  firstPostTitle: db
    .from(Posts)
    .select(() => ({ title: Posts.title }))
    .where(() => eq(Posts.userId, Users.id))
    .orderBy(() => asc(Posts.id))
    .limit(1),
}));
// postCount: number | null; firstPostTitle: string | null
```

Select exactly one column. Non-aggregate row subqueries need `.limit(1)`. The type is `T | null` because no row means `NULL`; use SQL `coalesce(...)` (not JS `??`) when the projection must never be null. Aggregates inside a subquery stay scoped to it and do not affect the outer `GROUP BY`.

## Setup

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

Connector subpaths: `durcno/connectors/{pg,postgres,bun,pglite}`. Each accepts `dbCredentials` (or `url`/`host`/`port`/`user`/`password`), `pool`, `ssl`, `logger`. Prefer PGlite for embedded use.

```typescript
// db/schema.ts
import {
  bigint,
  enumtype,
  fk,
  many,
  notNull,
  pk,
  relations,
  table,
  varchar,
} from "durcno";

export { Migrations } from "durcno"; // Required for migration tracking

export const UserTypeEnm = enumtype("public", "userType", ["admin", "user"]);

export const Users = table("public", "users", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  email: varchar({ length: 255, notNull, unique }),
  type: UserTypeEnm.enumed({ notNull }),
});

export const Posts = table("public", "posts", {
  id: pk(),
  userId: bigint({ notNull }).references(() => Users.id),
  title: varchar({ length: 255, notNull }),
});

// Relations use a lazy callback, so forward references are fine.
export const UsersRelations = relations(
  Users,
  () => ({ posts: many(Posts, Posts.userId) }),
);
export const PostsRelations = relations(
  Posts,
  () => ({ author: fk(Posts.userId, Users) }),
);
```

```typescript
// db/index.ts
import { database } from "durcno";
import config from "../durcno.config.ts";
import * as schema from "./schema.ts";

export const db = database(schema, config);
```

## Rules that prevent bugs

- **`where` arity:** SELECT uses a callback — `.where(() => eq(...))`; `update`, `deleteFrom`, `db.query()` options and `$` shortcuts take the filter directly — `where: eq(...)` / `.where(eq(...))`.
- **Ids are `bigint`** (`pk()` is an identity bigint): compare with `1n`, not `1`.
- **Joins:** base and inner-joined tables are referenced directly; only left-joined tables are destructured from the `select` callback and their columns are `| null`.
- **`db.query()` options:** `where`/`orderBy`/`limit`/`offset` are values, not callbacks; `columns` (flags) and `select` (aliases) are mutually exclusive; nested filters work only on `many` relations, not `fk`/`one`.
- **CTEs:** attach with `db.with(cte)` before `.from()`/`.query()`/`.insertInto()`/`.update()`/`.deleteFrom()`; use the CTE as a `FROM` source, never as a write target. `returning()` aliases become CTE column names.
- **Window functions** use `.over({ partitionBy, orderBy, frame })` and never trigger `GROUP BY`; aggregates in `WHERE` are rejected.
- **Locking:** `.forUpdate()` / `.forNoKeyUpdate()` / `.forShare()` / `.forKeyShare()` accept `{ of, noWait, skipLocked }` and only matter inside a transaction.
- **Every builder is a `QueryPromise<T>`:** real `Promise` plus `.toQuery()` → `{ sql, arguments }` for debugging.

## Docs routing

`docs/` mirrors this project's `website/docs/`; directory names are case-sensitive (e.g. `CRUD/`, `Schema/`, `Expressions/`). If tooling does not follow symlinks, read `website/docs/` directly.

| Task                                            | Read                                                            |
| ----------------------------------------------- | --------------------------------------------------------------- |
| SELECT, grouping, pagination, scalar subqueries | `docs/CRUD/select.md`                                           |
| CTEs (`db.with()`)                              | `docs/CRUD/with.md`                                             |
| `db.query()`, relation loading                  | `docs/CRUD/relational-query.md`, `docs/Schema/relations.md`     |
| Joins, `jsonAgg`                                | `docs/CRUD/joins.md`                                            |
| INSERT / UPDATE / DELETE                        | `docs/CRUD/insert.md`, `update.md`, `delete.md`                 |
| Filters, SQL functions, window functions        | `docs/Expressions/`                                             |
| Columns, enums, indexes, custom columns         | `docs/Schema/`                                                  |
| Zod validation                                  | `docs/Validation/zod.md`                                        |
| Migrations, CLI                                 | `docs/Migrations/`, `docs/cli.md`                               |
| Config, connectors, logging, types              | `docs/configuration.md`, `docs/connectors.md`, `docs/Advanced/` |

## The rest

- **Validation:** `createInsertSchema` / `createUpdateSchema` from `durcno/validators/zod`; omit generated columns, defaulted columns optional, nullable columns `.nullable().optional()`.
- **Migrations:** `durcno status` → `generate` after every schema change → `migrate`; `down <migration>` and `squash <start> <end>` for rollback/history. Each migration folder has `up.ts` and `down.ts`. Rename prompts can be automated with `--rename-table old=new` / `--rename-column table.old=new` (or `--yes`).
- **Running SQL:** `durcno exec -c 'select ...' --json`, `-f file.sql`, or piped stdin — uses config credentials; prefer it over `psql`. `durcno repl` is for humans.
- **Logging:** pass `logger: createQueryLogger()` (from `durcno/logger`) to a connector; any object with `info(message, meta?)` and `error(message, meta?)` works.
- **Requirements:** PostgreSQL 14+ and Node.js 26.13+. Let the type system reject invalid SQL rather than casting around it.
