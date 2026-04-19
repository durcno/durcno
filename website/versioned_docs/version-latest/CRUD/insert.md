---
sidebar_position: 2
---

# Insert

Use `db.insert()` to insert rows into a table. Durcno provides full type safety, ensuring you provide all required columns and use correct types.

## Methods

### Builder methods (InsertBuilder)

| Method      | Description             |
| ----------- | ----------------------- |
| `.values()` | Supply row(s) to insert |

### Query methods (InsertQuery)

| Method         | Description                            |
| -------------- | -------------------------------------- |
| `.returning()` | Specify columns to return after insert |

## Basic Usage

### Insert a Single Row

```typescript
import { db } from "./db";
import { Users } from "./db/schema";

await db.insert(Users).values({
  username: "john_doe",
  email: "john@example.com",
  type: "user",
});
```

### Insert Multiple Rows

Pass an array to `.values()` to insert multiple rows:

```typescript
await db.insert(Users).values([
  { username: "john_doe", email: "john@example.com", type: "user" },
  { username: "jane_doe", email: "jane@example.com", type: "admin" },
]);
```

## Required vs Optional Columns

Durcno automatically determines which columns are required based on your schema:

| Column Type               | Insert Behavior                         |
| ------------------------- | --------------------------------------- |
| `notNull` without default | **Required** - must be provided         |
| `notNull` with default    | Optional - uses default if not provided |
| Nullable (no `notNull`)   | Optional - defaults to `null`           |
| Primary key (`pk()`)      | Optional - auto-generated               |

### Example Schema

```typescript
const Users = table("public", "users", {
  id: pk(), // Optional (auto-generated)
  username: varchar({ length: 50, notNull }), // Required
  email: varchar({ length: 255 }), // Optional (nullable)
  type: UserRole.enumed({ notNull }), // Required
  createdAt: timestamp({ notNull }).default(now()), // Optional (has default)
});
```

### Corresponding Insert

```typescript
// Only username and type are required
await db.insert(Users).values({
  username: "john_doe", // Required
  type: "user", // Required
  // id: auto-generated
  // email: defaults to null
  // createdAt: defaults to now()
});

// You can optionally provide other columns
await db.insert(Users).values({
  username: "jane_doe",
  type: "admin",
  email: "jane@example.com", // Optional, but provided
});
```

## Returning Inserted Data

Use `.returning()` to get data back from inserted rows:

```typescript
// Return specific columns
const inserted = await db
  .insert(Users)
  .values({ username: "john_doe", type: "user" })
  .returning({ id: true, username: true });
// Type: { id: number; username: string }[]

// Return all columns except some
const inserted = await db
  .insert(Users)
  .values({ username: "john_doe", type: "user" })
  .returning({ email: false });
// Type: { id: number; username: string; type: "admin" | "user"; createdAt: Date }[]
```

### Returning with Multiple Inserts

When inserting multiple rows, `.returning()` returns an array with data for each inserted row:

```typescript
const inserted = await db
  .insert(Users)
  .values([
    { username: "john", type: "user" },
    { username: "jane", type: "admin" },
  ])
  .returning({ id: true, username: true });
// Type: { id: number; username: string }[]
// Returns: [{ id: 1, username: "john" }, { id: 2, username: "jane" }]
```

## Auto-generated Values with `.$insertFn()`

Columns with `.$insertFn()` automatically generate values during insert when not explicitly provided:

```typescript
// Schema with `.$insertFn()`
const Posts = table("public", "posts", {
  id: pk(),
  title: varchar({ length: 200, notNull }),
  createdAt: timestamp({ notNull }).$insertFn(() => new Date()),
});

// createdAt is optional - insertFn generates it
await db.insert(Posts).values({
  title: "My Post",
  // createdAt will be auto-generated
});

// You can still override with an explicit value
await db.insert(Posts).values({
  title: "My Post",
  createdAt: new Date("2024-01-01"), // Override insertFn
});
```

:::tip
See [Dynamic Value Generation](../Schema/columns.md#insertfnfn) for more details on `.$insertFn()` and `.$updateFn()`.
:::

## Using SQL Expressions

You can use `sql()` for raw SQL expressions in insert values:

```typescript
import { sql } from "durcno";

await db.insert(Users).values({
  username: "john_doe",
  type: "user",
  createdAt: sql`NOW() - INTERVAL '1 day'`,
});
```

## Type Safety

Durcno provides compile-time validation:

```typescript
// ✅ Valid - all required fields provided
await db.insert(Users).values({
  username: "john",
  type: "user",
});

// ❌ TypeScript Error - missing required field "type"
await db.insert(Users).values({
  username: "john",
});

// ❌ TypeScript Error - invalid type value
await db.insert(Users).values({
  username: "john",
  type: "superadmin", // Not in enum
});
```

---

## $insertReturning

Use `db.$insertReturning()` to insert a single row and immediately get back the inserted row with all columns, including auto-generated values like IDs and timestamps.

:::tip
This is a shortcut for inserting a **single row** and returning the full object. For inserting multiple rows with returning, use the fluent `.insert().values([...]).returning()` pattern.
:::

### Basic Usage

```typescript
import { db } from "./db";
import { Users } from "./db/schema";

const newUser = await db.$insertReturning(Users, {
  username: "johndoe",
  email: "john@example.com",
  type: "user",
});

// Type: { id: number; username: string; email: string | null; type: "admin" | "user"; createdAt: Date; }
console.log(newUser.id); // Auto-generated ID
console.log(newUser.createdAt); // Auto-generated timestamp
```

```sql
INSERT INTO "public"."users" ("username", "email", "type")
VALUES ('johndoe', 'john@example.com', 'user')
RETURNING *;
```

### Why Use $insertReturning?

**Get Auto-Generated Values:**

```typescript
// The inserted user has the generated ID
const user = await db.$insertReturning(Users, {
  username: "newuser",
  type: "user",
});

// Now you can use the ID immediately
console.log(`Created user with ID: ${user.id}`);

// Use it for related inserts
await db.insert(Posts).values({
  userId: user.id,
  title: "First Post",
});
```

**Get Default Values:**

```typescript
// Schema with defaults
const Posts = table("public", "posts", {
  id: pk(),
  title: varchar({ length: 200, notNull }),
  viewCount: integer({ notNull }).default(0),
  isPublished: boolean({ notNull }).default(false),
  createdAt: timestamp({ notNull }).default(now()),
});

// Insert with minimal data
const post = await db.$insertReturning(Posts, {
  title: "My Post",
});

// All defaults are populated
console.log(post.viewCount); // 0
console.log(post.isPublished); // false
console.log(post.createdAt); // Date object
```

### Comparison: $insertReturning vs .returning()

| Aspect           | `$insertReturning`  | `.insert().values().returning()` |
| ---------------- | ------------------- | -------------------------------- |
| Rows             | Single row only     | Single or multiple rows          |
| Return type      | `T` (single object) | `T[]` (array)                    |
| Columns returned | All columns (`*`)   | Configurable                     |

```typescript
// $insertReturning - returns single object
const user = await db.$insertReturning(Users, {
  username: "john",
  type: "user",
});
// Type: User

// .returning() - returns array
const [user] = await db
  .insert(Users)
  .values({ username: "john", type: "user" })
  .returning({ id: true, username: true });
// Type: { id: number; username: string }[]
```

### Use Cases

**Create and Redirect:**

```typescript
// API handler
async function createPost(data: CreatePostInput) {
  const post = await db.$insertReturning(Posts, {
    title: data.title,
    content: data.content,
    userId: data.userId,
  });

  // Redirect to the new post
  return redirect(`/posts/${post.id}`);
}
```

**Create with Relations:**

```typescript
async function createUserWithProfile(userData: UserInput) {
  // Create user and get the ID
  const user = await db.$insertReturning(Users, {
    username: userData.username,
    email: userData.email,
    type: "user",
  });

  // Create profile with the user ID
  const profile = await db.$insertReturning(UserProfiles, {
    userId: user.id,
    bio: userData.bio,
    avatarUrl: userData.avatar,
  });

  return { user, profile };
}
```

**Audit Logging:**

```typescript
const record = await db.$insertReturning(AuditLogs, {
  action: "user.created",
  userId: actorId,
  targetId: targetUserId,
});

console.log(`Audit log ${record.id} created at ${record.createdAt}`);
```

### Type Signature

```typescript
$insertReturning(
  table: Table,
  values: InsertValues<Table>
): Promise<InferSelect<Table>>
```