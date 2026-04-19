---
sidebar_position: 8
---

# Query Shortcuts

Durcno provides `$`-prefixed utility functions for common query patterns. These are convenient shortcuts that wrap standard query operations.

## Overview

| Function                 | Purpose                  | Returns          |
| ------------------------ | ------------------------ | ---------------- |
| [`$count`](#count)       | Count rows               | `number`         |
| [`$exists`](#exists)     | Check if rows exist      | `boolean`        |
| [`$first`](#first)       | Get first matching row   | `T \| null`      |
| [`$distinct`](#distinct) | Get unique column values | `T[]`            |
| [`$sum`](#sum)           | Sum numeric column       | `number \| null` |
| [`$avg`](#avg)           | Average of column        | `number \| null` |
| [`$min`](#min)           | Minimum value            | `number \| null` |
| [`$max`](#max)           | Maximum value            | `number \| null` |

All functions:

- Accept an optional `where` clause as the last argument
- Return a `QueryPromise` that can be awaited or used with `.then()`
- Are fully type-safe with inferred return types

---

## $count

Use `db.$count()` to efficiently count rows in a table. This executes a `SELECT count(*)` query and returns a number.

### Basic Usage

```typescript
import { db } from "./db";
import { Users } from "./db/schema";

// Count all users
const count = await db.$count(Users);
// Type: number
```

```sql
SELECT count(*) FROM "public"."users";
```

### Count with Filter

Pass a where condition as the second argument to count matching rows:

```typescript
import { eq } from "durcno";

// Count users named "Dan"
const count = await db.$count(Users, eq(Users.name, "Dan"));
// Type: number
```

```sql
SELECT count(*) FROM "public"."users" WHERE "name" = 'Dan';
```

### Filter Examples

You can use any where clause operators with `$count`:

```typescript
import { eq, and, gte, isNull } from "durcno";

// Count admin users
const adminCount = await db.$count(Users, eq(Users.type, "admin"));

// Count users with multiple conditions
const activeAdminCount = await db.$count(
  Users,
  and(eq(Users.type, "admin"), eq(Users.isActive, true)),
);

// Count users without email
const noEmailCount = await db.$count(Users, isNull(Users.email));

// Count users created after a date
const recentCount = await db.$count(
  Users,
  gte(Users.createdAt, new Date("2024-01-01")),
);
```

### Type Signature

```typescript
$count(table: Table): Promise<number>
$count(table: Table, where: Where): Promise<number>
```

---

## $exists

Use `db.$exists()` to efficiently check if any rows exist in a table. This is more efficient than counting when you only need to know if data exists.

### Basic Usage

```typescript
import { db } from "./db";
import { Users } from "./db/schema";

// Check if any users exist
const hasUsers = await db.$exists(Users);
// Type: boolean
```

```sql
SELECT EXISTS(SELECT 1 FROM "public"."users");
```

### Check with Filter

Pass a where condition to check if matching rows exist:

```typescript
import { eq } from "durcno";

// Check if any admins exist
const hasAdmins = await db.$exists(Users, eq(Users.type, "admin"));
// Type: boolean
```

```sql
SELECT EXISTS(SELECT 1 FROM "public"."users" WHERE "type" = 'admin');
```

### Use Cases

**Guard Clauses:**

```typescript
// Only proceed if users exist
if (await db.$exists(Users)) {
  const users = await db.from(Users).select();
  // Process users...
}
```

**Validation:**

```typescript
// Check if email is already taken
const emailTaken = await db.$exists(Users, eq(Users.email, "new@example.com"));

if (emailTaken) {
  throw new Error("Email already registered");
}
```

**Conditional Logic:**

```typescript
import { and, eq } from "durcno";

// Check if user has any published posts
const hasPublished = await db.$exists(
  Posts,
  and(eq(Posts.userId, userId), eq(Posts.isPublished, true)),
);

if (hasPublished) {
  // Show "Published Author" badge
}
```

### Why Use $exists Over $count?

`$exists` is more efficient than `$count` when you only need to know if rows exist:

```typescript
// Less efficient - counts all matching rows
const count = await db.$count(Users, eq(Users.type, "admin"));
const hasAdmins = count > 0;

// More efficient - stops at first match
const hasAdmins = await db.$exists(Users, eq(Users.type, "admin"));
```

The database can stop searching as soon as it finds one matching row, rather than counting all matches.

### Type Signature

```typescript
$exists(table: Table): Promise<boolean>
$exists(table: Table, where: Where): Promise<boolean>
```

---

## $first

Use `db.$first()` to retrieve the first matching row from a table. Returns `null` if no rows match.

### Basic Usage

```typescript
import { db } from "./db";
import { Users } from "./db/schema";

// Get the first user
const user = await db.$first(Users);
// Type: { id: number; username: string; email: string | null; ... } | null
```

```sql
SELECT * FROM "public"."users" LIMIT 1;
```

### Get First Matching Row

Pass a where condition to find the first matching row:

```typescript
import { eq } from "durcno";

// Find a user by email
const user = await db.$first(Users, eq(Users.email, "test@example.com"));
// Type: User | null
```

```sql
SELECT * FROM "public"."users" WHERE "email" = 'test@example.com' LIMIT 1;
```

### Use Cases

**Find by Unique Field:**

```typescript
// Find user by username (unique field)
const user = await db.$first(Users, eq(Users.username, "johndoe"));

if (user) {
  console.log(`Found user: ${user.id}`);
} else {
  console.log("User not found");
}
```

**Get Any Matching Row:**

```typescript
import { eq } from "durcno";

// Get any admin user
const admin = await db.$first(Users, eq(Users.type, "admin"));

if (admin) {
  // Use the admin for some operation
}
```

**Null Handling:**

```typescript
// $first returns null when no rows match
const user = await db.$first(Users, eq(Users.id, 999999));

if (user === null) {
  throw new Error("User not found");
}

// TypeScript now knows user is not null
console.log(user.username);
```

### Comparison with Select

`$first` is a convenience method that combines `select` with `limit(1)`:

```typescript
// Using $first
const user = await db.$first(Users, eq(Users.id, 1));

// Equivalent using select
const [user] = await db.from(Users).select().where(eq(Users.id, 1)).limit(1);
```

Key differences:

- `$first` returns `T | null` (single object or null)
- `select` returns `T[]` (array, possibly empty)

### Type Safety

The return type is fully inferred from the table schema:

```typescript
const user = await db.$first(Users);

if (user) {
  // TypeScript knows all properties
  user.id; // number
  user.username; // string
  user.email; // string | null
  user.type; // "admin" | "user"
  user.createdAt; // Date
}
```

### Type Signature

```typescript
$first(table: Table): Promise<InferSelect<Table> | null>
$first(table: Table, where: Where): Promise<InferSelect<Table> | null>
```

---

## $distinct

Use `db.$distinct()` to get an array of unique values from a column.

### Basic Usage

```typescript
import { db } from "./db";
import { Users } from "./db/schema";

// Get all unique usernames
const usernames = await db.$distinct(Users, Users.username);
// Type: string[]
```

```sql
SELECT DISTINCT "username" as value FROM "public"."users" ORDER BY "username";
```

### With Enum Columns

Get all used enum values:

```typescript
// Get all user types that exist in the database
const types = await db.$distinct(Users, Users.type);
// Type: ("admin" | "user")[]
```

This is useful for populating filter dropdowns with only values that exist in your data.

### With Filter

Pass a where condition to get distinct values from matching rows:

```typescript
import { eq } from "durcno";

// Get distinct usernames of admin users
const adminUsernames = await db.$distinct(
  Users,
  Users.username,
  eq(Users.type, "admin"),
);
```

```sql
SELECT DISTINCT "username" as value
FROM "public"."users"
WHERE "type" = 'admin'
ORDER BY "username";
```

### Use Cases

**Populate Filter Dropdowns:**

```typescript
// Get all categories that have posts
const categories = await db.$distinct(Posts, Posts.category);

// Use in a dropdown
const filterOptions = categories.map((cat) => ({
  label: cat,
  value: cat,
}));
```

**Data Validation:**

```typescript
// Check what statuses exist in the database
const existingStatuses = await db.$distinct(Users, Users.status);

console.log("Active statuses:", existingStatuses);
// e.g., ["active", "pending"] - "inactive" might not be used yet
```

**Analytics:**

```typescript
import { eq, gte } from "durcno";

// Find unique authors who published this month
const activeAuthors = await db.$distinct(
  Posts,
  Posts.userId,
  and(eq(Posts.isPublished, true), gte(Posts.publishedAt, startOfMonth)),
);

console.log(`${activeAuthors.length} authors published this month`);
```

### Type Safety

The return type is inferred from the column type:

```typescript
// String column -> string[]
const usernames = await db.$distinct(Users, Users.username);
// Type: string[]

// Nullable column -> (T | null)[]
const emails = await db.$distinct(Users, Users.email);
// Type: (string | null)[]

// Enum column -> literal union array
const types = await db.$distinct(Users, Users.type);
// Type: ("admin" | "user")[]

// Numeric column -> number[]
const scores = await db.$distinct(Users, Users.score);
// Type: number[]
```

### Ordering

Results are automatically ordered by the column value in ascending order. This ensures consistent results and is useful for display purposes.

### Empty Results

Returns an empty array when no rows exist or no rows match the filter:

```typescript
// Empty table
const values = await db.$distinct(EmptyTable, EmptyTable.column);
// Returns: []

// No matching rows
const adminNames = await db.$distinct(
  Users,
  Users.username,
  eq(Users.type, "superadmin"), // No superadmins exist
);
// Returns: []
```

### Type Signature

```typescript
$distinct(table: Table, column: Column): Promise<ColumnType[]>
$distinct(table: Table, column: Column, where: Where): Promise<ColumnType[]>
```

---

## Aggregate Functions

Durcno provides aggregate utility functions for common statistical operations: `$sum`, `$avg`, `$min`, and `$max`.

All aggregate functions return `number | null`:

- Returns a `number` when rows exist and the column has values
- Returns `null` when:
  - The table is empty
  - No rows match the where clause
  - All matching rows have `NULL` values for the column

### $sum

Calculate the sum of a numeric column.

```typescript
import { db } from "./db";
import { Posts } from "./db/schema";

// Sum all view counts
const totalViews = await db.$sum(Posts, Posts.viewCount);
// Type: number | null
```

```sql
SELECT SUM("view_count") as result FROM "public"."posts";
```

**With Filter:**

```typescript
import { eq } from "durcno";

// Sum views for published posts only
const publishedViews = await db.$sum(
  Posts,
  Posts.viewCount,
  eq(Posts.isPublished, true),
);
```

### $avg

Calculate the average of a numeric column.

```typescript
// Average view count across all posts
const avgViews = await db.$avg(Posts, Posts.viewCount);
// Type: number | null
```

```sql
SELECT AVG("view_count") as result FROM "public"."posts";
```

**With Filter:**

```typescript
import { eq } from "durcno";

// Average views for a specific user's posts
const userAvgViews = await db.$avg(
  Posts,
  Posts.viewCount,
  eq(Posts.userId, userId),
);
```

### $min

Find the minimum value of a column.

```typescript
// Find the lowest view count
const minViews = await db.$min(Posts, Posts.viewCount);
// Type: number | null
```

```sql
SELECT MIN("view_count") as result FROM "public"."posts";
```

**With Filter:**

```typescript
import { eq } from "durcno";

// Find minimum views among published posts
const minPublishedViews = await db.$min(
  Posts,
  Posts.viewCount,
  eq(Posts.isPublished, true),
);
```

### $max

Find the maximum value of a column.

```typescript
// Find the highest view count
const maxViews = await db.$max(Posts, Posts.viewCount);
// Type: number | null
```

```sql
SELECT MAX("view_count") as result FROM "public"."posts";
```

**With Filter:**

```typescript
import { and, eq } from "durcno";

// Find max views for a user's published posts
const maxUserViews = await db.$max(
  Posts,
  Posts.viewCount,
  and(eq(Posts.userId, userId), eq(Posts.isPublished, true)),
);
```

### Handling Null Results

```typescript
// Handle null case
const totalViews = await db.$sum(Posts, Posts.viewCount);

if (totalViews === null) {
  console.log("No posts found");
} else {
  console.log(`Total views: ${totalViews}`);
}

// With default value
const views = (await db.$sum(Posts, Posts.viewCount)) ?? 0;
```

### Use Cases

**Dashboard Statistics:**

```typescript
const stats = {
  totalPosts: await db.$count(Posts),
  totalViews: (await db.$sum(Posts, Posts.viewCount)) ?? 0,
  avgViews: (await db.$avg(Posts, Posts.viewCount)) ?? 0,
  topViews: (await db.$max(Posts, Posts.viewCount)) ?? 0,
};
```

**User Analytics:**

```typescript
import { eq } from "durcno";

async function getUserStats(userId: number) {
  const where = eq(Posts.userId, userId);

  return {
    postCount: await db.$count(Posts, where),
    totalViews: (await db.$sum(Posts, Posts.viewCount, where)) ?? 0,
    avgViews: (await db.$avg(Posts, Posts.viewCount, where)) ?? 0,
    bestPost: await db.$max(Posts, Posts.viewCount, where),
  };
}
```

### Type Signatures

```typescript
$sum(table: Table, column: NumericColumn): Promise<number | null>
$sum(table: Table, column: NumericColumn, where: Where): Promise<number | null>

$avg(table: Table, column: NumericColumn): Promise<number | null>
$avg(table: Table, column: NumericColumn, where: Where): Promise<number | null>

$min(table: Table, column: NumericColumn): Promise<number | null>
$min(table: Table, column: NumericColumn, where: Where): Promise<number | null>

$max(table: Table, column: NumericColumn): Promise<number | null>
$max(table: Table, column: NumericColumn, where: Where): Promise<number | null>
```