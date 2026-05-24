---
sidebar_position: 1.45
---

# Constraints

Durcno provides type-safe APIs for defining PostgreSQL constraints on tables. Constraints enforce rules at the database level, guaranteeing data integrity regardless of application code.

Durcno supports four types of table-level constraints:

| Constraint      | Purpose                                              | API                                                              |
| --------------- | ---------------------------------------------------- | ---------------------------------------------------------------- |
| **Check**       | Validate column values with expressions              | `check(name, expr)` via callback **or** `.check(fn)` on a column |
| **Unique**      | Prevent duplicate values across two or more columns  | `unique(name, columns)` via callback                             |
| **Primary Key** | Define a composite primary key (two or more columns) | `primaryKey(name, columns)` via callback                         |
| **Foreign Key** | Enforce referential integrity between tables         | `fk(column).references(refColumn)` via callback                  |

:::tip Column-Level vs Table-Level
For **single-column** primary keys and unique constraints, use the column-level flags `primaryKey` and `unique` directly on the column definition. Table-level `unique()` and `primaryKey()` (passed as callback parameters) require **two or more columns** and are designed for composite (multi-column) cases.

For **single-column check constraints**, you can use the column-level `.check(fn)` chainable modifier instead of `checkConstraints`. The constraint name is auto-generated as `{table}_{column}_check`.

For **column-level foreign keys**, use the `.references()` chainable modifier. Use the table-level `foreignKeys` callback for **self-referencing** foreign keys (e.g., a `parentId` column that refers back to the same table's `id`).
:::

---

## Check Constraints

Check constraints validate that column values satisfy a boolean expression. They are defined using the `checkConstraints` callback and the same **filter functions** you use in `.where()` clauses.

### Basic Usage

```typescript
import {
  and,
  bigint,
  gt,
  gte,
  integer,
  length,
  like,
  lte,
  notNull,
  pk,
  table,
  varchar,
} from "durcno";

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
    checkConstraints: (t, check) => [
      // Price must be positive
      check("check_products_positive_price", gt(t.price, 0n)),

      // Quantity must be between 0 and 10000
      check(
        "check_products_valid_quantity",
        and(gte(t.quantity, 0), lte(t.quantity, 10000)),
      ),

      // Email must contain @
      check("check_products_valid_email", like(t.email, "%@%.%")),

      // Name must be between 2 and 200 characters
      check(
        "check_products_name_length",
        and(gt(length(t.name), 2), lte(length(t.name), 200)),
      ),
    ],
  },
);
```

### Column-Level Check Constraints

For a check that applies to a **single column**, you can attach it directly on the column definition using the `.check()` chainable modifier instead of the `checkConstraints` callback. The constraint name is auto-generated as `{table}_{column}_check`.

```typescript
import {
  and,
  gte,
  integer,
  like,
  lte,
  notNull,
  pk,
  table,
  varchar,
} from "durcno";

export const Employees = table("public", "employees", {
  id: pk(),
  // Generates: CONSTRAINT "employees_salary_check" CHECK ("salary" >= 0)
  salary: integer({ notNull }).check((c) => gte(c, 0)),
  // Generates: CONSTRAINT "employees_age_check" CHECK ("age" >= 18 AND "age" <= 120)
  age: integer({ notNull }).check((c) => and(gte(c, 18), lte(c, 120))),
  // Generates: CONSTRAINT "employees_code_check" CHECK ("code" LIKE 'EMP-%')
  code: varchar({ length: 10, notNull }).check((c) => like(c, "EMP-%")),
});
```

The callback receives the typed column reference as its argument so you keep full type safety and IDE autocomplete.

:::caution Naming
Column-level check constraint names are automatically generated as `{table}_{column}_check` and cannot be customised. If you need a specific name, use the `checkConstraints` callback instead.
:::

---

### Using Raw SQL

For expressions not covered by the filter functions, pass a `sql` tagged template:

```typescript
import { sql } from "durcno";

checkConstraints: (t, check) => [
  check("check_orders_status_allowed", sql`"status" IN ('active','inactive')`),
];
```

### Using `isIn` and `notIn`

```typescript
import { isIn, notIn } from "durcno";

checkConstraints: (t, check) => [
  check("check_orders_valid_status", isIn(t.status, ["active", "pending", "closed"])),
  check("check_items_excluded_category", notIn(t.categoryId, [99, 100])),
],
```

### Available Filter Functions

The `checkConstraints` callback accepts any standard **filter expression** (the same ones used in `.where()`) as the second argument to `check()`. See the [Filters](../Expressions/filters.md) page for the full list of available functions.

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
  "userProfiles",
  {
    userId: bigint({ notNull }),
    platform: varchar({ length: 50, notNull }),
    handle: varchar({ length: 100, notNull }),
  },
  {
    uniqueConstraints: (t, unique) => [
      // One profile per user per platform
      unique("unique_user_profiles_user_id_and_platform", [
        t.userId,
        t.platform,
      ]),
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
  unique("unique_memberships_email_and_org_id", [t.email, t.orgId]),
  unique("unique_memberships_username_and_org_id", [t.username, t.orgId]),
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
      primaryKey("pk_user_roles", [t.userId, t.roleId]),
  },
);
```

This generates:

```sql
CREATE TABLE "public"."user_roles" (
  "user_id" bigint NOT NULL,
  "role_id" integer NOT NULL,
  "assigned_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_user_roles PRIMARY KEY ("user_id", "role_id")
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
      unique("unique_user_roles_user_id_and_role_id", [t.userId, t.roleId]),
    ],
    primaryKeyConstraint: (t, primaryKey) =>
      primaryKey("pk_user_roles", [t.userId, t.roleId]),
  },
);
```

---

## Foreign Keys

Foreign key constraints enforce referential integrity between tables at the database level. Durcno supports two ways to define them:

| Approach                           | When to use                           |
| ---------------------------------- | ------------------------------------- |
| Column-level `.references()`       | Cross-table foreign keys (most cases) |
| Table-level `foreignKeys` callback | Self-referencing foreign keys         |

### Column-Level Foreign Keys

For a foreign key to another table, use the `.references()` chainable modifier directly on the column definition. See the [Columns](./columns.md#referencesref) page for full details.

```typescript
import { table, pk, bigint, notNull } from "durcno";

export const Users = table("public", "users", { id: pk() });

export const Posts = table("public", "posts", {
  id: pk(),
  // Defaults to CASCADE on delete
  userId: bigint({ notNull }).references(() => Users.id),
  // With explicit onDelete action
  reviewerId: bigint({}).references({
    column: () => Users.id,
    onDelete: "SET NULL",
  }),
});
```

### Table-Level Foreign Keys (Self-References)

Use the `foreignKeys` callback in the fourth argument to `table()` when a column references the **same table** — for example, a `parentId` column on a comments table that points back to the same table's `id`.

Because the table object is fully constructed before the callback is invoked, column references are available directly without lazy arrow-function wrappers.

```typescript
import { table, pk, bigint, varchar, notNull } from "durcno";

export const Comments = table(
  "public",
  "comments",
  {
    id: pk(),
    parentId: bigint({}), // nullable self-reference
    body: varchar({ length: 500, notNull }),
  },
  {
    foreignKeys: (t, fk) => [
      fk(t.parentId).references(t.id).onDelete("SET NULL"),
    ],
  },
);
```

The `fk` helper is injected by Durcno and works as follows:

1. `fk(sourceColumn)` — selects the column that holds the foreign key value.
2. `.references(targetColumn)` — specifies the column being referenced (on the same or a different table).
3. `.onDelete(action)` _(optional)_ — overrides the default `CASCADE` action. Accepts any standard PostgreSQL `ON DELETE` action: `"CASCADE"`, `"SET NULL"`, `"SET DEFAULT"`, `"RESTRICT"`, or `"NO ACTION"`.

#### Available `ON DELETE` Actions

| Action          | Behaviour                                                                  |
| --------------- | -------------------------------------------------------------------------- |
| `"CASCADE"`     | Delete child rows when the parent is deleted _(default)_                   |
| `"SET NULL"`    | Set the foreign key column to `NULL` when the parent is deleted            |
| `"SET DEFAULT"` | Set the foreign key column to its default value when the parent is deleted |
| `"RESTRICT"`    | Prevent deletion of the parent if any child rows exist                     |
| `"NO ACTION"`   | Like `RESTRICT` but checked at the end of the statement                    |

#### Multiple Foreign Keys

You can return multiple entries from the callback:

```typescript
foreignKeys: (t, fk) => [
  fk(t.parentId).references(t.id).onDelete("SET NULL"),
  fk(t.mergedIntoId).references(t.id).onDelete("CASCADE"),
],
```

---

## Constraint Naming

Constraint names are used **exactly as you provide them** — no prefix or suffix is added automatically. You are responsible for choosing names that are unique within the database.

Durcno recommends these conventions to avoid collisions and keep migrations readable:

| Constraint type                 | Convention                                     | Example                                     |
| ------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| Check (table-level)             | `check_<table>_<col>[_and_<col>]*[_<suffix>]?` | `check_products_positive_price`             |
| Check (column-level `.check()`) | `<table>_<column>_check` (auto-generated)      | `employees_salary_check`                    |
| Unique                          | `unique_<table>_<col1>[_and_<col2>]*`          | `unique_user_profiles_user_id_and_platform` |
| Primary key                     | `pk_<table>`                                   | `pk_user_roles`                             |

Use clear, descriptive names so migrations are easy to read.

---

## Best Practices

### Name Constraints Clearly

Follow the recommended naming conventions and use descriptive names so migrations are easy to read:

```typescript
// ✅ Good: follows convention, descriptive
check("check_products_positive_price", gt(t.price, 0));
unique("unique_user_profiles_user_id_and_platform", [t.userId, t.platform]);
primaryKey("pk_user_roles", [t.userId, t.roleId]);

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
  unique("unique_user_profiles_user_id_and_platform", [t.userId, t.platform]),
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

- [Columns](./columns.md) — Column-level `primaryKey`, `unique`, and `notNull` flags
- [Filters](../Expressions/filters.md) — All available filters for check constraints
- [Indexes](./indexes.md) — `uniqueIndex()` for index-level uniqueness
- [Enums](./enums.md) — Alternative to CHECK for fixed value sets
- [Enums vs Check Constraints](../Guides/enum-vs-check.md) — Comparison guide