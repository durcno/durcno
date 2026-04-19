---
sidebar_position: 1.4
---

# Enums

Enums are type-safe representations of PostgreSQL ENUM types. Durcno provides a fully type-safe API for defining and using enums in your schema with complete TypeScript inference.

## Basic Enum Definition

Create an enum using the `enumtype()` function and export it:

```typescript
import { enumtype } from "durcno";

export const UserRole = enumtype("public", "user_role", [
  "admin",
  "moderator",
  "user",
]);
export const Status = enumtype("public", "status", [
  "active",
  "inactive",
  "pending",
]);
```

## Using Enums in Tables

Use the `.enumed()` method to create an enum column in your table:

```typescript
import { table, pk, varchar, enumtype, notNull } from "durcno";

export const UserRole = enumtype("public", "user_role", [
  "admin",
  "moderator",
  "user",
]);
export const Status = enumtype("public", "status", [
  "active",
  "inactive",
  "pending",
]);

export const Users = table("public", "users", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  role: UserRole.enumed({ notNull }),
  status: Status.enumed({ notNull }).default("active"),
});
```

## Enum Options

The `enumtype()` function accepts the following parameters:

| Parameter | Type                | Required | Description                       |
| --------- | ------------------- | -------- | --------------------------------- |
| `schema`  | `string`            | Yes      | The schema name for the enum type |
| `name`    | `string`            | Yes      | The name of the enum type         |
| `values`  | `readonly string[]` | Yes      | Array of allowed enum values      |

### Basic Enum

```typescript
export const Priority = enumtype("public", "priority", [
  "low",
  "medium",
  "high",
]);
```

### Enum with Schema

```typescript
export const Priority = enumtype("public", "priority", [
  "low",
  "medium",
  "high",
]);
```

## Column Options

The `.enumed()` method accepts a configuration object with standard column options:

```typescript
export const Status = enumtype("public", "status", [
  "active",
  "inactive",
  "pending",
]);

export const Tasks = table("public", "tasks", {
  id: pk(),
  // Required enum column
  status: Status.enumed({ notNull }),

  // Optional enum column with default
  priority: Priority.enumed({}).default("medium"),

  // Unique enum column
  uniqueStatus: Status.enumed({ unique }),
});
```

**Available Options:**

- `notNull` - Makes the column required
- `unique` - Adds a UNIQUE constraint
- `default` - Sets a default value (must be one of the enum values)

## Type Safety

Durcno provides full TypeScript type safety for enum columns:

### Insert Type Safety

```typescript
export const UserRole = enumtype("public", "user_role", [
  "admin",
  "moderator",
  "user",
]);

export const Users = table("public", "users", {
  id: pk(),
  role: UserRole.enumed({ notNull }),
});

// ✅ Valid - "admin" is in the enum values
await db.insert(Users).values({
  role: "admin",
});

// ❌ Type Error - "superadmin" is not in the enum values
await db.insert(Users).values({
  role: "superadmin", // TypeScript error!
});
```

### Select Type Safety

```typescript
const users = await db.from(Users).select();
// users[0].role has type: "admin" | "moderator" | "user"
```

### Update Type Safety

```typescript
// ✅ Valid
await db.update(Users).set({ role: "moderator" }).where(eq(Users.id, 1));

// ❌ Type Error
await db.update(Users).set({ role: "invalid" }); // TypeScript error!
```

### Default Value Type Safety

```typescript
export const Status = enumtype("public", "status", ["active", "inactive"]);

// ✅ Valid - default value is in enum
export const Users = table("public", "users", {
  status: Status.enumed({}).default("active"),
});

// ❌ Type Error - default value not in enum
export const Users = table("public", "users", {
  status: Status.enumed({}).default("pending"), // TypeScript error!
});
```

## Practical Examples

### User Management System

```typescript
import { table, pk, varchar, enumtype, timestamp, notNull, now } from "durcno";

export const UserRole = enumtype("public", "user_role", [
  "admin",
  "moderator",
  "user",
  "guest",
]);
export const AccountStatus = enumtype("public", "account_status", [
  "active",
  "suspended",
  "deleted",
]);

export const Users = table("public", "users", {
  id: pk(),
  email: varchar({ length: 255, notNull }),
  role: UserRole.enumed({ notNull }).default("user"),
  status: AccountStatus.enumed({ notNull }).default("active"),
  createdAt: timestamp({ notNull }).default(now()),
});
```

### Task Tracking System

```typescript
import { table, pk, varchar, text, enumtype, notNull } from "durcno";

export const TaskStatus = enumtype("public", "task_status", [
  "todo",
  "in_progress",
  "review",
  "done",
]);
export const Priority = enumtype("public", "priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const Tasks = table("public", "tasks", {
  id: pk(),
  title: varchar({ length: 255, notNull }),
  description: text({}),
  status: TaskStatus.enumed({ notNull }).default("todo"),
  priority: Priority.enumed({ notNull }).default("medium"),
});
```

### Order Processing

```typescript
import { table, pk, bigint, enumtype, timestamp, notNull, now } from "durcno";

export const OrderStatus = enumtype("public", "order_status", [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

export const PaymentStatus = enumtype("public", "payment_status", [
  "pending",
  "paid",
  "failed",
  "refunded",
]);

export const Orders = table("public", "orders", {
  id: pk(),
  customerId: bigint({ notNull }),
  status: OrderStatus.enumed({ notNull }).default("pending"),
  paymentStatus: PaymentStatus.enumed({ notNull }).default("pending"),
  createdAt: timestamp({ notNull }).default(now()),
});
```

## Best Practices

### Use Descriptive Enum Names

```typescript
// ✅ Good: Clear, descriptive names
export const OrderStatus = enumtype("public", "order_status", [
  "pending",
  "shipped",
  "delivered",
]);
export const UserRole = enumtype("public", "user_role", ["admin", "user"]);

// ❌ Avoid: Vague or abbreviated names
export const S = enumtype("public", "s", ["a", "b", "c"]);
export const Type = enumtype("public", "type", ["1", "2"]);
```

### Use Consistent Value Naming

```typescript
// ✅ Good: Consistent snake_case values
export const TaskStatus = enumtype("public", "task_status", [
  "not_started",
  "in_progress",
  "completed",
]);

// ✅ Also Good: Consistent lowercase values
export const Priority = enumtype("public", "priority", [
  "low",
  "medium",
  "high",
]);

// ❌ Avoid: Mixed naming conventions
export const Status = enumtype("public", "status", [
  "Active",
  "in_progress",
  "DONE",
]);
```

### Always Export Enums Used Across Files

If an enum is used in multiple files, export it from a central location:

```typescript
// db/enums.ts
export const UserRole = enumtype("public", "user_role", ["admin", "user"]);
export const Status = enumtype("public", "status", ["active", "inactive"]);

// db/users.ts
import { UserRole, Status } from "./enums";

export const Users = table("public", "users", {
  id: pk(),
  role: UserRole.enumed({ notNull }),
  status: Status.enumed({ notNull }),
});
```

### Prefer Enums Over String Columns for Fixed Values

```typescript
// ✅ Good: Using enum for fixed set of values
export const Status = enumtype("public", "status", ["active", "inactive"]);
export const Users = table("public", "users", {
  status: Status.enumed({ notNull }),
});

// ❌ Avoid: Using varchar for fixed values
export const Users = table("public", "users", {
  status: varchar({ length: 20, notNull }), // No type safety!
});
```

### Consider Check Constraints Instead of Enums

If your allowed values change frequently or you need more flexible validation logic, consider using a `VARCHAR` (or `TEXT`) column with a `CHECK` constraint instead of a PostgreSQL enum type. CHECK constraints are table-scoped, easier to modify in migrations, and allow complex expressions (e.g., `lower(status) IN (...)`). Durcno captures check constraints in migrations and will generate the necessary ADD/DROP CONSTRAINT steps.

For guidance and examples, see [Check Constraints vs Enums](../Guides/enum-vs-check.md).

## Related

- [Columns](./columns.md) - Learn about all available column types
- [Tables](./overview.md) - Learn about table definitions
- [Migrations](../Migrations/overview.md) - Learn about migration management