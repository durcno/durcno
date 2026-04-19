---
sidebar_position: 9
---

# Transaction

Use `db.transaction()` to execute multiple queries as a single atomic operation. If any query fails, all changes are automatically rolled back.

## Basic Usage

```typescript
import { db } from "./db";
import { Users, Posts } from "./db/schema";
import { eq } from "durcno";

const result = await db.transaction(async (tx) => {
  // Create a new user
  const [user] = await tx
    .insert(Users)
    .values({ username: "john", type: "user" })
    .returning({ id: true });

  // Create a post for the user
  await tx.insert(Posts).values({
    userId: user.id,
    title: "My First Post",
  });

  // Return data from the transaction
  return user;
});

console.log(result); // { id: 1 }
```

## Transaction Context

The transaction callback receives a `tx` object that provides the same methods as `db`:

| Method             | Description              |
| ------------------ | ------------------------ |
| `tx.from(table)`   | Start a SELECT query     |
| `tx.insert(table)` | Start an INSERT query    |
| `tx.update(table)` | Start an UPDATE query    |
| `tx.delete(table)` | Start a DELETE query     |
| `tx.query(table)`  | Relational Query Builder |

:::warning
Always use `tx` (the transaction context) inside the callback, not `db`. Using `db` will execute queries outside the transaction.
:::

## Automatic Rollback

If any error occurs inside the transaction, all changes are automatically rolled back:

```typescript
try {
  await db.transaction(async (tx) => {
    // This insert succeeds
    await tx.insert(Users).values({ username: "john", type: "user" });

    // This throws an error
    throw new Error("Something went wrong!");

    // This insert is never executed
    await tx.insert(Users).values({ username: "jane", type: "admin" });
  });
} catch (error) {
  // The first insert is rolled back
  console.log("Transaction failed:", error.message);
}
```

## Returning Values

The transaction returns whatever you return from the callback:

```typescript
// Return a single value
const userId = await db.transaction(async (tx) => {
  const [user] = await tx
    .insert(Users)
    .values({ username: "john", type: "user" })
    .returning({ id: true });
  return user.id;
});
// Type: number

// Return an object
const result = await db.transaction(async (tx) => {
  const [user] = await tx
    .insert(Users)
    .values({ username: "john", type: "user" })
    .returning({ id: true, username: true });

  const posts = await tx.from(Posts).select().where(eq(Posts.userId, user.id));

  return { user, posts };
});
// Type: { user: { id: number; username: string }, posts: Post[] }
```

## Practical Examples

### Transfer Operation

A classic example of transactions—transferring funds between accounts:

```typescript
await db.transaction(async (tx) => {
  // Deduct from source account
  await tx
    .update(Accounts)
    .set({ balance: sql`balance - 100` })
    .where(eq(Accounts.id, sourceId));

  // Add to destination account
  await tx
    .update(Accounts)
    .set({ balance: sql`balance + 100` })
    .where(eq(Accounts.id, destId));
});
// Both updates succeed or both fail
```

### Create User with Profile

Create related records atomically:

```typescript
const user = await db.transaction(async (tx) => {
  // Create user
  const [newUser] = await tx
    .insert(Users)
    .values({ username: "john", type: "user" })
    .returning({ id: true, username: true });

  // Create user profile
  await tx.insert(UserProfiles).values({
    userId: newUser.id,
    bio: "Hello, world!",
  });

  // Create initial settings
  await tx.insert(UserSettings).values({
    userId: newUser.id,
    theme: "dark",
    notifications: true,
  });

  return newUser;
});
```

### Conditional Updates

Perform conditional logic within transactions:

```typescript
await db.transaction(async (tx) => {
  // Check current state
  const [user] = await tx
    .from(Users)
    .select({ type: Users.type })
    .where(eq(Users.id, userId));

  if (user.type === "user") {
    // Promote to admin
    await tx.update(Users).set({ type: "admin" }).where(eq(Users.id, userId));

    // Log the promotion
    await tx.insert(AuditLog).values({
      action: "promote_to_admin",
      userId: userId,
    });
  }
});
```

## Connection Behavior

Each transaction acquires a dedicated client from the connection pool:

- The client is reserved exclusively for the transaction
- All queries within the transaction use the same connection
- The client is automatically returned to the pool when the transaction completes
- If an error occurs, the transaction is rolled back before releasing the client

```typescript
// Transaction acquires a client from the pool
await db.transaction(async (tx) => {
  // All queries here use the same pooled connection
  await tx.insert(Users).values({ ... });
  await tx.from(Users).select();
});
// Client is released back to the pool
```

## Error Handling

Handle transaction errors appropriately:

```typescript
try {
  await db.transaction(async (tx) => {
    await tx.insert(Users).values({ username: "john", type: "user" });
    // ... more operations
  });
  console.log("Transaction successful");
} catch (error) {
  if (error.code === "23505") {
    // Unique violation
    console.log("User already exists");
  } else {
    console.log("Transaction failed:", error.message);
  }
}
```

## Best Practices

1. **Keep transactions short**: Long-running transactions can cause lock contention
2. **Don't mix `db` and `tx`**: Always use the transaction context (`tx`) inside callbacks
3. **Handle errors**: Wrap transactions in try-catch for proper error handling
4. **Return early on validation**: Validate data before starting the transaction when possible
5. **Avoid external side effects**: Don't send emails or call external APIs inside transactions—they can't be rolled back