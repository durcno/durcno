---
sidebar_position: 2.1
---

# Sequences

Sequences are database objects that generate unique numeric values, commonly used for auto-incrementing IDs, order numbers, invoice numbers, and other sequential identifiers. Durcno provides a type-safe API for defining and using PostgreSQL sequences.

## Basic Sequence Definition

Create a sequence using the `sequence()` function:

```typescript
import { sequence } from "durcno";

export const orderSequence = sequence("public", "order_seq", {
  startWith: 1000,
  increment: 1,
});
```

## Sequence Options

The `sequence([schema], [name], [Options])` function accepts a configuration object with the following options:

| Option      | Type      | Description                                                   |
| ----------- | --------- | ------------------------------------------------------------- |
| `startWith` | `number`  | The starting value of the sequence                            |
| `increment` | `number`  | The increment value for each call to `nextval()`              |
| `minValue`  | `number`  | The minimum value of the sequence                             |
| `maxValue`  | `number`  | The maximum value of the sequence                             |
| `cycle`     | `boolean` | Whether to restart from `minValue` when `maxValue` is reached |
| `cache`     | `number`  | Number of sequence values to pre-allocate for performance     |

### Full Example

```typescript
import { sequence } from "durcno";

export const customSequence = sequence("public", "custom_seq", {
  startWith: 100,
  increment: 2,
  minValue: 100,
  maxValue: 10000,
  cycle: true,
  cache: 10,
});
```

This creates a sequence that:

- Starts at 100
- Increments by 2 (100, 102, 104, ...)
- Has a minimum value of 100
- Has a maximum value of 10000
- Cycles back to 100 when it reaches 10000
- Caches 10 values for better performance

## Using Sequences as Column Defaults

The most common use case for sequences is as column defaults. Use the `nextval()` method to generate the next value:

```typescript
import { sequence, integer, table, pk, notNull } from "durcno";

export const orderSequence = sequence("public", "order_seq", {
  startWith: 1000,
  increment: 1,
});

export const Orders = table("public", "orders", {
  id: pk(),
  orderNumber: integer({ notNull }).default(orderSequence.nextval()),
  customerName: varchar({ length: 100, notNull }),
});
```

When you insert a new order without specifying `orderNumber`, PostgreSQL will automatically assign the next value from the sequence:

```typescript
// orderNumber will be 1000, 1001, 1002, etc.
await db.insert(Orders).values({
  customerName: "John Doe",
});
```

## Sequence Methods

### `nextval()`

Returns SQL for getting the next value from the sequence. Use this in column defaults or queries.

```typescript
const seq = sequence("public", "my_seq", { startWith: 1 });

// As column default
const Table = table("public", "my_table", {
  num: integer().default(seq.nextval()),
});

// In raw SQL queries
const nextValue = seq.nextval(); // Returns: nextval('"my_seq"')
```

### `currval()`

Returns SQL for getting the current value of the sequence (the last value returned by `nextval()` in the current session).

```typescript
const seq = sequence("public", "my_seq", { startWith: 1 });
const currentValue = seq.currval(); // Returns: currval('"my_seq"')
```

:::warning
`currval()` only works after `nextval()` has been called at least once in the current session. Calling it before `nextval()` will result in an error.
:::

### `setval(value)`

Returns SQL for setting the sequence to a specific value.

```typescript
const seq = sequence("public", "my_seq", { startWith: 1 });
const resetSql = seq.setval(500); // Returns: setval('"my_seq"', 500)
```

## Generated Migration SQL

When you run `durcno generate`, sequences are automatically included in your migrations:

**up.ts:** — exports an array of DDL statement objects; the equivalent SQL is shown here for reference

```sql
CREATE SEQUENCE "public"."order_seq" START WITH 1000 INCREMENT BY 1;
```

**down.ts:** — exports rollback DDL statement objects; the equivalent SQL is shown here for reference

```sql
DROP SEQUENCE "public"."order_seq";
```

## Common Patterns

### Order Numbers

```typescript
export const orderSequence = sequence("public", "order_seq", {
  startWith: 10000,
  increment: 1,
});

export const Orders = table("public", "orders", {
  id: pk(),
  orderNumber: integer({ notNull }).default(orderSequence.nextval()),
  // ... other columns
});
```

### Invoice Numbers with Prefix

While sequences generate numeric values, you can combine them with string functions for formatted identifiers:

```typescript
export const invoiceSequence = sequence("public", "invoice_seq", {
  startWith: 1,
  increment: 1,
});

// In your application code, format the sequence value:
const invoiceNumber = `INV-${String(sequenceValue).padStart(6, "0")}`;
// Result: INV-000001, INV-000002, etc.
```

### Cycling Sequences

For use cases where you need numbers within a specific range that restart:

```typescript
export const ticketSequence = sequence("public", "ticket_seq", {
  startWith: 1,
  maxValue: 999,
  cycle: true,
});
// Generates: 1, 2, 3, ..., 999, 1, 2, 3, ...
```

### High-Performance Sequences

For high-throughput applications, use caching to reduce database round-trips:

```typescript
export const eventSequence = sequence("public", "event_seq", {
  startWith: 1,
  cache: 100, // Pre-allocate 100 values at a time
});
```

:::tip
Caching improves performance but may result in gaps in the sequence if the application crashes before using all cached values. This is usually acceptable for most use cases.
:::

## Sequences vs Serial Columns

Durcno also provides `serial`, `smallserial`, and `bigserial` column types which automatically create sequences:

```typescript
import { table, serial, bigserial } from "durcno";

export const Users = table("public", "users", {
  id: serial({ notNull }), // Creates implicit sequence
  // ...
});
```

**When to use explicit sequences:**

- You need custom sequence options (start value, increment, cycle, etc.)
- You want to share a sequence across multiple tables
- You need more control over sequence behavior
- You want to use sequence values for non-ID purposes (order numbers, etc.)

**When to use serial columns:**

- Simple auto-incrementing primary keys
- You don't need custom sequence configuration
- The sequence is specific to one column

## Best Practices

1. **Use descriptive names**: Name sequences after their purpose (e.g., `order_seq`, `invoice_seq`)

2. **Consider starting values**: Start business-facing sequences at meaningful values (e.g., 1000 for order numbers)

3. **Use caching for performance**: For high-throughput applications, enable caching

4. **Export sequences**: Always export sequences from your schema file so they're included in migrations:

```typescript
// db/schema.ts
export { Migrations } from "durcno";
export const orderSequence = sequence("public", "order_seq", {
  startWith: 1000,
});
export const Orders = table("public", "orders", {
  /* ... */
});
```

5. **Don't rely on gap-free sequences**: Sequences may have gaps due to rollbacks, caching, or crashes. If you need gap-free numbers, use a different approach.