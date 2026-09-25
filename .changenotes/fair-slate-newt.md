---
bump: major
---

# change(qb)!: align insert, delete, and select methods with sql syntax

Renames core query builder entry methods across `Database` and `WithStatement` to more closely mirror SQL statement syntax:

- Renames `db.insert()` to `db.insertInto()` (and `with(...).insert()` to `with(...).insertInto()`).
- Renames `db.delete()` to `db.deleteFrom()` (and `with(...).delete()` to `with(...).deleteFrom()`).

Calling `.select()` with no arguments is no longer allowed. Selecting all table columns now requires explicitly passing `"*"` (`select("*")`), aligning with standard SQL `SELECT *` semantics while preserving callback-based selection for projecting specific columns.

```typescript
// Insert into table
await db.insertInto(Users).values({
  name: "Alice",
  email: "alice@example.com",
});

// Delete from table
await db.deleteFrom(Users).where(eq(Users.id, 1));

// Select all columns explicitly
const allUsers = await db.from(Users).select("*");

// Select specific columns
const userProfiles = await db.from(Users).select(({ users }) => ({
  id: users.id,
  name: users.name,
}));
```
