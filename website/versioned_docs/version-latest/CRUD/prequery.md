---
sidebar_position: 8.5
---

# Prepared Query

Use `prequery()` to create reusable, type-safe prepared statements that can be executed multiple times with different parameter values. Prepared queries compile the SQL once and reuse the compiled query for better performance.

## Basic Usage

### Creating a Prepared Query

```typescript
import { prequery, eq } from "durcno";
import { db } from "./db/index.ts";
import { Users } from "./db/schema.ts";

// Create a prepared query with a username parameter
const findUserByUsername = prequery(
  { username: Users.username.arg() },
  (args) => {
    return db
      .prepare()
      .from(Users)
      .select()
      .where(eq(Users.username, args.username));
  },
);
```

### Executing a Prepared Query

Use `.run()` to execute the prepared query with specific values:

```typescript
// Execute with type-safe parameters
const users = await findUserByUsername.run(db, { username: "john" });
// Type: { id: number; username: string; email: string | null; type: "admin" | "user"; createdAt: Date }[]
```

:::warning
Prepared queries does not provide runtime validation of argument type. Make sure to validate the argument values before calling `.run()`.
:::

## How It Works

1. **Define arguments**: Create argument placeholders using `Column.arg()` method
2. **Build the query**: Use `db.prepare().from(Table)` to build the query structure
3. **Wrap with prequery**: Pass arguments and query builder to `prequery()`
4. **Execute**: Call `.run(db, values)` to execute with specific values

## Multiple Arguments

You can define multiple arguments in a single prepared query:

```typescript
import { prequery, and, eq } from "durcno";
import { db } from "./db/index.ts";
import { Users } from "./db/schema.ts";

const findUser = prequery(
  {
    username: Users.username.arg(),
    email: Users.email.arg(),
    type: Users.type.arg(),
  },
  (args) => {
    return db
      .prepare()
      .from(Users)
      .select()
      .where(
        and(
          eq(Users.username, args.username),
          eq(Users.email, args.email),
          eq(Users.type, args.type),
        ),
      );
  },
);

// Execute with all required parameters
const result = await findUser.run(db, {
  username: "john",
  email: "john@example.com",
  type: "admin",
});
```

## Selective Column Selection

You can select specific columns in your prepared query:

```typescript
const findUserInfo = prequery({ id: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .from(Users)
    .select({ username: Users.username, email: Users.email })
    .where(eq(Users.id, args.id));
});

const result = await findUserInfo.run(db, { id: 1 });
// Type: { username: string; email: string | null }[]
```

## Complex Conditions

### OR Conditions

```typescript
import { prequery, or, eq } from "durcno";

const findByEitherUsername = prequery(
  {
    username1: Users.username.arg(),
    username2: Users.username.arg(),
  },
  (args) => {
    return db
      .prepare()
      .from(Users)
      .select({ id: Users.id, username: Users.username })
      .where(
        or(
          eq(Users.username, args.username1),
          eq(Users.username, args.username2),
        ),
      );
  },
);

const result = await findByEitherUsername.run(db, {
  username1: "john",
  username2: "jane",
});
// Type: { id: number; username: string }[]
```

### Combined AND/OR Conditions

```typescript
import { prequery, and, or, eq } from "durcno";

const complexQuery = prequery(
  {
    username: Users.username.arg(),
    type1: Users.type.arg(),
    type2: Users.type.arg(),
  },
  (args) => {
    return db
      .prepare()
      .from(Users)
      .select({ username: Users.username, type: Users.type })
      .where(
        and(
          eq(Users.username, args.username),
          or(eq(Users.type, args.type1), eq(Users.type, args.type2)),
        ),
      );
  },
);

const result = await complexQuery.run(db, {
  username: "john",
  type1: "admin",
  type2: "user",
});
// Type: { username: string; type: "admin" | "user" }[]
```

## Working with Different Column Types

### Numeric Arguments

```typescript
import { prequery, eq } from "durcno";
import { Posts } from "./db/schema.ts";

const findPostsByUser = prequery({ userId: Posts.userId.arg() }, (args) => {
  return db.prepare().from(Posts).select().where(eq(Posts.userId, args.userId));
});

const posts = await findPostsByUser.run(db, { userId: 1 });
```

### Enum Arguments

```typescript
const findByUserType = prequery({ userType: Users.type.arg() }, (args) => {
  return db
    .prepare()
    .from(Users)
    .select({ id: Users.id, type: Users.type })
    .where(eq(Users.type, args.userType));
});

// TypeScript ensures only valid enum values can be passed
const admins = await findByUserType.run(db, { userType: "admin" });
// Type: { id: number; type: "admin" | "user" }[]
```

### Date/Timestamp Arguments

```typescript
const findUsersByDate = prequery(
  { createdAt: Users.createdAt.arg() },
  (args) => {
    return db
      .prepare()
      .from(Users)
      .select({ id: Users.id, createdAt: Users.createdAt })
      .where(eq(Users.createdAt, args.createdAt));
  },
);

const result = await findUsersByDate.run(db, { createdAt: new Date() });
// Type: { id: number; createdAt: Date }[]
```

## Type Safety

Prepared queries provide full type safety:

- **Parameter types**: Arguments are typed based on the column type
- **Return types**: Results are inferred from the selected columns
- **Enum validation**: Only valid enum values can be passed as arguments

```typescript
const findUser = prequery({ id: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .from(Users)
    .select({ username: Users.username })
    .where(eq(Users.id, args.id));
});

// ✅ Correct: id is a number
await findUser.run(db, { id: 1 });

// ❌ TypeScript error: id should be number, not string
await findUser.run(db, { id: "1" });
```

## Benefits of Prepared Queries

1. **Performance**: SQL is parsed and planned once, then reused
2. **Type Safety**: Full TypeScript inference for parameters and results
3. **Reusability**: Define once, execute many times with different values

## API Reference

### `prequery(args, statement)`

Creates a prepared statement.

| Parameter   | Type                     | Description                                                 |
| ----------- | ------------------------ | ----------------------------------------------------------- |
| `args`      | `Record<string, Arg>`    | Object mapping argument names to column arguments           |
| `statement` | `(args) => QueryBuilder` | Function that builds the query using the provided arguments |

### `Column.arg()`

Creates an argument placeholder for a column, used in prepared queries.

```typescript
const arg = Users.username.arg();
```

### `PreparedStatement.run(db, values)`

Executes the prepared statement with the provided values.

| Parameter | Type                | Description                                    |
| --------- | ------------------- | ---------------------------------------------- |
| `db`      | `DB \| Transaction` | Database instance or transaction instance      |
| `values`  | `Record<string, T>` | Object with values matching the argument types |

Returns a `Promise` that resolves to the query results.