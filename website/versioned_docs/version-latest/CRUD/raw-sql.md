---
sidebar_position: 8.7
---

# Raw SQL

While Durcno's query builder handles most use cases, sometimes you need to execute raw SQL queries directly. The `db.raw()` method provides a way to run arbitrary SQL with parameterized queries and custom result handlers.

## Basic Usage

```typescript
import { db } from "./db/index.ts";

// Execute a raw SELECT query
const result = await db.raw<{ id: number; username: string }[]>(
  "SELECT id, username FROM users",
  [],
  (rows) => rows,
);
```

## Method Signature

```typescript
db.raw<TReturn>(
  query: string,
  args?: (string | number | null)[],
  rowsHandler?: (rows: any[]) => TReturn
): Promise<TReturn>
```

| Parameter     | Type                           | Description                                                                |
| ------------- | ------------------------------ | -------------------------------------------------------------------------- |
| `query`       | `string`                       | The raw SQL query string with `$1`, `$2`, etc. placeholders for parameters |
| `args`        | `(string \| number \| null)[]` | Array of parameter values to bind to query placeholders                    |
| `rowsHandler` | `(rows: any[]) => TReturn`     | Optional function to transform the result rows                             |

## Parameterized Queries

Always use parameterized queries to prevent SQL injection. Use `$1`, `$2`, etc. as placeholders:

```typescript
// Query with parameters
const result = await db.raw<{ username: string; age: number }[]>(
  "SELECT username, age FROM users WHERE age >= $1 AND type = $2",
  [30, "admin"],
  (rows) => rows,
);
```

### Multiple Parameters

```typescript
// Complex query with multiple parameters
const result = await db.raw<{ username: string }[]>(
  `SELECT username FROM users 
   WHERE age > $1 AND "is_active" = $2 AND type = $3`,
  [25, "true", "user"],
  (rows) => rows,
);
```

## Custom Row Handlers

The third parameter allows you to transform query results:

```typescript
// Transform usernames to uppercase
const usernames = await db.raw("SELECT username FROM users", [], (rows) =>
  rows.map((r) => r.username.toUpperCase()),
);
// Returns: ["ALICE", "BOB", "CHARLIE"]

// Extract a single value
const count = await db.raw("SELECT COUNT(*) as count FROM users", [], (rows) =>
  Number(rows[0].count),
);
// Returns: 42

// Pass rows through unchanged
const users = await db.raw<{ id: number; username: string }[]>(
  "SELECT id, username FROM users",
  [],
  (rows) => rows,
);
```

## Common Operations

### SELECT Queries

```typescript
// Simple SELECT
const users = await db.raw<{ username: string }[]>(
  "SELECT username FROM users",
  [],
  (rows) => rows,
);

// SELECT with JOIN
const postsWithAuthors = await db.raw<{ username: string; title: string }[]>(
  `SELECT u.username, p.title 
   FROM users u 
   JOIN posts p ON u.id = p."user_id"`,
  [],
  (rows) => rows,
);

// Aggregate queries
const result = await db.raw<{ count: string }[]>(
  "SELECT COUNT(*) as count FROM users",
  [],
  (rows) => rows,
);
const count = Number.parseInt(result[0].count);
```

### INSERT Queries

```typescript
// Insert a single row
await db.raw(
  `INSERT INTO users (username, email, type, status, role) 
   VALUES ($1, $2, $3, $4, $5)`,
  ["newuser", "user@example.com", "user", "active", "user"],
  undefined,
);

// Insert with RETURNING
const inserted = await db.raw<{ id: number }[]>(
  `INSERT INTO users (username, email, type, status, role) 
   VALUES ($1, $2, $3, $4, $5) 
   RETURNING id`,
  ["newuser", "user@example.com", "user", "active", "user"],
  (rows) => rows,
);
```

### UPDATE Queries

```typescript
// Update by ID
await db.raw(
  "UPDATE users SET username = $1 WHERE id = $2",
  ["updated_name", "123"],
  undefined,
);

// Update with conditions
await db.raw(
  "UPDATE users SET status = $1 WHERE type = $2 AND age >= $3",
  ["inactive", "user", 65],
  undefined,
);
```

### DELETE Queries

```typescript
// Delete by ID
await db.raw("DELETE FROM users WHERE id = $1", ["123"], undefined);

// Delete with conditions
await db.raw(
  "DELETE FROM users WHERE status = $1 AND last_login < $2",
  ["inactive", "2024-01-01"],
  undefined,
);
```

## Advanced Usage

### DDL Statements

You can execute Data Definition Language statements:

```typescript
// Create a temporary table
await db.raw(
  `CREATE TEMP TABLE temp_results (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100)
  )`,
  [],
  undefined,
);

// Insert into temporary table
await db.raw(
  "INSERT INTO temp_results (name) VALUES ($1)",
  ["test"],
  undefined,
);

// Query from temporary table
const results = await db.raw<{ name: string }[]>(
  "SELECT name FROM temp_results",
  [],
  (rows) => rows,
);
```

### Complex WHERE Clauses

```typescript
const result = await db.raw<{ username: string }[]>(
  `SELECT username FROM users 
   WHERE (type = $1 AND age >= $2) 
      OR (status = $3 AND created_at > $4)`,
  ["admin", 30, "active", "2024-01-01"],
  (rows) => rows,
);
```

### Using NULL Values

```typescript
// Insert with NULL
await db.raw(
  "INSERT INTO users (username, email) VALUES ($1, $2)",
  ["testuser", null],
  undefined,
);

// Query NULL values
const usersWithoutEmail = await db.raw<{ username: string }[]>(
  "SELECT username FROM users WHERE email IS NULL",
  [],
  (rows) => rows,
);
```

## Empty Results

Raw queries return an empty array when no rows match:

```typescript
const result = await db.raw<{ username: string }[]>(
  "SELECT username FROM users WHERE username = $1",
  ["nonexistent"],
  (rows) => rows,
);

console.log(result); // []
```

## Type Safety

The generic type parameter `TReturn` allows you to specify the expected return type:

```typescript
// Specify the return type
const users = await db.raw<{ id: number; username: string }[]>(
  "SELECT id, username FROM users",
  [],
  (rows) => rows,
);

// TypeScript knows the shape of 'users'
users.forEach((user) => {
  console.log(user.id, user.username); // ✓ Type-safe access
});
```

:::caution Type Safety Limitations
Unlike the query builder methods, `db.raw()` does not validate your SQL against the schema at compile time. The generic type parameter is purely for type annotation—ensure your SQL matches the specified type.
:::

## When to Use Raw SQL

Use `db.raw()` when you need to:

- Execute complex queries not supported by the query builder
- Use PostgreSQL-specific features or functions
- Run administrative queries (DDL, maintenance)
- Optimize performance-critical queries
- Access database features ahead of query builder support

For standard CRUD operations, prefer the type-safe query builder methods:

- [Select](./select) for `SELECT` queries
- [Insert](./insert) for `INSERT` operations
- [Update](./update) for `UPDATE` operations
- [Delete](./delete) for `DELETE` operations