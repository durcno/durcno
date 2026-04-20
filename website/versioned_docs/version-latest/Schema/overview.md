---
sidebar_position: 0
---

# Overview

The schema is the foundation of your Durcno application. It defines your database structure using type-safe TypeScript code that maps directly to PostgreSQL tables, columns, and relationships.

## What is a Schema?

A schema in Durcno consists of:

1. **Tables**: The core structure that holds your data
2. **Columns**: Type-safe field definitions with constraints
3. **Enum Types**: Custom enumerated types for constrained values
4. **Relations**: Type-safe relationships between tables

## Quick Example

Here's a complete schema example showing all components:

```typescript
import {
  table,
  pk,
  varchar,
  bigint,
  timestamp,
  enumtype,
  relations,
  many,
  one,
  index,
  uniqueIndex,
  notNull,
  unique,
  now,
} from "durcno";

// Define an enum
export const UserRole = enumtype("public", "user_role", ["admin", "user"]);

// Define tables
export const Users = table(
  "public",
  "users",
  {
    id: pk(),
    username: varchar({ length: 50, unique, notNull }),
    email: varchar({ length: 255, unique, notNull }),
    role: UserRole.enumed({ notNull }),
    createdAt: timestamp({ notNull }).default(now()),
  },
  {
    // Define indexes
    indexes: (t) => [index([t.email]), index([t.createdAt])],
  },
);

export const Posts = table(
  "public",
  "posts",
  {
    id: pk(),
    userId: bigint({ notNull }).references(() => Users.id),
    title: varchar({ length: 255, notNull }),
    createdAt: timestamp({ notNull }).default(now()),
  },
  {
    indexes: (t) => [index([t.userId]), index([t.userId, table.createdAt])],
  },
);

// Define relations
export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));

export const PostsRelations = relations(Posts, () => ({
  author: one(Users, Users.id),
}));
```

## Schema Organization

### File Structure

#### Single File (Small Projects)

```text
.
├── db/
│   ├── schema.ts         # All tables, relations, and indexes
│   └── index.ts          # Database instance exported as `db`
└── durcno.config.ts      # Configuration
```

```typescript
// db/schema.ts
export const Users = table(...);
export const Posts = table(...);
export const Comments = table(...);
export const UsersRelations = relations(...);
export const PostsRelations = relations(...);
```

#### Multiple Files (Large Projects)

```text
.
├── db/
│   ├── schema/
│   │   ├── users.ts      # User-related tables
│   │   ├── posts.ts      # Post-related tables
│   │   ├── comments.ts   # Comment-related tables
│   │   └── index.ts      # Re-export all tables
│   └── index.ts          # Database instance
└── durcno.config.ts      # Configuration
```

```typescript
// db/schema/users.ts
export const Users = table(...);
export const UsersRelations = relations(...);

// db/schema/posts.ts
export const Posts = table(...);
export const PostsRelations = relations(...);

// db/schema/index.ts
export * from "./users";
export * from "./posts";
export * from "./comments";
```

### Configuration

Update your `durcno.config.ts` to point to your schema:

```typescript
import { defineConfig } from "durcno";
import { PgConnector } from "durcno/connectors/pg";

// Single file
export default defineConfig(PgConnector, {
  schema: "db/schema.ts",
  // ...
});
```

## Schema Components

### 1. Tables

Tables are the primary building blocks of your schema. Each table groups a set of
columns together and defines the shape of a database relation.

```typescript
export const Users = table("public", "users", {
  id: pk(), // Primary key column
  username: varchar({ length: 50, notNull }),
  age: integer({}),
  isActive: boolean().default(true),
  createdAt: timestamp({ notNull }).default(now()),
});
```

[Learn more about Columns →](./columns.md)

### 2. Enum Types

Enum types define a set of allowed values for a column, providing compile-time validation.

```typescript
import { enumtype, table, pk, notNull } from "durcno";

export const UserRole = enumtype("public", "user_role", ["admin", "user"]);
export const Status = enumtype("public", "status", [
  "active",
  "inactive",
  "pending",
]);

export const Users = table("public", "users", {
  id: pk(),
  role: UserRole.enumed({ notNull }),
  status: Status.enumed({}), // nullable
});
```

[Learn more about Enum Types →](./enums.md)

### 3. Relations

Relations define type-safe relationships between tables.

```typescript
export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId), // One-to-many
  profile: one(UserProfiles, UserProfiles.userId), // One-to-one
}));

export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users), // One-to-one
}));
```

[Learn more about Relations →](./relations.md)

## Schema Lifecycle

### 1. Define Schema

Create your schema definitions in TypeScript:

```typescript
// db/schema.ts
import { table, pk, varchar, notNull } from "durcno";

export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, notNull }),
});
```

### 2. Generate Migration

Generate DDL migration statements by diffing the current schema against the last state.

```bash npm2yarn
npx durcno generate
```

This creates:

```text
migrations/
└── 2025-07-20T18-00-00.000Z/
    ├── up.ts    # Forward migration
    └── down.ts  # Rollback migration
```

### 3. Apply Migration

Apply the migration to your database:

```bash npm2yarn
npx durcno migrate
```

### 4. Use in Queries

Query your database with full type safety:

```typescript
import { database } from "durcno";
import * as schema from "./schema.ts";
import setup from "../durcno.config.ts";

const db = database(schema, setup);

const users = await db.from(schema.Users).select();
// Type: { id: bigint; username: string }[]
```

## Type Safety

Durcno provides complete TypeScript type inference throughout your schema:

```typescript
export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, notNull }),
  email: varchar({ length: 255 }),
  age: integer({}),
});

// TypeScript infers the types:
const users = await db.from(Users).select();
// Type: {
//   id: bigint;
//   username: string;
//   email: string | null;
//   age: number | null;
// }[]
```

### Nullable vs Non-Nullable

Columns are nullable by default. Use `notNull` for required fields:

```typescript
export const Users = table("public", "users", {
  id: pk(),
  required: varchar({ length: 50, notNull }), // string
  optional: varchar({ length: 50 }), // string | null
});
```

### Enum Type Safety

Enums provide compile-time validation:

```typescript
export const Status = enumtype("public", "status", ["active", "inactive"]);

export const Users = table("public", "users", {
  id: pk(),
  status: Status.enumed({ notNull }),
});

// TypeScript only allows valid values
await db.insert(Users).values({
  status: "active", // ✅ Valid
  status: "pending", // ❌ Type error
});
```

## Best Practices

### Follow Naming Conventions

```typescript
// Tables: PascalCase plural
export const Users = table("public", "users", {...});
export const BlogPosts = table("public", "blog_posts", {...});

// Columns: camelCase
export const Users = table("public", "users", {
  firstName: varchar({ length: 100 }),
  lastName: varchar({ length: 100 }),
});

// Relations: PascalCase with `Relations` suffix
export const UsersRelations = relations(Users, () => ({...}));
```

### Always Define Foreign Keys

When creating relations, always define foreign key constraints:

```typescript
// ✅ Good: Foreign key defined
export const Posts = table("public", "posts", {
  userId: bigint({ notNull }).references(() => Users.id),
});

export const PostsRelations = relations(Posts, () => ({
  author: one(Users, Users.id),
}));

// ❌ Incomplete: Relation without foreign key
export const Posts = table("public", "posts", {
  userId: bigint({ notNull }), // Missing references!
});

export const PostsRelations = relations(Posts, () => ({
  author: one(Users, Users.id),
}));
```

### Use `notNull` Explicitly

Be explicit about required vs optional fields:

```typescript
export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, notNull }), // Required
  email: varchar({ length: 255, notNull }), // Required
  bio: varchar({ length: 500 }), // Optional (nullable)
});
```

### Add Indexes for Performance

Index columns used in `WHERE`, `JOIN`, and `ORDER BY` clauses:

```typescript
export const Posts = table(
  "public",
  "posts",
  {
    id: pk(),
    userId: bigint({ notNull }),
    status: varchar({ length: 20, notNull }),
    createdAt: timestamp({ notNull }),
  },
  {
    indexes: (t) => [
      index([t.userId]), // Frequent joins
      index([t.status]), // Frequent WHERE clauses
      index([t.createdAt]), // Sorting
      index([t.userId, table.createdAt]), // Composite for complex queries
    ],
  },
);
```

## Common Patterns

### User Authentication

```typescript
export const UserRole = enumtype("public", "user_role", ["admin", "user"]);

export const Users = table("public", "users", {
  id: pk(),
  email: varchar({ length: 255, unique, notNull }),
  passwordHash: varchar({ length: 255, notNull }),
  role: UserRole.enumed({ notNull }).default("user"),
  createdAt: timestamp({ notNull }).default(now()),
});
```

### Soft Deletes

```typescript
export const Posts = table("public", "posts", {
  id: pk(),
  title: varchar({ length: 255, notNull }),
  deletedAt: timestamp({}),
});
```

### Timestamps

```typescript
export const Posts = table("public", "posts", {
  id: pk(),
  title: varchar({ length: 255, notNull }),
  createdAt: timestamp({ notNull }).default(now()),
  updatedAt: timestamp({ notNull })
    .default(now())
    .$updateFn(() => new Date()),
});
```

## Next Steps

- **[Columns](./columns.md)**: Learn about all available column types
- **[Enum Types](./enums.md)**: Define constrained value sets
- **[Relations](./relations.md)**: Define table relationships
- **[Migrations](../Migrations/overview.md)**: Manage schema changes over time