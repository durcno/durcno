---
bump: minor
---

# feat(insert): add ON CONFLICT support with doNothing and doUpdateSet

`InsertQuery` now supports PostgreSQL `ON CONFLICT` clauses through a fluent, type-safe API.

Chain `.onConflict(...columns)` after `.values()` to define the conflict target, then choose an action:

- `.doNothing()` — skip the insert when a conflict occurs
- `.doUpdateSet(set, where?)` — upsert rows by returning a column assignment map from a callback

```javascript
await db
  .insert(Users)
  .values({ username: "alice", email: "new@example.com", type: "user" })
  .onConflict(Users.username)
  .doUpdateSet(({ excluded }) => ({
    email: excluded.email,
    type: Users.type,
  }));

await db
  .insert(Users)
  .values({ username: "alice", type: "user" })
  .onConflict()
  .doNothing();
```

The `excluded` object is a fully typed clone of the table columns, bound to PostgreSQL's `EXCLUDED` pseudo-table.

- Generated SQL uses `EXCLUDED."column"` when appropriate.
- `doUpdateSet()` is only available after providing at least one conflict target column.
- Both `.doNothing()` and `.doUpdateSet()` return the parent `InsertQuery`, so `.returning()` can be chained afterward.