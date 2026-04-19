---
sidebar_position: 2
---

# Enum vs Check Constraint

Check constraints are a lightweight, flexible alternative to PostgreSQL ENUM types when you need to restrict column values but expect the set of allowed values to change over time.

## Why consider check constraints

- **Easier to change**: Adding or removing allowed values is usually implemented by altering a table's CHECK constraint (drop and recreate), which is often simpler and less error-prone than altering ENUM types across multiple databases.
- **No global type dependency**: ENUM types are database-level objects that other tables may depend on; check constraints live on the table and are easier to reason about in migrations.
- **Flexible expressions**: CHECK constraints can use functions (e.g., `lower(...)`) or more complex logic (ranges, regex checks), giving you powerful validation at the DB level.

## Tradeoffs

- **TypeScript safety**: PostgreSQL ENUMs integrated with Durcno give you compile-time TypeScript unions (e.g., `"active" | "inactive"`). CHECK constraints do not provide that TypeScript literal union automatically — but you can use the `$type` method on a column to narrow its TypeScript type to a string literal union, giving you the same compile-time guarantees.
- **Semantics**: Use ENUMs when the set of values is stable and you want the database to know the type explicitly. Use CHECK constraints when values are likely to evolve or when you need more flexible validation logic.

## Examples

### 1) Varchar column + CHECK constraint with `$type` (recommended)

Use `$type` on the column to get full TypeScript inference matching your allowed values:

```typescript
import { table, pk, varchar, notNull } from "durcno";

export const Users = table(
  "public",
  "users",
  {
    id: pk(),
    status: varchar({ length: 20, notNull }).$type<"active" | "inactive">(),
  },
  {
    checkConstraints: (t, check, { in: isIn }) => [
      check("status_allowed", isIn(t.status, ["active", "inactive"])),
    ],
  },
);
```

Now `Users.status` is typed as `"active" | "inactive"` in selects, inserts, and updates — just like an ENUM column.

### 2) Alternative: OR of equality checks (when you need more complex logic)

```typescript
checkConstraints: (t, check, { or, eq }) => [
  check("status_allowed", or(eq(t.status, "active"), eq(t.status, "inactive"))),
],
```

### 3) Use `raw` for compact IN-list checks (for complex expressions)

```typescript
checkConstraints: (t, check, { raw }) => [
  check("status_allowed", raw(`"status" IN ('active','inactive')`)),
],
```

## Migrations

Durcno captures CHECK constraints and will generate migrations that add/drop or modify table constraints when you run `durcno generate`.

## Recommendation

- Choose **ENUMs** when the set of values is stable and you want strong TypeScript guarantees and a named database type.
- Choose **CHECK constraints** with `$type` when values are likely to change, when you need flexible validation, or when you prefer avoiding database-level type objects — while still keeping full TypeScript type safety.

For the full Schema-level `Constraints` reference, see the Schema docs: [Constraints reference](../Schema/constraints.md).