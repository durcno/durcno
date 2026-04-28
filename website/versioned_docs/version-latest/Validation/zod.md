---
sidebar_position: 1
---

# Zod

Durcno provides built-in support for generating [Zod](https://zod.dev/) validation schemas from your table definitions. This enables you to validate data before inserting or updating records in your database, ensuring type safety at both compile-time and runtime.

## Overview

Durcno provides two main functions for Zod validation:

- **`createInsertSchema(table, refine?)`**: Generates a Zod schema for INSERT operations
- **`createUpdateSchema(table, refine?)`**: Generates a Zod schema for UPDATE operations

Both functions automatically infer the correct schema based on your table's column definitions, handling nullability, defaults, and generated columns appropriately.

```typescript
import { createInsertSchema, createUpdateSchema } from "durcno/validators/zod";
import { Users } from "./schema.ts";

// Generate schemas from your table definition
const insertUserSchema = createInsertSchema(Users);
const updateUserSchema = createUpdateSchema(Users);
```

## Insert Schema

The `createInsertSchema` function creates a Zod schema optimized for INSERT operations. It automatically:

- **Excludes** columns with `GENERATED ALWAYS` (like primary keys with `pk()`)
- **Makes optional** columns that have defaults, default functions, or are nullable
- **Requires** columns that are `notNull` without defaults

```typescript
import {
  table,
  pk,
  varchar,
  timestamp,
  boolean,
  now,
  notNull,
  unique,
} from "durcno";
import { createInsertSchema } from "durcno/validators/zod";

const Users = table("public", "users", {
  id: pk(), // Excluded (GENERATED ALWAYS)
  email: varchar({ length: 255, notNull, unique }), // Required
  username: varchar({ length: 50, notNull }), // Required
  bio: varchar({ length: 500 }), // Optional (nullable)
  isActive: boolean({ notNull }).default(true), // Optional (has default)
  createdAt: timestamp({ notNull }).default(now()), // Optional (has default)
});

const insertSchema = createInsertSchema(Users);

// Validate input data
const result = insertSchema.safeParse({
  email: "user@example.com",
  username: "johndoe",
});

if (result.success) {
  await db.insert(Users).values(result.data);
} else {
  console.error(result.error.issues);
}
```

### Insert Schema Rules

| Column Configuration      | Schema Result        |
| ------------------------- | -------------------- |
| `pk()` (GENERATED ALWAYS) | Excluded from schema |
| `notNull` without default | Required             |
| `notNull` with default    | Optional             |
| Nullable (no `notNull`)   | Optional             |
| Has `.$insertFn()`        | Optional             |
| `generated: "BY DEFAULT"` | Optional             |

## Update Schema

The `createUpdateSchema` function creates a Zod schema optimized for UPDATE operations. It automatically:

- **Excludes** primary key columns (you typically don't update PKs)
- **Makes all fields optional** (partial updates are common)
- **Allows null** for nullable columns

```typescript
import { createUpdateSchema } from "durcno/validators/zod";
import { Users } from "./schema.ts";

const updateSchema = createUpdateSchema(Users);

// Validate partial update data
const result = updateSchema.safeParse({
  username: "newusername",
  bio: null, // Can set nullable fields to null
});

if (result.success) {
  await db.update(Users).set(result.data).where(eq(Users.id, 1n));
}
```

### Update Schema Rules

| Column Configuration | Schema Result         |
| -------------------- | --------------------- |
| Primary key (`pk()`) | Excluded from schema  |
| `notNull` column     | Optional              |
| Nullable column      | Optional and Nullable |

## Refining Schemas

Both `createInsertSchema` and `createUpdateSchema` accept an optional `refine` parameter that allows you to customize the generated Zod schema for specific columns.

The refine object maps column names to functions that receive the column's base Zod type and return a modified Zod type:

```typescript
import { createInsertSchema } from "durcno/validators/zod";
import { Users } from "./schema.ts";

const insertSchema = createInsertSchema(Users, {
  // Add email validation
  email: (zodType) => zodType.email("Invalid email address"),

  // Add minimum length validation
  username: (zodType) =>
    zodType.min(3, "Username must be at least 3 characters"),

  // Add custom regex validation
  bio: (zodType) => zodType.max(500, "Bio cannot exceed 500 characters"),
});

const result = insertSchema.safeParse({
  email: "invalid-email", // Will fail validation
  username: "ab", // Will fail validation
});
```

### Refine Function Signature

```typescript
type RefineFunction = (baseZodType: z.ZodType) => z.ZodType;
```

Each refine function receives the column's base Zod type (e.g., `z.string()` for varchar columns) and should return a Zod type with additional validations applied.

## Type Inference

The generated schemas are fully typed, allowing you to infer TypeScript types from them:

```typescript
import { z } from "zod";
import { createInsertSchema, createUpdateSchema } from "durcno/validators/zod";
import { Users } from "./schema.ts";

const insertSchema = createInsertSchema(Users);
const updateSchema = createUpdateSchema(Users);

// Infer types from schemas
type InsertUser = z.infer<typeof insertSchema>;
type UpdateUser = z.infer<typeof updateSchema>;

// Use the inferred types
function createUser(data: InsertUser) {
  return db.insert(Users).values(data);
}

function updateUser(id: bigint, data: UpdateUser) {
  return db.update(Users).set(data).where(eq(Users.id, id));
}
```

## Working with Enums

Enum columns are automatically converted to Zod enums with the correct literal types:

```typescript
import { table, pk, varchar, enumtype, notNull } from "durcno";
import { createInsertSchema } from "durcno/validators/zod";

const UserRole = enumtype("public", "user_role", [
  "admin",
  "moderator",
  "user",
]);

const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, notNull }),
  role: UserRole.enumed({ notNull }),
});

const insertSchema = createInsertSchema(Users);

// TypeScript knows role must be "admin" | "moderator" | "user"
insertSchema.parse({
  username: "johndoe",
  role: "admin", // ✓ Valid
});

insertSchema.parse({
  username: "johndoe",
  role: "superuser", // ✗ Will throw - not a valid enum value
});
```

## API Reference

### `createInsertSchema(table, refine?)`

Generates a Zod schema for validating INSERT operation data.

**Parameters:**

- `table`: A table definition created with `table()`
- `refine` (optional): An object mapping column names to refine functions

**Returns:** A `z.ZodObject` schema with appropriate required/optional fields

### `createUpdateSchema(table, refine?)`

Generates a Zod schema for validating UPDATE operation data.

**Parameters:**

- `table`: A table definition created with `table()`
- `refine` (optional): An object mapping column names to refine functions

**Returns:** A `z.ZodObject` schema with all fields optional

## Best Practices

### Validate Before Database Operations

Always validate user input before passing it to database operations:

```typescript
import { createInsertSchema } from "durcno/validators/zod";
import { Users } from "./schema.ts";

const insertSchema = createInsertSchema(Users);

async function handleCreateUser(input: unknown) {
  const result = insertSchema.safeParse(input);

  if (!result.success) {
    throw new Error(`Validation failed: ${result.error.message}`);
  }

  return db.insert(Users).values(result.data);
}
```

### Create Reusable Schemas

Define schemas once and reuse them across your application:

```typescript
// schemas/user.ts
import { createInsertSchema, createUpdateSchema } from "durcno/validators/zod";
import { Users } from "../db/schema";

export const insertUserSchema = createInsertSchema(Users, {
  email: (z) => z.email(),
  username: (z) => z.min(3).max(50),
});

export const updateUserSchema = createUpdateSchema(Users, {
  email: (z) => z.email(),
  username: (z) => z.min(3).max(50),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
```