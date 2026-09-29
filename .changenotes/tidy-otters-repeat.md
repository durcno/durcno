---
bump: patch
---

# fix(db): make db.raw() rowsHandler argument optional

`db.raw()` required a `rowsHandler` callback positionally, even though passing `undefined` was already handled at runtime and the documentation listed the argument as optional. This made the common case — executing a raw query and getting the rows back — impossible to express without a redundant identity handler.

```typescript
// Before: had to pass a pass-through handler
const rows = await db.raw<{ id: bigint; }[]>(
  "SELECT id FROM users",
  [],
  (rows) => rows,
);

// After: rowsHandler is optional
const rows = await db.raw<{ id: bigint; }[]>("SELECT id FROM users");
```

This is a non-breaking change; existing three-argument calls behave exactly as before.
