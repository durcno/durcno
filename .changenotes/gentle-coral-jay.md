---
bump: minor
---

# feat(filters): support null and undefined in and/or combinators

`and()` and `or()` now accept `null` and `undefined` as condition arguments and silently ignore them. This makes it straightforward to pass optional filters without needing to pre-filter the arguments array.

```typescript
// Conditions can now be null/undefined without breaking the query
const result = await db
  .from(Users)
  .select()
  .where(
    and(
      eq(Users.type, "admin"),
      someFlag ? eq(Users.status, "active") : undefined,
      otherFlag ? isNotNull(Users.email) : null,
    ),
  );
```