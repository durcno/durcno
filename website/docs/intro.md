---
sidebar_position: 1
---

# Introduction

**Durcno** is a PostgreSQL Query Builder and Migration Manager for TypeScript designed around three core principles:

- **Intuitive Abstraction**: Clean definitions and queries that map to PostgreSQL
- **Type Safety**: Maximum TypeScript inference across all operations
- **Migration Management**: Auto generated, reversible, and squashable migrations

## Why Durcno?

Durcno provides a modern, type-safe approach to working with PostgreSQL databases in TypeScript applications. Unlike traditional ORMs, Durcno prioritizes developer experience with intuitive APIs, comprehensive type safety and robust migration management.

### 🧩 Intuitive Abstraction

Define your database schema using clean, type-safe table definitions that map directly to PostgreSQL columns:

```typescript
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

// Define an enum type for user roles
export const UserRole = enumtype("public", "user_role", [
  "admin",
  "moderator",
  "user",
]);

// Create a fully-typed Users table
export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, notNull, unique }),
  email: varchar({ length: 255, notNull, unique }),
  role: UserRole.enumed({ notNull }).default("user"),
  createdAt: timestamp({ notNull }).default(now()),
});
```

Every column type maps naturally to PostgreSQL types, and TypeScript automatically infers the correct types for all your queries. No decorators, no magic—just clean, declarative code with configuration objects.

### 🎯 Type Safety First

Every query & the return,

```typescript
// TypeScript knows exactly what columns and types are available
const users = await db.from(Users).select({
  id: Users.id, // type: number
  username: Users.username, // type: string
  email: Users.email, // type: string
  role: Users.role, // type: "admin" | "moderator" | "user"
});
// Result type: { id: number; username: string; email: string; role: "admin" | "moderator" | "user" }[]

// TypeScript prevents invalid operations
await db.insert(Users).values({
  username: "john_doe",
  email: "john@example.com",
  role: "staff", // ❌ TypeScript error: Type '"staff"' is not assignable to type '"admin" | "moderator" | "user"'
});
```

With Durcno, your IDE becomes your most powerful debugging tool, catching mistakes before you even run your code.

### 📦 Migration Management

No separate migration tool needed. Durcno includes a powerful CLI that automatically generates migrations by comparing your schema definitions with your database:

```bash
# Generate migrations from schema changes
durcno generate
# Creates timestamped migration with up.ts and down.ts

# Apply pending migrations
durcno migrate
# Executes all pending migrations in order

# Rollback specific migration
durcno down <migration-name>
# Safely rolls back changes with down.ts (exports rollback DDL statements)

# View migration status
durcno status
# See which migrations are applied or pending

# Squash a range of migrations into one
durcno squash <start-migration> <end-migration>
```

Durcno tracks your schema changes automatically, so you can focus on building features instead of writing SQL migration scripts by hand.

## Features

- **Relation query** - Define and query table relationships
- **Multiple drivers** - Support for `pg`, `postgres`, `bun`, and `pglite` drivers
- **PostGIS support** - Built-in geographic column types

## Next Steps

Ready to get started? Check out the [Getting Started](./getting-started) guide to set up your first Durcno project.