---
sidebar_position: 4
---

# Delete

Use `db.delete()` to remove rows from a table. The delete builder supports filtering and returning deleted data.

## Methods

### Query methods (DeleteQuery)

| Method              | Description                            |
| ------------------- | -------------------------------------- |
| `.where(condition)` | Filter which rows will be deleted      |
| `.returning()`      | Specify columns to return after delete |

## Basic Usage

### Delete with WHERE

Always use `.where()` to specify which rows to delete:

```typescript
import { db } from "./db/index.ts";
import { Users } from "./db/schema.ts";
import { eq } from "durcno";

// Delete a specific user
await db.delete(Users).where(eq(Users.id, 1));
```

:::warning
Without a `.where()` clause, the delete will remove **all rows** from the table. Always include a filter unless you intend to delete everything.
:::

## Complex Filters

Use filter operators for complex conditions:

```typescript
import { and, eq, lte, or } from "durcno";

// Delete all admin users
await db.delete(Users).where(eq(Users.type, "admin"));

// Delete users matching multiple conditions
await db
  .delete(Users)
  .where(
    and(eq(Users.type, "user"), lte(Users.createdAt, new Date("2023-01-01"))),
  );

// Delete users matching either condition
await db
  .delete(Users)
  .where(
    or(eq(Users.email, "spam@example.com"), eq(Users.username, "spammer")),
  );
```

## Returning Deleted Data

Use `.returning()` to get data from deleted rows:

```typescript
// Return specific columns from deleted rows
const deleted = await db
  .delete(Users)
  .where(eq(Users.id, 1))
  .returning({ id: true, username: true });
// Type: { id: number; username: string }[]

// Return all columns except some
const deleted = await db
  .delete(Users)
  .where(eq(Users.id, 1))
  .returning({ createdAt: false });
// Type: { id: number; username: string; email: string | null; type: "admin" | "user" }[]
```

### Without Returning

Without `.returning()`, the delete returns `null`:

```typescript
const result = await db.delete(Users).where(eq(Users.id, 1));
// Type: null
```

## Method Chaining Order

`.where()` and `.returning()` can be chained in any order:

```typescript
// These are equivalent
await db.delete(Users).where(eq(Users.id, 1)).returning({ id: true });
await db.delete(Users).returning({ id: true }).where(eq(Users.id, 1));
```

## Delete All Rows

To delete all rows from a table (use with caution):

```typescript
// ⚠️ Deletes ALL rows from the table
await db.delete(Users);
```

:::danger
Deleting all rows is irreversible. Consider using a WHERE clause or creating a backup before performing bulk deletions.
:::

## Practical Examples

### Soft Delete Pattern

Instead of actually deleting, you might update a flag:

```typescript
// Soft delete - mark as deleted instead of removing
await db
  .update(Users)
  .set({ deletedAt: sql`NOW()` })
  .where(eq(Users.id, 1));
```

### Delete with Confirmation

Return deleted data to confirm what was removed:

```typescript
const deletedUsers = await db
  .delete(Users)
  .where(eq(Users.type, "user"))
  .returning({ id: true, username: true, email: true });

console.log(`Deleted ${deletedUsers.length} users:`);
deletedUsers.forEach((user) => {
  console.log(`  - ${user.username} (${user.email})`);
});
```

### Cascade Considerations

When deleting rows that have foreign key relationships, ensure you handle cascades appropriately in your schema or delete related records first:

```typescript
// Delete user's posts first (if no cascade)
await db.delete(Posts).where(eq(Posts.userId, 1));

// Then delete the user
await db.delete(Users).where(eq(Users.id, 1));
```

## Related

- [Filters](./filters.md) — Complete list of filter operators for `.where()` conditions.