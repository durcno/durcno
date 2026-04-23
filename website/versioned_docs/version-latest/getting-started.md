---
sidebar_position: 2
---

# Getting Started

This guide will walk you through setting up Durcno in your TypeScript project and defining, migrating, and querying your database schema.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** => **24.12.0** / **Bun** => **1.2.0** / **Deno** => **2.7.0**
- A **PostgreSQL** database (Optional)

## Installation

Install Durcno using any package manager

```bash npm2yarn
npm install durcno@alpha
```

## Setup

### Quick Setup with `init` Command

The fastest way to get started is using the interactive `init` command:

```bash npm2yarn
npm exec durcno init
```

This command will prompt you to:

1. **Select a database connector** - Choose from `postgres` (postgres.js), `pg` (node-postgres), `bun` (Bun SQL) or `pglite` (WASM)
2. **Connection URL/PATH (Default: process.env.DATABASE_URL!)** - PostgreSQL/PGLite connection string
3. **Schema file** - Where to create the schema file (Default: `db/schema.ts`)
4. **Migrations folder** - Where to store migration files (Default: `migrations`)

After completion, it generates:

- `durcno.config.ts` - Durcno configuration
- `db/schema.ts` - A starter schema file with an example `Users` table
- `db/index.ts` - Database query API

:::tip
Use the `--force` flag to overwrite existing files.
:::

### Manual Setup

<details>
<summary>
Alternatively, you can manually setup Durcno in your project.
</summary>

#### 1. Create Configuration File

Create a `durcno.config.ts` file in your project root to define your database connection and project settings:

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";

export default defineConfig(pg(), {
  schema: "db/schema.ts", // Path to your schema file
  out: "migrations", // Directory for migration files
  dbCredentials: {
    url: "postgresql://postgres:password@localhost:5432/myapp",
  },
});
```

:::warning
Use environment variables for sensitive credentials:

```typescript
export default defineConfig(pg(), {
  schema: "db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
```

:::

#### 2. Define Your Schema

Create your schema file with table definitions:

```typescript
// db/schema.ts
import {
  table,
  pk,
  varchar,
  timestamp,
  enumtype,
  notNull,
  unique,
  now,
} from "durcno";

export { Migrations } from "durcno";

export const Users = table("public", "users", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  email: varchar({ length: 255, notNull, unique }),
  password: varchar({ length: 255, notNull }),
  createdAt: timestamp({ notNull }).default(now()),
});
```

#### 3. Set Up Database Connection

Create a database client instance:

```typescript
// db/index.ts
import { database } from "durcno";
import * as schema from "./schema.ts";
import setup from "../durcno.config.ts";

export const db = database(schema, setup);
```

</details>

## Your First Migration

### Generate Migration

After defining your schema, generate your first migration:

```bash npm2yarn
npm exec durcno generate
```

This creates a migration folder with:

- `up.ts` - DDL statements to apply the migration
- `down.ts` - DDL statements to rollback the migration

### Apply Migration

Apply the migration to your database:

```bash npm2yarn
npm exec durcno migrate
```

### Check Migration Status

View the status of all migrations:

```bash npm2yarn
npm exec durcno status
```

## Writing Your First Queries

Now you can start querying your database with full type safety:

### Insert Queries

```typescript
import { db } from "./db/index.ts";
import { Users } from "./db/schema.ts";

// Insert a single user
await db.insert(Users).values({
  username: "johndoe",
  email: "john@example.com",
  password: "password",
});

// Insert multiple users
await db.insert(Users).values([
  {
    username: "alice",
    email: "alice@example.com",
    password: "password1",
  },
  {
    username: "bob",
    email: "bob@example.com",
    password: "password2",
  },
]);
```

### Select Queries

```typescript
// Select all users
const allUsers = await db.from(Users).select();

// Select specific columns
const userNames = await db.from(Users).select({
  id: Users.id,
  username: Users.username,
});

// With conditions
import { eq } from "durcno";

const users = await db.from(Users).select().where(eq(Users.id, 1));
```

### Update Queries

```typescript
import { eq } from "durcno";

// Update user
await db
  .update(Users)
  .set({ password: "newpassword" })
  .where(eq(Users.username, "johndoe"));
```

### Delete Queries

```typescript
import { eq } from "durcno";

// Delete user
await db.delete(Users).where(eq(Users.username, "johndoe"));
```

## Working with Relations

Define relationships between tables:

```typescript
// db/schema.ts
import {
  table,
  pk,
  varchar,
  bigint,
  relations,
  many,
  one,
  notNull,
} from "durcno";

export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 255, notNull }),
});

// Users relations
export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.authorId),
}));

export const Posts = table("public", "posts", {
  id: pk(),
  title: varchar({ length: 255, notNull }),
  authorId: bigint({ notNull }).references(() => Users.id),
});

// Posts relations
export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.authorId, Users),
}));
```

## Next Steps

Now that you have Durcno set up, you can:

- Learn about [Schema](./Schema/overview) definitions for tables, enums, and etc
- Check out [Migrations Guide](./Migrations/overview) for handling migrations
- Discover [Query Builders](./CRUD/overview) for building queries

## Need Help?

- Report issues on [GitHub](https://github.com/durcno/durcno/issues)