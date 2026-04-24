---
sidebar_position: 0
---

# Overview

Durcno provides a type-safe, fluent API for performing CRUD (Create, Read, Update, Delete) operations on your PostgreSQL database. All operations are fully typed, giving you compile-time safety and excellent IDE autocompletion.

## Database Instance

After defining your schema and configuration, create a database instance:

```typescript
// db/index.ts
import { database } from "durcno";
import * as schema from "./schema.ts";
import config from "./durcno.config.ts";

export const db = database(schema, config);
```

The `db` instance provides methods for all database operations:

| Method                     | Description                            |
| -------------------------- | -------------------------------------- |
| `db.from(table)`           | Start a SELECT query                   |
| `db.insert(table)`         | Start an INSERT query                  |
| `db.update(table)`         | Start an UPDATE query                  |
| `db.delete(table)`         | Start a DELETE query                   |
| `db.query(table)`          | Relational Query Builder (RQB)         |
| `db.transaction(callback)` | Execute queries in a transaction       |
| `db.raw(sql, args)`        | Execute raw SQL queries                |
| `db.prepare()`             | Create a preparer for prepared queries |
| `db.close()`               | Close the database connection pool     |

### Query Shortcuts

Durcno provides `$`-prefixed utility functions for common query patterns:

| Method                                | Description                | Returns     |
| ------------------------------------- | -------------------------- | ----------- |
| `db.$count(table, where?)`            | Count rows in a table      | `number`    |
| `db.$exists(table, where?)`           | Check if any rows exist    | `boolean`   |
| `db.$first(table, where?)`            | Get the first matching row | `T \| null` |
| `db.$distinct(table, column, where?)` | Get unique column values   | `T[]`       |
| `db.$insertReturning(table, values)`  | Insert and return the row  | `T`         |

### Aggregate Functions

| Method                           | Description                 | Returns          |
| -------------------------------- | --------------------------- | ---------------- |
| `db.$sum(table, column, where?)` | Sum of a numeric column     | `number \| null` |
| `db.$avg(table, column, where?)` | Average of a numeric column | `number \| null` |
| `db.$min(table, column, where?)` | Minimum value of a column   | `number \| null` |
| `db.$max(table, column, where?)` | Maximum value of a column   | `number \| null` |

See [Query Shortcuts](./query-shortcuts) for detailed documentation on these utility functions.

## Query Execution

All query builders return a `QueryPromise` object that implements the Promise interface. You can execute queries using `await` or `.then()`:

```typescript
// Using await
const users = await db.from(Users).select();

// Using .then()
db.from(Users)
  .select()
  .then((users) => {
    console.log(users);
  });
```

## Type Safety

Durcno infers types from your schema, ensuring type-safe operations:

```typescript
// Return type is automatically inferred
const users = await db.from(Users).select();
// Type: { id: number; username: string; email: string | null; ... }[]

// Only valid columns are allowed
const result = await db.from(Users).select({
  username: Users.username,
});
// Type: { username: string }[]
```

## Raw SQL Queries

For cases where you need to execute raw SQL:

```typescript
// Execute raw query with parameterized values
const result = await db.raw<{ count: string }[]>(
  "SELECT COUNT(*) as count FROM users WHERE type = $1",
  ["admin"],
  (rows) => rows,
);
```

See [Raw SQL](./raw-sql) for comprehensive documentation on raw queries.

## Next Steps

- [Select](./select) - Learn about SELECT queries with `db.from()`
- [Insert](./insert) - Learn about INSERT operations with `db.insert()`
- [Update](./update) - Learn about UPDATE operations with `db.update()`
- [Delete](./delete) - Learn about DELETE operations with `db.delete()`
- [Filters](./filters) - Learn about WHERE conditions and operators
- [Relational Queries](./relational-query) - Learn about the Relational Query Builder
- [Query Shortcuts](./query-shortcuts) - Learn about `$`-prefixed utility functions
- [Prepared Query](./prequery) - Learn about reusable prepared statements
- [Transactions](./transaction) - Learn about database transactions
- [Raw SQL](./raw-sql) - Learn about executing raw SQL queries