---
bump: minor
---

# feat(indexes): support partial indexes and custom index names

Add support for partial indexes via `.where()` on table indexes and custom index naming in `index()` and `uniqueIndex()`.

### Partial Indexes

Indexes now support a `.where()` method that specifies a predicate expression for partial indexing. This reduces index size and write overhead while accelerating queries matching the condition:

```typescript
export const Users = table(
  "public",
  "users",
  {
    id: pk(),
    email: varchar({ length: 255, notNull }),
    status: varchar({ length: 50, notNull }),
    deletedAt: timestamptz({}),
  },
  {
    indexes: (t) => [
      // Partial index for active users
      index([t.email]).where(eq(t.status, "active")),

      // Partial unique index for soft deletes
      uniqueIndex("users_active_email_idx", [t.email]).where(
        isNull(t.deletedAt),
      ),
    ],
  },
);
```

The `.where()` method accepts any filter operator (`eq`, `isNull`, `and`, `or`, etc.), raw `sql`, or a callback. Method chaining mirrors SQL syntax, supporting `.using().where()`.

### Custom Index Names

`index()` and `uniqueIndex()` now accept an explicit index name as an optional first parameter, while preserving the existing signature that auto-generates names:

```typescript
// Explicit custom name
index("idx_orders_user_id", [Orders.userId]);
uniqueIndex("uidx_users_active_email", [Users.email]).where(
  isNull(Users.deletedAt),
);

// Auto-generated name (existing behavior)
index([Orders.userId]);
```
