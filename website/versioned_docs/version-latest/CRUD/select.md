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

| Method                  | Description                                               |
| ----------------------- | --------------------------------------------------------- |
| `.where(condition)`     | Filter results                                            |
| `.groupBy(col)`         | Explicit GROUP BY (single column or expression)           |
| `.groupBy([...cols])`   | Explicit GROUP BY (multiple columns/expressions)          |
| `.groupBy(callback)`    | GROUP BY using named select aliases (callback form)       |
| `.having(condition)`    | Filter grouped results (HAVING clause)                    |
| `.orderBy(order)`       | Sort by a column                                          |
| `.orderBy([...orders])` | Sort by multiple columns                                  |
| `.limit(n)`             | Limit number of results (`n` can be `number` or `bigint`) |
| `.offset(n)`            | Skip n results (`n` can be `number` or `bigint`)          |

## Basic Usage

### Select All Columns

```typescript
import { db } from "./db/index.ts";
import { Users } from "./db/schema.ts";

// Select all columns from Users table
const users = await db.from(Users).select();
// Type: { id: bigint; username: string; email: string | null; type: "admin" | "user"; createdAt: Date }[]
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
// Type: { id: bigint; email: string | null }[]
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

Use `.where()` to filter results. See [Filters](../Expressions/filters.md) for all available operators.

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
import { Users, Posts } from "./db/schema.ts";

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

Use `.limit()` and `.offset()` for pagination. Both accept `number` or `bigint`:

```typescript
// Get first 10 users
const firstPage = await db.from(Users).select().limit(10);

// Get users 11-20 (second page)
const secondPage = await db.from(Users).select().limit(10).offset(10);

// Using bigint values
const page = await db.from(Users).select().limit(10n).offset(20n);
```

## Joining Tables

Use `.innerJoin()` to join tables:

```typescript
import { eq } from "durcno";
import { Users, Posts } from "./db/schema.ts";

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
import { Users, Posts, Comments } from "./db/schema.ts";

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

## Common Table Expressions (WITH)

Durcno supports PostgreSQL Common Table Expressions (CTEs) using `db.with()`. Define a named CTE with `.as()`, then build an outer query with `db.with(cte).from(...)`.
See the dedicated [WITH page](./with) for full CTE usage, including chained CTEs and DML CTEs with `.returning(...)`.

```typescript
import { asc, eq } from "durcno";
import { db } from "./db/index.ts";
import { Users } from "./db/schema.ts";

const activeUsers = db
  .with("activeUsers")
  .as(
    db
      .from(Users)
      .select({ id: Users.id, username: Users.username })
      .where(eq(Users.status, "active")),
  );

const rows = await db
  .with(activeUsers)
  .from((ctes) => ctes.activeUsers)
  .select()
  .orderBy(asc(activeUsers.username));

// Type: { id: bigint; username: string }[]
```

CTEs can also wrap DML queries with `.returning(...)`, such as `INSERT`, `UPDATE`, or `DELETE`, and then be queried by an outer `SELECT`.

## GROUP BY and HAVING

### Explicit GROUP BY

Use `.groupBy()` to explicitly set the GROUP BY clause. Explicit GROUP BY **fully replaces** the auto GROUP BY that Durcno generates when aggregate functions are mixed with non-aggregate columns in `.select()`.

**Single column:**

```typescript
import { count, asc } from "durcno";

const byType = await db
  .from(Users)
  .select({ type: Users.type, total: count("*") })
  .groupBy(Users.type)
  .orderBy(asc(Users.type));
// SQL: ... GROUP BY "users"."type" ORDER BY ...
```

**Multiple columns:**

```typescript
const byTypeAndStatus = await db
  .from(Users)
  .select({ type: Users.type, status: Users.status, total: count("*") })
  .groupBy([Users.type, Users.status]);
```

**Scalar expression:**

```typescript
import { lower, count } from "durcno";

const byLowerUsername = await db
  .from(Users)
  .select({ lname: lower(Users.username), total: count("*") })
  .groupBy(lower(Users.username));
```

### Callback Form (alias references)

When `.select({ ... })` is called with a named map, `.groupBy()` also accepts a **callback** that receives the select aliases as `GroupByAlias` values. This avoids repeating expressions:

```typescript
import { lower, count } from "durcno";

const results = await db
  .from(Users)
  .select({ lname: lower(Users.username), total: count("*") })
  .groupBy(({ lname }) => [lname]);
// SQL: ... GROUP BY "lname"
```

You can also mix aliases with direct columns:

```typescript
const results = await db
  .from(Users)
  .select({ lname: lower(Users.username), total: count("*") })
  .groupBy(({ lname }) => [lname, Users.type]);
// SQL: ... GROUP BY "lname", "users"."type"
```

:::note

The callback form requires a named `.select({ ... })`. Calling `.groupBy(callback)` after `.select()` (no argument) is a compile-time error.

:::

### HAVING

Use `.having()` to filter grouped results. It supports aggregate-to-literal and aggregate-to-aggregate comparisons:

```typescript
import { count, gte } from "durcno";

// Only return groups with 2 or more rows
const busyTypes = await db
  .from(Users)
  .select({ type: Users.type, total: count("*") })
  .groupBy(Users.type)
  .having(gte(count("*"), 2));
```

**Aggregate-to-aggregate:**

```typescript
import { count, sum, gt } from "durcno";

const results = await db
  .from(Users)
  .select({ type: Users.type, sumScore: sum(Users.score), total: count("*") })
  .groupBy(Users.type)
  .having(gt(sum(Users.score), count("*")));
```

:::note

`.having()` can be used without explicit `.groupBy()`. In that case, auto GROUP BY still fires (based on non-aggregate columns in `.select()`), and the HAVING clause is appended after it.

:::

### Full Chain

```typescript
import { eq, count, gte, asc } from "durcno";

const results = await db
  .from(Users)
  .select({ type: Users.type, total: count("*") })
  .where(eq(Users.status, "active"))
  .groupBy(Users.type)
  .having(gte(count("*"), 2))
  .orderBy(asc(Users.type))
  .limit(10);
// Clause order: WHERE → GROUP BY → HAVING → ORDER BY → LIMIT
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

- [Filters](../Expressions/filters.md) — Complete list of filter operators for `.where()` conditions.