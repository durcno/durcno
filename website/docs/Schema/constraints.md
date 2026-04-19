---
sidebar_position: 1.45
---

# Constraints

Durcno provides type-safe APIs for defining PostgreSQL constraints on tables. Constraints enforce rules at the database level, guaranteeing data integrity regardless of application code.

Durcno supports three types of table-level constraints:

| Constraint      | Purpose                                              | API                                      |
| --------------- | ---------------------------------------------------- | ---------------------------------------- |
| **Check**       | Validate column values with expressions              | `check(name, expr)` via callback         |
| **Unique**      | Prevent duplicate values across two or more columns  | `unique(name, columns)` via callback     |
| **Primary Key** | Define a composite primary key (two or more columns) | `primaryKey(name, columns)` via callback |

:::tip Column-Level vs Table-Level
For **single-column** primary keys and unique constraints, use the column-level flags `primaryKey` and `unique` directly on the column definition. Table-level `unique()` and `primaryKey()` (passed as callback parameters) require **two or more columns** and are designed for composite (multi-column) cases.
:::

---

## Check Constraints

Check constraints validate that column values satisfy a boolean expression. They are defined using the `checkConstraints` callback and the `CheckBuilder` API.

### Basic Usage

```typescript
import { table, pk, varchar, integer, bigint, notNull } from "durcno";

export const Products = table(
  "public",
  "products",
  {
    id: pk(),
    name: varchar({ length: 200, notNull }),
    price: bigint({ notNull }),
    quantity: integer({ notNull }),
    email: varchar({ length: 255 }),
  },
  {
    checkConstraints: (
      t,
      check,
      { gt, gte, lte, like, fnGt, fnLte, length, and },
    ) => [
      // Price must be positive
      check("positive_price", gt(t.price, 0)),

      // Quantity must be between 0 and 10000
      check("valid_quantity", and(gte(t.quantity, 0), lte(t.quantity, 10000))),

      // Email must contain @
      check("valid_email", like(t.email, "%@%.%")),

      // Name must be at least 2 characters
      check(
        "name_length",
        and(fnGt(length(t.name), 2), fnLte(length(t.name), 200)),
      ),
    ],
  },
);
```

### Using `raw` for Compact Checks

If you prefer raw SQL expressions, use `raw(...)`:

```typescript
checkConstraints: (t, check, { raw }) => [
  check("status_allowed", raw(`"status" IN ('active','inactive')`)),
];
```

### CheckBuilder API

The `check` function is passed as the second callback parameter — use it to create named constraints. The `CheckBuilder` (destructured from the third parameter) provides these helpers:

| Category                 | Methods                                           |
| ------------------------ | ------------------------------------------------- |
| **Comparison**           | `eq`, `neq`, `gt`, `gte`, `lt`, `lte`             |
| **Pattern**              | `like`, `similarTo`, `regex`                      |
| **Logical**              | `and`, `or`                                       |
| **SQL Functions**        | `length`, `lower`, `upper`, `trim`, `coalesce`    |
| **Function Comparisons** | `fnEq`, `fnNeq`, `fnGt`, `fnGte`, `fnLt`, `fnLte` |
| **Raw SQL**              | `raw(sql)`                                        |

Each helper returns a `CheckExpr` which can be combined as needed.

> **Note:** CHECK constraints do not affect TypeScript types. If you want compile-time guarantees, use enums for stable sets or add runtime validation (Zod) in application code.

---

## Unique Constraints

Unique constraints prevent duplicate values across two or more columns. They are defined using the `uniqueConstraints` callback, which receives the `unique` factory function as its second parameter.

:::caution
`unique()` requires **at least two columns**. For single-column uniqueness, use the column-level `unique` flag instead.
:::

### Single-Column Unique

For a single column, use the column-level `unique` flag:

```typescript
import { table, pk, varchar, notNull, unique } from "durcno";

export const Tags = table("public", "tags", {
  id: pk(),
  name: varchar({ length: 100, notNull, unique }),
});
```

### Multi-Column (Composite) Unique Constraint

Composite unique constraints ensure that the _combination_ of values across multiple columns is unique:

```typescript
import { table, bigint, varchar, notNull } from "durcno";

export const UserProfiles = table(
  "public",
  "user_profiles",
  {
    userId: bigint({ notNull }),
    platform: varchar({ length: 50, notNull }),
    handle: varchar({ length: 100, notNull }),
  },
  {
    uniqueConstraints: (t, unique) => [
      // One profile per user per platform
      unique("unique_user_platform", [t.userId, t.platform]),
    ],
  },
);
```

With this constraint, the same `userId` can appear multiple times as long as the `platform` is different:

```sql
-- ✅ Allowed: different platforms
INSERT INTO "public"."user_profiles" ("user_id", "platform", "handle") VALUES (1, 'github', 'alice');
INSERT INTO "public"."user_profiles" ("user_id", "platform", "handle") VALUES (1, 'twitter', 'alice_tw');

-- ❌ Rejected: same userId + platform
INSERT INTO "public"."user_profiles" ("user_id", "platform", "handle") VALUES (1, 'github', 'alice_alt');
```

### Multiple Unique Constraints

A table can have any number of unique constraints:

```typescript
uniqueConstraints: (t, unique) => [
  unique("uq_email_org", [t.email, t.orgId]),
  unique("uq_username_org", [t.username, t.orgId]),
],
```

---

## Primary Key Constraints

For tables with a **composite primary key** (two or more columns), use the `primaryKeyConstraint` callback, which receives the `primaryKey` factory function as its second parameter. A table can have at most one primary key.

:::caution
`primaryKey()` requires **at least two columns**. For single-column primary keys, use `pk()` or the `primaryKey` flag instead.
:::

### Composite Primary Key

```typescript
import { table, bigint, integer, timestamp, notNull, now } from "durcno";

export const UserRoles = table(
  "public",
  "user_roles",
  {
    userId: bigint({ notNull }),
    roleId: integer({ notNull }),
    assignedAt: timestamp({ notNull }).default(now()),
  },
  {
    primaryKeyConstraint: (t, primaryKey) =>
      primaryKey("pk", [t.userId, t.roleId]),
  },
);
```

This generates:

```sql
CREATE TABLE "public"."user_roles" (
  "user_id" bigint NOT NULL,
  "role_id" integer NOT NULL,
  "assigned_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_pk PRIMARY KEY ("user_id", "role_id")
);
```

### When to Use `primaryKeyConstraint` callback vs `pk()`

| Approach                        | Use Case                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `pk()` column                   | Single auto-incrementing `bigserial` primary key (most tables)           |
| `primaryKey` flag               | Single-column PK on any column type (e.g., `serial({ primaryKey })`)     |
| `primaryKeyConstraint` callback | **Composite primary key** across two or more columns (join tables, etc.) |

:::caution
You **cannot** combine column-level `primaryKey` (or `pk()`) with a table-level `primaryKeyConstraint` on the same table. PostgreSQL only allows one primary key per table. If both are defined, Durcno will error during migration generation.
:::

### Combining with Unique Constraints

A common pattern for join tables is to use both a composite PK and a unique constraint:

```typescript
export const UserRoles = table(
  "public",
  "user_roles",
  {
    userId: bigint({ notNull }),
    roleId: integer({ notNull }),
    assignedAt: timestamp({ notNull }).default(now()),
  },
  {
    uniqueConstraints: (t, unique) => [
      unique("unique_user_role", [t.userId, t.roleId]),
    ],
    primaryKeyConstraint: (t, primaryKey) =>
      primaryKey("pk", [t.userId, t.roleId]),
  },
);
```

---

## Constraint Naming

All constraint names are **automatically prefixed** with the table name. This keeps names unique across tables:

| Definition                                         | Generated Constraint Name |
| -------------------------------------------------- | ------------------------- |
| `check("positive_price", ...)` on table `products` | `products_positive_price` |
| `unique("uq_email", ...)` on table `users`         | `users_uq_email`          |
| `primaryKey("pk", ...)` on table `user_roles`      | `user_roles_pk`           |

Use clear, descriptive names so migrations are easy to read.

---

## Migrations

Durcno's migration generator automatically detects constraint changes and produces the appropriate SQL.

### Initial Table Creation

When a table with constraints is created, they are included in the `CREATE TABLE` statement:

```sql
CREATE TABLE "public"."products" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "price" bigint NOT NULL,
  CONSTRAINT products_positive_price CHECK ("price" > 0)
);
```

### Adding a Constraint

When you add a new constraint to an existing table, a migration is generated:

```sql
ALTER TABLE "public"."products" ADD CONSTRAINT products_max_price CHECK ("price" < 1000000);
ALTER TABLE "public"."user_roles" ADD CONSTRAINT user_roles_unique_email UNIQUE ("email");
```

### Removing a Constraint

When you remove a constraint from the schema, a `DROP CONSTRAINT` migration is generated:

```sql
ALTER TABLE "public"."products" DROP CONSTRAINT products_max_price;
```

### Modifying a Constraint

When you change a constraint's expression (check) or columns (unique/PK), Durcno generates a **drop-then-add** migration:

```sql
-- Drop old version
ALTER TABLE "public"."products" DROP CONSTRAINT products_valid_quantity;
-- Add new version
ALTER TABLE "public"."products" ADD CONSTRAINT products_valid_quantity CHECK ("quantity" >= 0 AND "quantity" <= 1000);
```

---

## Best Practices

### Name Constraints Clearly

Use descriptive names like `positive_price`, `unique_email_org`, or `pk` so migrations are easy to read:

```typescript
// ✅ Good: descriptive names
check("positive_price", gt(t.price, 0));
unique("unique_user_platform", [t.userId, t.platform]);

// ❌ Bad: vague names
check("c1", gt(t.price, 0));
unique("uc1", [t.userId, t.platform]);
```

### Use Column-Level Flags for Single Columns

For single-column primary keys and unique constraints, you **must** use the column-level flags — `unique()` and `primaryKey()` (in callbacks) require at least two columns:

```typescript
// ✅ Correct: column-level flags for single columns
export const Users = table("public", "users", {
  id: pk(),
  email: varchar({ length: 255, notNull, unique }),
});

// ✅ Correct: table-level for composite (two or more columns)
uniqueConstraints: (t, unique) => [
  unique("unique_user_platform", [t.userId, t.platform]),
];

// ❌ Error: single column not allowed in table-level constraint
uniqueConstraints: (t, unique) => [
  unique("uq_email", [t.email]), // Use `unique` flag instead
];
```

### Don't Over-Constrain

Complex constraints are harder to change later. Consider application-level validation for business rules that change frequently:

```typescript
// ✅ Good: stable database-level rules
check("positive_price", gt(t.price, 0));

// ⚠️ Consider app-level: business logic that may change
check("max_discount", lte(t.discount, 50)); // May change to 75 later
```

### Unique Constraints vs Unique Indexes

Both enforce uniqueness, but they serve different purposes:

- **`unique()` callback** — A named database constraint; use when uniqueness is a data integrity rule
- **`uniqueIndex()`** — An index with uniqueness; use when you also need index performance benefits

In PostgreSQL, a unique constraint automatically creates a unique index, so functionally they are equivalent. Prefer the `unique()` callback in `uniqueConstraints` when you want to express intent as a data rule, and `uniqueIndex()` when the primary purpose is query optimization.

---

## Related

- [Columns](./columns.md) — Column-level `primaryKey` and `unique` flags
- [Indexes](./indexes.md) — `uniqueIndex()` for index-level uniqueness
- [Enums](./enums.md) — Alternative to CHECK for fixed value sets
- [Enums vs Check Constraints](../Guides/enum-vs-check.md) — Comparison guide