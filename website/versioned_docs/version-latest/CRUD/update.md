---
sidebar_position: 3
---

# Update

Use `db.update()` to modify existing rows in a table. The update builder provides type-safe column updates with filtering support.

## Methods

### Builder methods (UpdateBuilder)

| Method   | Description                     |
| -------- | ------------------------------- |
| `.set()` | Provide column values to update |

### Query methods (UpdateQuery)

| Method              | Description                            |
| ------------------- | -------------------------------------- |
| `.where(condition)` | Filter which rows are updated          |
| `.returning()`      | Specify columns to return after update |

## Basic Usage

### Update with WHERE

Always use `.where()` to specify which rows to update:

```typescript
import { db } from "./db/index.ts";
import { Users } from "./db/schema.ts";
import { eq } from "durcno";

// Update a specific user's email
await db
  .update(Users)
  .set({ email: "newemail@example.com" })
  .where(eq(Users.id, 1n));
```

### Update Multiple Columns

Pass multiple columns to `.set()`:

```typescript
await db
  .update(Users)
  .set({
    email: "updated@example.com",
    type: "admin",
  })
  .where(eq(Users.id, 1n));
```

:::warning
Without a `.where()` clause, the update will affect **all rows** in the table. Always include a filter unless you intend to update every row.
:::

## Partial Updates

All columns in `.set()` are optional—only specify the columns you want to change:

```typescript
// Only update the email, leave other columns unchanged
await db
  .update(Users)
  .set({ email: "new@example.com" })
  .where(eq(Users.id, 1n));
```

## Complex Filters

Use filter operators for complex conditions:

```typescript
import { and, eq, lte } from "durcno";

// Update all inactive users created before 2024
await db
  .update(Users)
  .set({ type: "user" })
  .where(
    and(eq(Users.type, "admin"), lte(Users.createdAt, new Date("2024-01-01"))),
  );
```

## Returning Updated Data

Use `.returning()` to get data back from updated rows:

```typescript
// Return specific columns
const updated = await db
  .update(Users)
  .set({ email: "updated@example.com" })
  .where(eq(Users.id, 1n))
  .returning({ id: true, email: true });
// Type: { id: bigint; email: string | null }[]

// Return all columns except some
const updated = await db
  .update(Users)
  .set({ email: "updated@example.com" })
  .where(eq(Users.id, 1n))
  .returning({ createdAt: false });
// Type: { id: bigint; username: string; email: string | null; type: "admin" | "user" }[]
```

### Without Returning

Without `.returning()`, the update returns `null`:

```typescript
const result = await db
  .update(Users)
  .set({ email: "updated@example.com" })
  .where(eq(Users.id, 1n));
// Type: null
```

## Auto-generated Values with `.$updateFn()`

Columns with `.$updateFn()` automatically generate values on every update, even if not explicitly included in `.set()`:

```typescript
// Schema with `.$updateFn()`
const Posts = table("public", "posts", {
  id: pk(),
  title: varchar({ length: 200, notNull }),
  updatedAt: timestamp({ notNull }).$updateFn(() => new Date()),
});

// `updatedAt` is automatically set by `.$updateFn()`
await db.update(Posts).set({ title: "New Title" }).where(eq(Posts.id, 1n));
// updatedAt will be auto-generated

// You can still override with an explicit value
await db
  .update(Posts)
  .set({
    title: "New Title",
    updatedAt: new Date("2024-06-15"), // Override updateFn
  })
  .where(eq(Posts.id, 1n));
```

:::tip
See [Dynamic Value Generation](../Schema/columns.md#updatefnfn) for more details on `.$insertFn()` and `.$updateFn()`.
:::

## Using SQL Expressions

Use `sql()` for raw SQL expressions in updates:

```typescript
import { sql } from "durcno";

// Set createdAt to current timestamp
await db
  .update(Users)
  .set({ createdAt: sql`NOW()` })
  .where(eq(Users.id, 1n));
```

## Primary Key Restriction

Primary key columns cannot be updated:

```typescript
// ❌ TypeScript Error - cannot update primary key
await db
  .update(Users)
  .set({ id: 999 }) // Error!
  .where(eq(Users.id, 1n));
```

## Method Chaining Order

Methods can be chained in any order:

```typescript
// These are equivalent
await db
  .update(Users)
  .set({ email: "a@b.com" })
  .where(eq(Users.id, 1n))
  .returning({ id: true });
await db
  .update(Users)
  .set({ email: "a@b.com" })
  .returning({ id: true })
  .where(eq(Users.id, 1n));
```

## Type Safety

Durcno ensures type safety for update values:

```typescript
// ✅ Valid - correct types
await db
  .update(Users)
  .set({ email: "valid@example.com" })
  .where(eq(Users.id, 1n));

// ❌ TypeScript Error - wrong type
await db
  .update(Users)
  .set({ email: 123 }) // email expects string
  .where(eq(Users.id, 1n));

// ❌ TypeScript Error - invalid enum value
await db
  .update(Users)
  .set({ type: "superadmin" }) // Not in enum
  .where(eq(Users.id, 1n));
```

## Related

- [Filters](./filters.md) — Complete list of filter operators for `.where()` conditions.