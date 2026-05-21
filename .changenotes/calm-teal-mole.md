---
bump: major
---

# change!(insert): replace $insertReturning with returning("\*")

The `db.$insertReturning()` shortcut has been removed. Use `.insert().values(...).returning("*")` instead to insert a row and get back all columns including auto-generated values.

`returning("*")` is a new overload on `InsertQuery` that emits `RETURNING *` and returns a fully-typed array of the inserted rows. It works for both single-row and multi-row inserts.

```typescript
// Before (removed)
const user = await db.$insertReturning(Users, {
  username: "john",
  type: "user",
});

// After
const [user] = await db
  .insert(Users)
  .values({ username: "john", type: "user" })
  .returning("*");

console.log(user.id); // auto-generated ID
console.log(user.createdAt); // auto-generated timestamp
```