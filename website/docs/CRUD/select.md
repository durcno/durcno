---
sidebar_position: 1
---

# Select

Use `db.from()` to build SELECT queries. The query builder provides a fluent API for selecting columns, joining tables, filtering, sorting, and paginating results.

## Methods

### Builder methods (SelectBuilder)

| Method                        | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `.innerJoin(table, callback)` | Add an inner join with `(view) => condition`         |
| `.leftJoin(table, callback)`  | Add a left join with `(view) => condition`           |
| `.distinctOn(callback)`       | Apply DISTINCT ON via `(view) => col` or `[...cols]` |
| `.select("*")`                | Select all columns                                   |
| `.select(callback)`           | Select specific columns via `(view) => ({ ... })`    |

### Query methods (SelectQuery)

| Method               | Description                                                      |
| -------------------- | ---------------------------------------------------------------- |
| `.where(callback)`   | Filter results via `(view) => condition`                         |
| `.groupBy(callback)` | Explicit GROUP BY via `(view, selects) => [cols/aliases]`        |
| `.having(callback)`  | Filter grouped results via `(view) => condition` (HAVING clause) |
| `.orderBy(callback)` | Sort results via `(view, selects) => order` or `[...orders]`     |
| `.limit(n)`          | Limit number of results (`n` can be `number` or `bigint`)        |
| `.offset(n)`         | Skip n results (`n` can be `number` or `bigint`)                 |

## Basic Usage

### Select All Columns

```typescript
import { db } from "./db/index.ts";
import { Users } from "./db/schema.ts";

// Select all columns from Users table
const users = await db.from(Users).select("*");
// Type: { id: bigint; username: string; email: string | null; type: "admin" | "user"; createdAt: Date }[]
```

### Select Specific Columns

Pass a callback to `.select()` receiving a view of available tables to choose specific columns:

```typescript
// Select only username
const usernames = await db.from(Users).select(({ users }) => ({
  username: users.username,
}));
// Type: { username: string }[]

// Select multiple columns
const userInfo = await db.from(Users).select(({ users }) => ({
  id: users.id,
  email: users.email,
}));
// Type: { id: bigint; email: string | null }[]
```

### Column Aliasing

You can alias columns by using different keys in the select object:

```typescript
const users = await db.from(Users).select(({ users }) => ({
  name: users.username, // Alias "username" as "name"
  mail: users.email, // Alias "email" as "mail"
}));
// Type: { name: string; mail: string | null }[]
```

## Filtering with WHERE

Use `.where()` with a callback receiving the tables view to filter results. See [Filters](../Expressions/filters.md) for all available operators.

```typescript
import { eq, and, gte } from "durcno";

// Simple equality filter
const admins = await db
  .from(Users)
  .select("*");
  .where(({ users }) => eq(users.type, "admin"));

// Multiple conditions with AND
const recentAdmins = await db
  .from(Users)
  .select("*");
  .where(({ users }) =>
    and(eq(users.type, "admin"), gte(users.createdAt, new Date("2024-01-01"))),
  );
```

## Sorting with ORDER BY

Use `.orderBy()` with `asc()` or `desc()` inside a callback to sort results:

```typescript
import { asc, desc } from "durcno";

// Sort by username ascending
const users = await db
  .from(Users)
  .select("*");
  .orderBy(({ users }) => asc(users.username));

// Sort by creation date descending (newest first)
const recentUsers = await db
  .from(Users)
  .select("*");
  .orderBy(({ users }) => desc(users.createdAt));
```

### Multi-Column Sorting

Return an array from `.orderBy()` to sort by multiple columns:

```typescript
// Sort by type ascending, then by username ascending
const sortedUsers = await db
  .from(Users)
  .select("*");
  .orderBy(({ users }) => [asc(users.type), asc(users.username)]);

// Sort by type ascending, then by creation date descending
const mixedSort = await db
  .from(Users)
  .select("*");
  .orderBy(({ users }) => [asc(users.type), desc(users.createdAt)]);
```

### Sorting with Joins

When using joins, you can sort by columns from any joined table in the view:

```typescript
import { eq, asc, desc } from "durcno";
import { Users, Posts } from "./db/schema.ts";

// Sort by username (Users), then by post creation date (Posts)
const usersWithPosts = await db
  .from(Users)
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    username: users.username,
    title: posts.title,
  }))
  .orderBy(({ users, posts }) => [asc(users.username), desc(posts.createdAt)]);
```

### Sorting with Select Aliases

The `.orderBy()` callback also receives a second parameter with output aliases defined in `.select()`:

```typescript
import { count, desc } from "durcno";

const stats = await db
  .from(Users)
  .select(({ users }) => ({
    userType: users.type,
    userCount: count("*"),
  }))
  .groupBy(({ users }) => [users.type])
  .orderBy(({ users }, { userCount }) => desc(userCount));
```

## Pagination with LIMIT and OFFSET

Use `.limit()` and `.offset()` for pagination. Both accept `number` or `bigint`:

```typescript
// Get first 10 users
const firstPage = await db.from(Users).select("*").limit(10);

// Get users 11-20 (second page)
const secondPage = await db.from(Users).select("*").limit(10).offset(10);

// Using bigint values
const page = await db.from(Users).select("*").limit(10n).offset(20n);
```

## Joining Tables

Use joins to combine rows from related tables. See the dedicated [Joins](./joins.md) page for full examples of `.innerJoin()` and `.leftJoin()`.

```typescript
import { eq } from "durcno";
import { Users, Posts } from "./db/schema.ts";

// Join Users with Posts
const usersWithPosts = await db
  .from(Users)
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    username: users.username,
    title: posts.title,
  }));
// Type: { username: string; title: string | null }[]
```

## Common Table Expressions (WITH)

Durcno supports PostgreSQL Common Table Expressions (CTEs) using `db.with()`. Define a named CTE with `.as()`, then build an outer query with `db.with(cte).from(...)`.
See the dedicated [WITH page](./with) for full CTE usage, including chained CTEs and DML CTEs with `.returning(...)`.

```typescript
import { asc, eq } from "durcno";
import { db } from "./db/index.ts";
import { Users } from "./db/schema.ts";

const activeUsers = db.with("activeUsers").as(
  db
    .from(Users)
    .select(({ users }) => ({ id: users.id, username: users.username }))
    .where(({ users }) => eq(users.status, "active")),
);

const rows = await db
  .with(activeUsers)
  .from((ctes) => ctes.activeUsers)
  .select("*");
  .orderBy(({ activeUsers }) => asc(activeUsers.username));

// Type: { id: bigint; username: string }[]
```

CTEs can also wrap DML queries with `.returning(...)`, such as `INSERT`, `UPDATE`, or `DELETE`, and then be queried by an outer `SELECT`.

## GROUP BY and HAVING

### Explicit GROUP BY

Use `.groupBy()` with a callback receiving the tables view and select aliases to explicitly set the GROUP BY clause. Explicit GROUP BY **fully replaces** the auto GROUP BY that Durcno generates when aggregate functions are mixed with non-aggregate columns in `.select()`.

**Single column:**

```typescript
import { count, asc } from "durcno";

const byType = await db
  .from(Users)
  .select(({ users }) => ({ type: users.type, total: count("*") }))
  .groupBy(({ users }) => [users.type])
  .orderBy(({ users }) => asc(users.type));
// SQL: ... GROUP BY "users"."type" ORDER BY ...
```

**Multiple columns:**

```typescript
const byTypeAndStatus = await db
  .from(Users)
  .select(({ users }) => ({
    type: users.type,
    status: users.status,
    total: count("*"),
  }))
  .groupBy(({ users }) => [users.type, users.status]);
```

**Scalar expression:**

```typescript
import { lower, count } from "durcno";

const byLowerUsername = await db
  .from(Users)
  .select(({ users }) => ({ lname: lower(users.username), total: count("*") }))
  .groupBy(({ users }) => [lower(users.username)]);
```

### Using Select Aliases

When `.select()` defines named aliases, `.groupBy()` receives them in the second parameter:

```typescript
import { lower, count } from "durcno";

const results = await db
  .from(Users)
  .select(({ users }) => ({ lname: lower(users.username), total: count("*") }))
  .groupBy(({ users }, { lname }) => [lname]);
// SQL: ... GROUP BY "lname"
```

You can also mix select aliases with table columns:

```typescript
const results = await db
  .from(Users)
  .select(({ users }) => ({ lname: lower(users.username), total: count("*") }))
  .groupBy(({ users }, { lname }) => [lname, users.type]);
// SQL: ... GROUP BY "lname", "users"."type"
```

### HAVING

Use `.having()` with a callback to filter grouped results. It supports aggregate-to-literal and aggregate-to-aggregate comparisons:

```typescript
import { count, gte } from "durcno";

// Only return groups with 2 or more rows
const busyTypes = await db
  .from(Users)
  .select(({ users }) => ({ type: users.type, total: count("*") }))
  .groupBy(({ users }) => [users.type])
  .having(() => gte(count("*"), 2));
```

**Aggregate-to-aggregate:**

```typescript
import { count, sum, gt } from "durcno";

const results = await db
  .from(Users)
  .select(({ users }) => ({
    type: users.type,
    sumScore: sum(users.score),
    total: count("*"),
  }))
  .groupBy(({ users }) => [users.type])
  .having(({ users }) => gt(sum(users.score), count("*")));
```

:::note

`.having()` can be used without explicit `.groupBy()`. In that case, auto GROUP BY still fires (based on non-aggregate columns in `.select()`), and the HAVING clause is appended after it.

:::

### Full Chain

```typescript
import { eq, count, gte, asc } from "durcno";

const results = await db
  .from(Users)
  .select(({ users }) => ({ type: users.type, total: count("*") }))
  .where(({ users }) => eq(users.status, "active"))
  .groupBy(({ users }) => [users.type])
  .having(() => gte(count("*"), 2))
  .orderBy(({ users }) => asc(users.type))
  .limit(10);
// Clause order: WHERE → GROUP BY → HAVING → ORDER BY → LIMIT
```

## DISTINCT ON

Use `.distinctOn()` on the `SelectBuilder` (before `.select()`) to select only the first row for each unique combination of the specified columns, using PostgreSQL's `DISTINCT ON (...)` syntax.

:::info

When using `DISTINCT ON`, the distinct columns must match the leftmost `ORDER BY` columns. This is a PostgreSQL requirement.

:::

### Single Column

```typescript
import { asc } from "durcno";

// Get one user per type (e.g., one "admin", one "user")
const onePerType = await db
  .from(Users)
  .distinctOn(({ users }) => users.type)
  .select("*");
  .orderBy(({ users }) => asc(users.type));
```

### Multiple Columns

Pass an array of columns to `.distinctOn()` for compound distinct expressions:

```typescript
// Get one user per (type, status) combination
const onePerTypeAndStatus = await db
  .from(Users)
  .distinctOn(({ users }) => [users.type, users.status])
  .select("*");
  .orderBy(({ users }) => [asc(users.type), asc(users.status)]);
```

### With Specific Columns and WHERE

Combine `.distinctOn()` with `.select()`, `.where()`, and `.orderBy()`:

```typescript
import { eq, asc, desc } from "durcno";

const latestAdminPerType = await db
  .from(Users)
  .distinctOn(({ users }) => users.type)
  .select(({ users }) => ({ type: users.type, username: users.username }))
  .where(({ users }) => eq(users.type, "admin"))
  .orderBy(({ users }) => [asc(users.type), desc(users.createdAt)]);
// Type: { type: "admin" | "user"; username: string }[]
```

## Method Chaining

All methods can be chained in a fluent API:

```typescript
const results = await db
  .from(Users)
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    username: users.username,
    title: posts.title,
  }))
  .where(({ users }) => eq(users.type, "admin"))
  .orderBy(({ posts }) => desc(posts.createdAt))
  .limit(10)
  .offset(0);
```

## Related

- [Filters](../Expressions/filters.md) — Complete list of filter operators for `.where()` conditions.