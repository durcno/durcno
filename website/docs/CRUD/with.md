---
sidebar_position: 1.5
---

# With

Durcno supports PostgreSQL Common Table Expressions (CTEs) through the `db.with()` API.
A CTE is a named subquery that can be referenced by an outer query, enabling cleaner queries, reusable query fragments, and DML queries with `.returning(...)`.

CTEs can be defined from `SELECT` queries as well as `INSERT`, `UPDATE`, and `DELETE` builders when paired with `.returning(...)`.

## Define a CTE

Use `db.with(name).as(query)` to define a CTE. The query can be a `SELECT`, `INSERT`, `UPDATE`, or `DELETE` builder.

```typescript
import { asc, db, eq } from "durcno";
import { Users } from "./db/schema.ts";

const activeUsers = db
  .with("activeUsers")
  .as(
    db
      .from(Users)
      .select({ id: Users.id, username: Users.username })
      .where(eq(Users.status, "active")),
  );
```

Durcno infers the CTE column types from the query you pass to `.as()`, so the returned CTE can be used with full type safety.

## Query the CTE

Attach the CTE to an outer query with `db.with(cte)` and choose the CTE source using the callback form of `.from()`:

```typescript
const rows = await db
  .with(activeUsers)
  .from((ctes) => ctes.activeUsers)
  .select()
  .orderBy(asc(activeUsers.username));

// Type: { id: bigint; username: string }[]
```

When you pass a callback to `.from()`, Durcno builds a typed object mapping CTE names to their virtual table definitions.

## Chain multiple CTEs

You can declare one CTE in terms of another by nesting `db.with(...)` calls.

```typescript
const activeUsers = db
  .with("activeUsers")
  .as(
    db
      .from(Users)
      .select({ id: Users.id, username: Users.username })
      .where(eq(Users.status, "active")),
  );

const activeNames = db.with("activeNames").as(
  db
    .with(activeUsers)
    .from((ctes) => ctes.activeUsers)
    .select({ username: activeUsers.username }),
);

const rows = await db
  .with(activeUsers, activeNames)
  .from((ctes) => ctes.activeNames)
  .select();
```

## CTEs with `isIn(...)` and `UPDATE`

You can use a CTE as a subquery in `isIn(...)` filters and also create an `UPDATE` CTE using `.returning(...)`.

```typescript
import { db, eq, isIn } from "durcno";
import { Users } from "./db/schema.ts";

const inactiveUsers = db
  .with("inactiveUsers")
  .as(
    db.from(Users).select({ id: Users.id }).where(eq(Users.status, "inactive")),
  );

const updatedUsers = db.with("reactivatedUsers").as(
  db
    .update(Users)
    .set({ status: "active" })
    .where(
      isIn(Users.id, db.from(inactiveUsers).select({ id: inactiveUsers.id })),
    )
    .returning({ id: true, username: true, status: true }),
);

const rows = await db
  .with(inactiveUsers, updatedUsers)
  .from((ctes) => ctes.reactivatedUsers)
  .select();
```

This pattern is useful when an update depends on a filtered set of rows and you want the updated records available to the same statement.

## DML CTEs with `.returning(...)`

Durcno also supports DML CTEs. Use `.returning(...)` on an `INSERT`, `UPDATE`, or `DELETE` query and then query the CTE from an outer `SELECT`.

```typescript
const insertedUsers = db
  .with("insertedUsers")
  .as(
    db
      .insert(Users)
      .values({ username: "new-user", type: "user" })
      .returning({ id: true, username: true }),
  );

const rows = await db
  .with(insertedUsers)
  .from((ctes) => ctes.insertedUsers)
  .select();
```

These DML CTEs are useful when you need the inserted/updated/deleted rows available to the same statement.

## CTE usage rules

- The `db.with(name).as(query)` helper creates a virtual table from a query.
- Use `db.with(cte)` to attach one or more CTE definitions to an outer query.
- The outer `.from()` target must be a real table or a CTE reference; CTEs cannot be write targets.
- You cannot `INSERT`, `UPDATE`, or `DELETE` directly into a CTE.

## Examples

```typescript
// Valid: SELECT from a CTE
await db
  .with(activeUsers)
  .from((ctes) => ctes.activeUsers)
  .select();

// Invalid: Cannot write into a CTE
// db.with(activeUsers).insert(activeUsers);
```