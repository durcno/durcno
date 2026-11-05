---
sidebar_position: 0
---

# Overview

Durcno queries are built from **expressions**: typed SQL fragments that render into a query and carry the TypeScript type of the value they produce. A column reference, a literal, a function call, a raw `sql` fragment, and a subquery are all expressions, and they compose with each other.

Because the type travels with the expression, computed values keep their shape through to the query result:

```typescript
import { add, caseWhen, eq, gt, lower, trim } from "durcno";

const users = await db
  .from(Users)
  .select(() => ({
    username: Users.username,
    email: lower(trim(Users.email)),
    bonus: add(Users.points, 10),
    tier: caseWhen(gt(Users.points, 100), "gold").else("standard"),
  }))
  .where(() => eq(Users.type, "user"));
```

## Where Expressions Are Used

| Position                                       | Typical use                              |
| ---------------------------------------------- | ---------------------------------------- |
| `.select()` projections                        | Computed columns, aggregates, `CASE`     |
| `.where()`, `.having()`, join `.on()`          | Filter and join predicates               |
| `.orderBy()`, `.groupBy()`                     | Sort keys and grouping expressions       |
| `insertInto().values()`, `update().set()`      | Computed values in writes                |
| Check constraints and partial index predicates | Schema-level conditions over expressions |

## Building Blocks

### Functions

Scalar, aggregate, and window functions that produce values — aggregates (`count`, `sum`), strings (`lower`, `trim`), math (`round`, `add`), conditional expressions (`coalesce`, `caseWhen`), JSON builders, and more.

Functions compose, so the result of one can feed another, and the return type is inferred from the inputs:

```typescript
import { lower, startsWith, trim } from "durcno";

await db
  .from(Users)
  .select("*")
  .where(() => startsWith(lower(trim(Users.email)), "admin"));
```

See [Functions](./functions) for the full function reference.

### Filters

Predicates that evaluate to a boolean — comparisons (`eq`, `ne`, `gt`, `gte`, `lt`, `lte`), logic (`and`, `or`), null checks (`isNull`, `isNotNull`), pattern matching, array operators, and subquery existence checks.

```typescript
import { and, eq, isNotNull } from "durcno";

await db
  .from(Users)
  .select("*")
  .where(() => and(eq(Users.type, "admin"), isNotNull(Users.email)));
```

See [Filters](./filters) for the full operator reference.

### Raw SQL

When the builder does not cover a PostgreSQL feature, the `sql` tagged template embeds a raw fragment. Pass a generic type to declare the value it produces:

```typescript
import { sql } from "durcno";

const score = sql<number>`${Users.points} * 1.5`;

const rows = await db.from(Users).select(() => ({ score }));
```

See [Raw SQL](../CRUD/raw-sql) for interpolation, `sql.raw()`, and `sql.null`.

## Nullability

Expressions infer nullability from their operands. A strict function over a nullable column returns `T | null`, while `notNull` columns and non-null literals produce `T`. The same rule applies to arithmetic, `CASE`, JSON constructors, and scalar subqueries.

## Next Steps

- [Functions](./functions) — Aggregates, window, string, math, JSON, and conditional functions
- [Filters](./filters) — Operators for `WHERE`, `HAVING`, and join conditions
- [Raw SQL](../CRUD/raw-sql) — Typed `sql` fragments and raw queries
- [Select](../CRUD/select) — Projecting expressions in queries
