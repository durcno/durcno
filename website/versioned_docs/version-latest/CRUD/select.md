---
sidebar_position: 1
---

# Select

Use `db.from()` to build SELECT queries. The query builder provides a fluent API for selecting columns, joining tables, filtering, sorting, and paginating results.

## Methods

### Builder methods (SelectBuilder)

| Method                   | Description                            |
| ------------------------ | -------------------------------------- |
| `.innerJoin(table, on)`  | Add an inner join to the query         |
| `.distinctOn(column)`    | Apply DISTINCT ON for a single column  |
| `.distinctOn([...cols])` | Apply DISTINCT ON for multiple columns |
| `.select()`              | Select all columns                     |
| `.select({ ... })`       | Select specific columns                |

### Query methods (SelectQuery)

| Method                  | Description              |
| ----------------------- | ------------------------ |
| `.where(condition)`     | Filter results           |
| `.orderBy(order)`       | Sort by a column         |
| `.orderBy([...orders])` | Sort by multiple columns |
| `.limit(n)`             | Limit number of results  |
| `.offset(n)`            | Skip n results           |

## Basic Usage

### Select All Columns

```typescript
import { db } from "./db";
import { Users } from "./db/schema";

// Select all columns from Users table
const users = await db.from(Users).select();
// Type: { id: number; username: string; email: string | null; type: "admin" | "user"; createdAt: Date }[]
```

### Select Specific Columns

Pass an object to `.select()` to choose specific columns:

```typescript
// Select only username
const usernames = await db.from(Users).select({
  username: Users.username,
});
// Type: { username: string }[]

// Select multiple columns
const userInfo = await db.from(Users).select({
  id: Users.id,
  email: Users.email,
});
// Type: { id: number; email: string | null }[]
```

### Column Aliasing

You can alias columns by using different keys in the select object:

```typescript
const users = await db.from(Users).select({
  name: Users.username, // Alias "username" as "name"
  mail: Users.email, // Alias "email" as "mail"
});
// Type: { name: string; mail: string | null }[]
```

## Filtering with WHERE

Use `.where()` to filter results. See [Filters](./filters) for all available operators.

```typescript
import { eq, and, gte } from "durcno";

// Simple equality filter
const admins = await db.from(Users).select().where(eq(Users.type, "admin"));

// Multiple conditions with AND
const recentAdmins = await db
  .from(Users)
  .select()
  .where(
    and(eq(Users.type, "admin"), gte(Users.createdAt, new Date("2024-01-01"))),
  );
```

## Sorting with ORDER BY

Use `.orderBy()` with `asc()` or `desc()` to sort results:

```typescript
import { asc, desc } from "durcno";

// Sort by username ascending
const users = await db.from(Users).select().orderBy(asc(Users.username));

// Sort by creation date descending (newest first)
const recentUsers = await db
  .from(Users)
  .select()
  .orderBy(desc(Users.createdAt));
```

### Multi-Column Sorting

Pass an array to `.orderBy()` to sort by multiple columns:

```typescript
// Sort by type ascending, then by username ascending
const sortedUsers = await db
  .from(Users)
  .select()
  .orderBy([asc(Users.type), asc(Users.username)]);

// Sort by type ascending, then by creation date descending
const mixedSort = await db
  .from(Users)
  .select()
  .orderBy([asc(Users.type), desc(Users.createdAt)]);
```

### Sorting with Joins

When using joins, you can sort by columns from any joined table:

```typescript
import { eq, asc, desc } from "durcno";
import { Users, Posts } from "./db/schema";

// Sort by username (Users), then by post creation date (Posts)
const usersWithPosts = await db
  .from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select({
    username: Users.username,
    title: Posts.title,
  })
  .orderBy([asc(Users.username), desc(Posts.createdAt)]);
```

## Pagination with LIMIT and OFFSET

Use `.limit()` and `.offset()` for pagination:

```typescript
// Get first 10 users
const firstPage = await db.from(Users).select().limit(10);

// Get users 11-20 (second page)
const secondPage = await db.from(Users).select().limit(10).offset(10);
```

## Joining Tables

Use `.innerJoin()` to join tables:

```typescript
import { eq } from "durcno";
import { Users, Posts } from "./db/schema";

// Join Users with Posts
const usersWithPosts = await db
  .from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select({
    username: Users.username,
    title: Posts.title,
  });
// Type: { username: string; title: string | null }[]
```

### Multiple Joins

Chain multiple `.innerJoin()` calls for complex queries:

```typescript
import { Users, Posts, Comments } from "./db/schema";

const data = await db
  .from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .innerJoin(Comments, eq(Posts.id, Comments.postId))
  .select({
    username: Users.username,
    postTitle: Posts.title,
    commentBody: Comments.body,
  });
```

## DISTINCT ON

Use `.distinctOn()` on the `FromBuilder` (before `.select()`) to select only the first row for each unique combination of the specified columns, using PostgreSQL's `DISTINCT ON (...)` syntax.

:::info

When using `DISTINCT ON`, the distinct columns must match the leftmost `ORDER BY` columns. This is a PostgreSQL requirement.

:::

### Single Column

```typescript
import { asc } from "durcno";

// Get one user per type (e.g., one "admin", one "user")
const onePerType = await db
  .from(Users)
  .distinctOn(Users.type)
  .select()
  .orderBy(asc(Users.type));
```

### Multiple Columns

Pass an array of columns to `.distinctOn()` for compound distinct expressions:

```typescript
// Get one user per (type, status) combination
const onePerTypeAndStatus = await db
  .from(Users)
  .distinctOn([Users.type, Users.status])
  .select()
  .orderBy([asc(Users.type), asc(Users.status)]);
```

### With Specific Columns and WHERE

Combine `.distinctOn()` with `.select()`, `.where()`, and `.orderBy()` as usual:

```typescript
import { eq, asc } from "durcno";

const latestAdminPerType = await db
  .from(Users)
  .distinctOn(Users.type)
  .select({ type: Users.type, username: Users.username })
  .where(eq(Users.type, "admin"))
  .orderBy([asc(Users.type), desc(Users.createdAt)]);
// Type: { type: "admin" | "user"; username: string }[]
```

## Method Chaining

All methods can be chained in a fluent API:

```typescript
const results = await db
  .from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select({
    username: Users.username,
    title: Posts.title,
  })
  .where(eq(Users.type, "admin"))
  .orderBy(desc(Users.createdAt))
  .limit(10)
  .offset(0);
```

## Related

- [Filters](./filters.md) — Complete list of filter operators for `.where()` conditions.