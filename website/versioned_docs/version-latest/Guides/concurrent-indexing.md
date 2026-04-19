---
sidebar_position: 3
---

# Concurrent Indexing

When creating or dropping indexes on large production tables, PostgreSQL acquires locks that block writes. `CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY` avoid this by building or removing the index without holding an exclusive lock, enabling zero-downtime index management.

## Creating a Concurrent Index

Use `.concurrently()` on the index builder before `.on()`:

```typescript
import {
  ddl,
  type DDLStatement,
  type MigrationOptions,
} from "durcno/migration";

export const options: MigrationOptions = {
  transaction: false, // Required for concurrent operations
};

export const statements: DDLStatement[] = [
  ddl
    .createIndex("idx_users_email")
    .concurrently()
    .on("public", "users", ["email"])
    .using("btree"),
];
```

Generates:

```sql
CREATE INDEX CONCURRENTLY idx_users_email ON "public"."users" USING btree ("email");
```

### Concurrent Unique Index

Chain `.unique()` as usual:

```typescript
ddl.createIndex("idx_users_email_unique")
  .unique()
  .concurrently()
  .on("public", "users", ["email"])
  .using("btree"),
```

Generates:

```sql
CREATE UNIQUE INDEX CONCURRENTLY idx_users_email_unique ON "public"."users" USING btree ("email");
```

## Dropping a Concurrent Index

```typescript
export const statements: DDLStatement[] = [
  ddl.dropIndex("idx_users_email").concurrently(),
];
```

Generates:

```sql
DROP INDEX CONCURRENTLY idx_users_email;
```

## Transaction Requirement

:::caution
Concurrent index operations **cannot** run inside a transaction. You must set `transaction: false` in your migration options:

```typescript
export const options: MigrationOptions = {
  transaction: false,
};
```

If you forget this, PostgreSQL will raise an error at runtime.
:::

## When to Use

| Scenario                                 | Use Concurrent?                      |
| ---------------------------------------- | ------------------------------------ |
| Production table with active writes      | ✅ Yes                               |
| Small table or initial migration         | ❌ No — standard index is faster     |
| Index creation during maintenance window | ❌ No — exclusive lock is acceptable |

:::tip
Concurrent index builds take longer and use more resources than standard builds. Use them only when you need to avoid blocking writes on a live table.
:::