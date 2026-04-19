---
sidebar_position: 3
---

# UUIDv7 over v4

UUIDv7 is a time-sortable UUID format that should be preferred over UUIDv4 for most use cases. Durcno defaults to v7 validation for `uuid()` columns for this reason.

:::tip
Keep `pk()` (auto-incrementing bigint) as your primary key and use UUID columns as additional public-facing identifiers. Integer PKs are smaller, faster to join on, and avoid the index bloat that comes with 128-bit keys.
:::

## Why prefer UUIDv7

- **Time-sortable**: UUIDv7 embeds a millisecond-precision timestamp, so rows inserted in order have naturally ascending IDs. This keeps B-tree indexes efficient and reduces page splits.
- **Better index locality**: Random UUIDv4 values scatter inserts across index pages, causing write amplification. UUIDv7 appends to the end of the index like a sequence — though an integer primary key with a separate UUID column is still the most performant layout.
- **Built-in creation timestamp**: You can extract the creation time from a UUIDv7 value without an extra column.
- **Same uniqueness guarantees**: UUIDv7 includes enough random bits to be globally unique, just like v4.

## When UUIDv4 is still appropriate

- **Unpredictability required**: UUIDv4 is fully random, making it harder to guess. Use it for tokens, API keys, or any value where predictability is a security concern.
- **Legacy compatibility**: If existing systems or APIs expect v4 UUIDs, stay consistent.

## Usage

### Public identifier column (v7 by default)

Use `pk()` for your primary key and add a UUID column as a public-facing identifier. The `uuid()` column defaults to v7 Zod validation. Pair it with `uuidv7()` for server-side generation or `.$insertFn()` for application-side generation:

```typescript
import { table, pk, uuid, varchar, notNull } from "durcno";
import { uuidv7 } from "durcno/functions";

export const Orders = table("public", "orders", {
  id: pk(),
  // Public identifier — UUIDv7, server-generated
  publicId: uuid({ notNull, unique }).default(uuidv7()),
  product: varchar({ length: 255, notNull }),
});
```

Or generate in the application:

```typescript
import { table, pk, uuid, varchar, notNull } from "durcno";

export const Orders = table("public", "orders", {
  id: pk(),
  // Public identifier — UUIDv7, application-generated
  publicId: uuid({ notNull, unique }).$insertFn(() => crypto.randomUUID()),
  product: varchar({ length: 255, notNull }),
});
```

Expose `publicId` in APIs and URLs instead of the internal integer `id`.

### Explicit v4 for tokens/secrets

When you specifically need UUIDv4, set the `version` option and use the `uuidv4()` server function:

```typescript
import { table, pk, uuid, notNull } from "durcno";
import { uuidv4 } from "durcno/functions";

export const ApiKeys = table("public", "api_keys", {
  id: pk(),
  // v4: fully random, unpredictable
  key: uuid({ notNull, unique, version: "v4" }).default(uuidv4()),
});
```

### Mixing both in one table

```typescript
import { table, pk, uuid, varchar, notNull } from "durcno";
import { uuidv7, uuidv4 } from "durcno/functions";

export const Sessions = table("public", "sessions", {
  id: pk(),
  // Sortable public identifier — UUIDv7
  publicId: uuid({ notNull, unique }).default(uuidv7()),
  // Unpredictable session token — UUIDv4
  token: uuid({ notNull, unique, version: "v4" }).default(uuidv4()),
  userId: varchar({ length: 255, notNull }),
});
```

## Zod validation

The `version` option controls which UUID format the generated Zod schema accepts:

```typescript
uuid({ notNull }); // Zod accepts only v7 (default)
uuid({ notNull, version: "v4" }); // Zod accepts only v4
uuid({ notNull, version: "v1" }); // Zod accepts only v1
```

:::note
The `version` option only affects Zod schema validation. PostgreSQL's `uuid` type stores any valid UUID regardless of version.
:::

## PostgreSQL extensions

Server-side UUID generation requires a PostgreSQL extension:

```sql
-- For gen_random_uuid() (v4) — built-in since PostgreSQL 13
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- For uuid_generate_v7() — requires the uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## Recommendation

- Use `pk()` for primary keys — integer sequences are smaller, faster to join, and ideal for internal references.
- Choose **UUIDv7** for public identifiers, external references, and any column where sort order or index performance matters. This is the Durcno default.
- Choose **UUIDv4** for tokens, API keys, and values where unpredictability is more important than ordering.

For the full UUID column reference, see the Schema docs: [UUID Column](../Schema/columns.md#uuid-column).