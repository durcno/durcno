---
sidebar_position: 7
---

# Relational Query

Use `db.query()` to fetch data with related records in a single query. The Relational Query Builder (RQB) leverages your schema's relations to automatically handle joins.

## Prerequisites

Before using relational queries, define relations in your schema:

```typescript
import { table, pk, varchar, bigint, relations, many, fk } from "durcno";

export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, notNull }),
});

export const Posts = table("public", "posts", {
  id: pk(),
  userId: bigint({ notNull }).references(() => Users.id),
  title: varchar({ length: 255 }),
});

// Define relations
export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));

export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users),
}));
```

## Basic Usage

### Find Many

Fetch multiple records with options:

```typescript
import { db } from "./db";
import { Users } from "./db/schema";

const users = await db.query(Users).findMany({
  limit: 10,
});
// Type: { id: number; username: string }[]
```

### Find First

Fetch a single record (returns `null` if not found):

```typescript
import { eq } from "durcno";

const user = await db.query(Users).findFirst({
  where: eq(Users.id, 1),
});
// Type: { id: number; username: string } | null
```

## Selecting Columns

### Include Specific Columns

Use `true` to include columns:

```typescript
const users = await db.query(Users).findMany({
  columns: {
    id: true,
    username: true,
  },
});
// Type: { id: number; username: string }[]
```

### Exclude Columns

Use `false` to exclude columns:

```typescript
const users = await db.query(Users).findMany({
  columns: {
    email: false, // Exclude email
  },
});
// Type: { id: number; username: string; type: "admin" | "user"; createdAt: Date }[]
```

## Loading Relations

Use `with` to include related records:

```typescript
// Load users with their posts
const usersWithPosts = await db.query(Users).findMany({
  with: {
    posts: {},
  },
});
// Type: { id: number; username: string; posts: { id: number; userId: number; title: string }[] }[]
```

### Nested Relations

Load nested relations recursively:

```typescript
const usersWithPostsAndComments = await db.query(Users).findMany({
  with: {
    posts: {
      with: {
        comments: {},
      },
    },
  },
});
```

### Selective Columns in Relations

Specify which columns to include from related records:

```typescript
const users = await db.query(Users).findMany({
  columns: {
    username: true,
  },
  with: {
    posts: {
      columns: {
        title: true,
      },
    },
  },
});
// Type: { username: string; posts: { title: string }[] }[]
```

## Filtering

Use `where` to filter results:

```typescript
import { eq, and, gte } from "durcno";

const admins = await db.query(Users).findMany({
  where: eq(Users.type, "admin"),
});

const recentAdmins = await db.query(Users).findMany({
  where: and(
    eq(Users.type, "admin"),
    gte(Users.createdAt, new Date("2024-01-01")),
  ),
});
```

## Ordering

Use `orderBy` with `asc()` or `desc()`:

```typescript
import { asc, desc } from "durcno";

const users = await db.query(Users).findMany({
  orderBy: asc(Users.username),
});

const recentUsers = await db.query(Users).findMany({
  orderBy: desc(Users.createdAt),
});
```

## Pagination

Use `limit` and `offset`:

```typescript
// First page
const page1 = await db.query(Users).findMany({
  limit: 10,
  offset: 0,
});

// Second page
const page2 = await db.query(Users).findMany({
  limit: 10,
  offset: 10,
});
```

## Complete Example

Combining all options:

```typescript
import { eq, desc } from "durcno";

const result = await db.query(Users).findMany({
  columns: {
    id: true,
    username: true,
  },
  where: eq(Users.type, "admin"),
  orderBy: desc(Users.createdAt),
  limit: 10,
  offset: 0,
  with: {
    posts: {
      columns: {
        id: true,
        title: true,
      },
      limit: 5,
      orderBy: desc(Posts.createdAt),
    },
  },
});
// Type: {
//   id: number;
//   username: string;
//   posts: { id: number; title: string }[]
// }[]
```

## Relation Types

### Many-to-One (`fk`)

A single related record when the foreign key is on the current table (e.g., post's author):

```typescript
export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users),
}));

const posts = await db.query(Posts).findMany({
  with: {
    author: {},
  },
});
// Type: { ...; author: { id: number; username: string } }[]
// Note: Result is non-null because Posts.userId has notNull constraint
```

:::tip Nullability
The result type depends on the FK column's nullability:

- `notNull` FK → result is `T`
- Nullable FK → result is `T | null`
  :::

### One-to-Many (`many`)

Multiple related records (e.g., user's posts):

```typescript
export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));

const users = await db.query(Users).findMany({
  with: {
    posts: {},
  },
});
// Type: { ...; posts: { id: number; userId: number; title: string }[] }[]
```

## Options Reference

| Option    | Description                                                     |
| --------- | --------------------------------------------------------------- |
| `columns` | Select or exclude columns (`{ col: true }` or `{ col: false }`) |
| `where`   | Filter condition                                                |
| `orderBy` | Sort order (`asc(col)` or `desc(col)`)                          |
| `limit`   | Maximum number of results                                       |
| `offset`  | Number of results to skip                                       |
| `with`    | Related records to include                                      |

## Methods Reference

| Method                | Description                           |
| --------------------- | ------------------------------------- |
| `.findMany(options)`  | Fetch multiple records                |
| `.findFirst(options)` | Fetch first matching record or `null` |