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

## Execution Mode

When a migration contains multiple concurrent index operations, set `execution: "sequential"` so each statement is sent to the database individually rather than joined into a single query. This ensures each `CREATE INDEX CONCURRENTLY` (or `DROP INDEX CONCURRENTLY`) is an independent command, which is the safest approach for concurrent operations:

```typescript
export const options: MigrationOptions = {
  transaction: false, // Required for concurrent operations
  execution: "sequential", // Run each statement separately
};
```

| Value                | Behavior                                                        |
| -------------------- | --------------------------------------------------------------- |
| `"joined"` (default) | All statements concatenated and sent as a single query          |
| `"sequential"`       | Each statement sent to the database individually, one at a time |

## When to Use

| Scenario                                 | Use Concurrent?                      |
| ---------------------------------------- | ------------------------------------ |
| Production table with active writes      | ✅ Yes                               |
| Small table or initial migration         | ❌ No — standard index is faster     |
| Index creation during maintenance window | ❌ No — exclusive lock is acceptable |

:::tip
Concurrent index builds take longer and use more resources than standard builds. Use them only when you need to avoid blocking writes on a live table.
:::