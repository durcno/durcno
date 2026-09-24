---
sidebar_position: 1
---

# Select

Use `db.from()` to build SELECT queries. The query builder provides a fluent API for selecting columns, joining tables, filtering, sorting, and paginating results.

## Methods

### Builder methods (SelectBuilder)

| Method                        | Description                                      |
| ----------------------------- | ------------------------------------------------ |
| `.innerJoin(table, callback)` | Add an inner join with `() => condition`         |
| `.leftJoin(table, callback)`  | Add a left join with `() => condition`           |
| `.distinctOn(callback)`       | Apply DISTINCT ON via `() => col` or `[...cols]` |
| `.select("*")`                | Select all columns                               |
| `.select(callback)`           | Select specific columns via `() => ({ ... })`    |

### Query methods (SelectQuery)

| Method               | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `.where(callback)`   | Filter results via `() => condition`                            |
| `.groupBy(callback)` | Explicit GROUP BY via `() => [cols]` or `(_, aliases) => [...]` |
| `.having(callback)`  | Filter grouped results via `() => condition` (HAVING clause)    |
| `.orderBy(callback)` | Sort results via `() => order` or `(_, aliases) => order`       |
| `.limit(n)`          | Limit number of results (`n` can be `number` or `bigint`)       |
| `.offset(n)`         | Skip n results (`n` can be `number` or `bigint`)                |

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

Pass a callback to `.select()` to choose specific columns:

```typescript
// Select only username
const usernames = await db.from(Users).select(() => ({
  username: Users.username,
}));
// Type: { username: string }[]

// Select multiple columns
const userInfo = await db.from(Users).select(() => ({
  id: Users.id,
  email: Users.email,
}));
// Type: { id: bigint; email: string | null }[]
```

### Column Aliasing

You can alias columns by using different keys in the select object:

```typescript
const users = await db.from(Users).select(() => ({
  name: Users.username, // Alias "username" as "name"
  mail: Users.email, // Alias "email" as "mail"
}));
// Type: { name: string; mail: string | null }[]
```

### Selecting Expressions, Literals & Raw SQL

The `.select()` object projection can include more than just columns. You can project:

- **SQL functions**: `lower(Users.username)`, `count("*")`, `coalesce(...)`, etc.
- **Literal constants**: strings, numbers, bigints, and booleans
- **Literal null**: `null` or `sql.null`
- **Raw SQL expressions**: `sql<T>` template fragments with typed return inference

```typescript
import { sql, lower, coalesce } from "durcno";

const results = await db.from(Users).select(() => ({
  id: Users.id,
  normalizedEmail: lower(coalesce(Users.email, "")),
  greeting: "Welcome",
  statusFlag: true,
  retryCount: 0,
  fallbackDate: null,
  computedScore: sql<number>`${Users.points} * 1.5`,
}));
// Type: {
//   id: bigint;
//   normalizedEmail: string;
//   greeting: string;
//   statusFlag: boolean;
//   retryCount: number;
//   fallbackDate: null;
//   computedScore: number;
// }[]
```

## Filtering with WHERE

Use `.where()` with a callback receiving the tables view to filter results. See [Filters](../Expressions/filters.md) for all available operators.

```typescript
import { eq, and, gte } from "durcno";

// Simple equality filter
const admins = await db
  .from(Users)
  .select("*")
  .where(() => eq(Users.type, "admin"));

// Multiple conditions with AND
const recentAdmins = await db
  .from(Users)
  .select("*")
  .where(() =>
    and(eq(Users.type, "admin"), gte(Users.createdAt, new Date("2024-01-01"))),
  );
```

## Sorting with ORDER BY

Use `.orderBy()` with `asc()` or `desc()` inside a callback to sort results:

```typescript
import { asc, desc } from "durcno";

// Sort by username ascending
const users = await db
  .from(Users)
  .select("*")
  .orderBy(() => asc(Users.username));

// Sort by creation date descending (newest first)
const recentUsers = await db
  .from(Users)
  .select("*")
  .orderBy(() => desc(Users.createdAt));
```

### Multi-Column Sorting

Return an array from `.orderBy()` to sort by multiple columns:

```typescript
// Sort by type ascending, then by username ascending
const sortedUsers = await db
  .from(Users)
  .select("*")
  .orderBy(() => [asc(Users.type), asc(Users.username)]);

// Sort by type ascending, then by creation date descending
const mixedSort = await db
  .from(Users)
  .select("*")
  .orderBy(() => [asc(Users.type), desc(Users.createdAt)]);
```

### Sorting with Joins

When using joins, you can sort by columns from any joined table in the view:

```typescript
import { eq, asc, desc } from "durcno";
import { Users, Posts } from "./db/schema.ts";

// Sort by username (Users), then by post creation date (Posts)
const usersWithPosts = await db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(() => ({
    username: Users.username,
    title: Posts.title,
  }))
  .orderBy(() => [asc(Users.username), desc(Posts.createdAt)]);
```

### Sorting with Select Aliases

The `.orderBy()` callback also receives a second parameter with output aliases defined in `.select()`:

```typescript
import { count, desc } from "durcno";

const stats = await db
  .from(Users)
  .select(() => ({
    userType: Users.type,
    userCount: count("*"),
  }))
  .groupBy(() => [Users.type])
  .orderBy((_, { userCount }) => desc(userCount));
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
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(() => ({
    username: Users.username,
    title: Posts.title,
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
    .select(() => ({ id: Users.id, username: Users.username }))
    .where(() => eq(Users.status, "active")),
);

const rows = await db
  .with(activeUsers)
  .from((ctes) => ctes.activeUsers)
  .select("*")
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
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => [Users.type])
  .orderBy(() => asc(Users.type));
// SQL: ... GROUP BY "users"."type" ORDER BY ...
```

**Multiple columns:**

```typescript
const byTypeAndStatus = await db
  .from(Users)
  .select(() => ({
    type: Users.type,
    status: Users.status,
    total: count("*"),
  }))
  .groupBy(() => [Users.type, Users.status]);
```

**Scalar expression:**

```typescript
import { lower, count } from "durcno";

const byLowerUsername = await db
  .from(Users)
  .select(() => ({ lname: lower(Users.username), total: count("*") }))
  .groupBy(() => [lower(Users.username)]);
```

### Using Select Aliases

When `.select()` defines named aliases, `.groupBy()` receives them in the second parameter:

```typescript
import { lower, count } from "durcno";

const results = await db
  .from(Users)
  .select(() => ({ lname: lower(Users.username), total: count("*") }))
  .groupBy((_, { lname }) => [lname]);
// SQL: ... GROUP BY "lname"
```

You can also mix select aliases with table columns:

```typescript
const results = await db
  .from(Users)
  .select(() => ({ lname: lower(Users.username), total: count("*") }))
  .groupBy((_, { lname }) => [lname, Users.type]);
// SQL: ... GROUP BY "lname", "users"."type"
```

### HAVING

Use `.having()` with a callback to filter grouped results. It supports aggregate-to-literal and aggregate-to-aggregate comparisons:

```typescript
import { count, gte } from "durcno";

// Only return groups with 2 or more rows
const busyTypes = await db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .groupBy(() => [Users.type])
  .having(() => gte(count("*"), 2));
```

**Aggregate-to-aggregate:**

```typescript
import { count, sum, gt } from "durcno";

const results = await db
  .from(Users)
  .select(() => ({
    type: Users.type,
    sumScore: sum(Users.score),
    total: count("*"),
  }))
  .groupBy(() => [Users.type])
  .having(() => gt(sum(Users.score), count("*")));
```

:::note

`.having()` can be used without explicit `.groupBy()`. In that case, auto GROUP BY still fires (based on non-aggregate columns in `.select()`), and the HAVING clause is appended after it.

:::

### Full Chain

```typescript
import { eq, count, gte, asc } from "durcno";

const results = await db
  .from(Users)
  .select(() => ({ type: Users.type, total: count("*") }))
  .where(() => eq(Users.status, "active"))
  .groupBy(() => [Users.type])
  .having(() => gte(count("*"), 2))
  .orderBy(() => asc(Users.type))
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
  .distinctOn(() => Users.type)
  .select("*")
  .orderBy(() => asc(Users.type));
```

### Multiple Columns

Pass an array of columns to `.distinctOn()` for compound distinct expressions:

```typescript
// Get one user per (type, status) combination
const onePerTypeAndStatus = await db
  .from(Users)
  .distinctOn(() => [Users.type, Users.status])
  .select("*")
  .orderBy(() => [asc(Users.type), asc(Users.status)]);
```

### With Specific Columns and WHERE

Combine `.distinctOn()` with `.select()`, `.where()`, and `.orderBy()`:

```typescript
import { eq, asc, desc } from "durcno";

const latestAdminPerType = await db
  .from(Users)
  .distinctOn(() => Users.type)
  .select(() => ({ type: Users.type, username: Users.username }))
  .where(() => eq(Users.type, "admin"))
  .orderBy(() => [asc(Users.type), desc(Users.createdAt)]);
// Type: { type: "admin" | "user"; username: string }[]
```

## Method Chaining

All methods can be chained in a fluent API:

```typescript
const results = await db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(() => ({
    username: Users.username,
    title: Posts.title,
  }))
  .where(() => eq(Users.type, "admin"))
  .orderBy(() => desc(Posts.createdAt))
  .limit(10)
  .offset(0);
```

## Related

- [Filters](../Expressions/filters.md) — Complete list of filter operators for `.where()` conditions.