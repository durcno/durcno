---
name: durcno
description: "Durcno usage guide. Use when: defining schemas, writing queries, validating data, and managing migrations."
---

# Durcno

A PostgreSQL query builder and migration manager for TypeScript.

## Documentation

Full reference documentation is symlinked in the `docs/` directory alongside this skill file. Read the relevant doc files **before** writing or reviewing any Durcno code. The `package.json` file is also symlinked alongside, so that the package metadata is available for inspection.

| Path                      | Contents                                    |
| ------------------------- | ------------------------------------------- |
| `docs/intro.md`           | Overview and core concepts                  |
| `docs/getting-started.md` | Installation and first steps                |
| `docs/configuration.md`   | `defineConfig` options                      |
| `docs/connectors.md`      | Database connector setup                    |
| `docs/cli.md`             | CLI commands reference                      |
| `docs/Schema/`            | Table, column, enum, index, constraint, etc |
| `docs/CRUD/`              | Select, insert, update, delete, etc queries |
| `docs/Expressions/`       | Functions and filters                       |
| `docs/Migrations/`        | Migration generation, applying, rollback    |
| `docs/Validation/`        | Runtime data validators                     |
| `docs/Guides/`            | How-to guides and recipes                   |
| `docs/Advanced/`          | Query logging, etc                          |
| `docs/Conventions/`       | Naming and casing conventions               |
| `docs/Extensions/`        | PostGIS and pgvector extensions             |

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

## Schema Definition

```typescript
// db/schema.ts
import {
  table,
  pk,
  varchar,
  bigint,
  enumtype,
  notNull,
  unique,
  relations,
  many,
  fk,
} from "durcno";

export { Migrations } from "durcno"; // Required for migration tracking

export const UserTypeEnm = enumtype("public", "userType", ["admin", "user"]);

export const Users = table("public", "users", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  email: varchar({ length: 255, notNull, unique }),
  type: UserTypeEnm.enumed({ notNull }),
});

export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));

export const Posts = table("public", "posts", {
  id: pk(),
  userId: bigint({ notNull }).references(() => Users.id),
  title: varchar({ length: 255, notNull }),
});

export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users),
}));
```

## Database Connection

```typescript
// db/index.ts
import { database } from "durcno";
import * as schema from "./schema.ts";
import config from "../durcno.config.ts";

export const db = database(schema, config);
```

## Queries

```typescript
// Select all
const users = await db.from(Users).select("*");
// Type: { id: bigint; name: string; email: string; type: "admin" | "user" }[]

// Select specific columns with filter and ordering (use direct table references for non-left-joined tables)
const activeUsers = await db
  .from(Users)
  .select(() => ({ id: Users.id, name: Users.name }))
  .where(() => eq(Users.type, "user"))
  .orderBy(() => asc(Users.name));
// Note: Use callback parameter ({ posts }) => ... only for left-joined tables to infer nullable columns

// Relational query
const usersWithPosts = await db.query(Users).findMany({
  with: {
    posts: {},
  },
});
// Type: { id: bigint; name: string; email: string; type: "admin" | "user"; posts: { id: bigint; userId: bigint; title: string }[] }[]

// Insert
await db
  .insertInto(Users)
  .values({ name: "Jane", email: "jane@example.com", type: "user" });

// Update
await db.update(Users).set({ name: "Jane Doe" }).where(eq(Users.id, 1));

// Delete
await db.deleteFrom(Users).where(eq(Users.id, 1));
```

## Validation

Generate Zod schemas from table definitions for runtime data validation:

```typescript
import { createInsertSchema, createUpdateSchema } from "durcno/validators/zod";
import { Users } from "./schema.ts";

const insertUserSchema = createInsertSchema(Users, {
  email: (f) => f.email(),
});
const updateUserSchema = createUpdateSchema(Users);

// Validate input before database operations
const result = insertUserSchema.safeParse({
  name: "Jane",
  email: "jane@example.com",
  type: "user",
});

if (result.success) {
  await db.insertInto(Users).values(result.data);
}
```

## Migrations

After every schema change, run generate then migrate in order:

```sh
durcno generate              # Generate migration from schema changes
durcno migrate               # Apply pending migrations
durcno down <migration>      # Rollback a specific migration
durcno squash <start> <end>  # Squash a range of migrations into one
durcno status                # Show all migrations status
```