---
sidebar_position: 1.6
---

# Row Locking

Use `.forUpdate()`, `.forNoKeyUpdate()`, `.forShare()`, and `.forKeyShare()` to append a row-level locking clause (`FOR UPDATE` & co.) to a SELECT query, following [PostgreSQL's explicit row locking](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS). A locking clause only matters inside a transaction — see [Transactions](./transaction.md); locks are released when the transaction commits or rolls back.

```typescript
import { eq } from "durcno";

await db.transaction(async (tx) => {
  const locked = await tx
    .from(Users)
    .select("*")
    .where(() => eq(Users.type, "user"))
    .forUpdate();
  // SQL: ... WHERE "users"."type" = 'user' FOR UPDATE

  // Other statements run while the lock is held; commit releases it.
});
```

Plain readers are never blocked by row locks — PostgreSQL's MVCC only makes _other locking clauses_ and `UPDATE`/`DELETE` on the locked rows conflict.

## Strengths

Each strength takes a different wait mode:

| Method              | SQL                 | Lock taken                                                                 |
| ------------------- | ------------------- | -------------------------------------------------------------------------- |
| `.forUpdate()`      | `FOR UPDATE`        | Exclusive — conflicts with every other strength                            |
| `.forNoKeyUpdate()` | `FOR NO KEY UPDATE` | Like `FOR UPDATE`, but concurrent `FOR SHARE`/`FOR KEY SHARE` stay allowed |
| `.forShare()`       | `FOR SHARE`         | Shared — conflicts only with `FOR UPDATE`                                  |
| `.forKeyShare()`    | `FOR KEY SHARE`     | Locks the key part only — conflicts only with `FOR UPDATE`                 |

A query holds at most one strength: after one lock method, the other three disappear from the type.

## Options

All four methods accept the same options:

| Option             | Description                                                                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `of`               | Lock rows of only these tables. Each table must appear in the query's `FROM`/`JOIN` — otherwise PostgreSQL rejects the query. Accepts a single table or an array. |
| `noWait: true`     | Emit `NOWAIT` — fail immediately with `55P03` instead of waiting for the lock.                                                                                    |
| `skipLocked: true` | Emit `SKIP LOCKED` — silently skip rows another transaction has locked.                                                                                           |

`noWait` and `skipLocked` are mutually exclusive — passing both is a compile error.

### `of` with joins

```typescript
import { eq } from "durcno";

await db.transaction(async (tx) => {
  const locked = await tx
    .from(Users)
    .innerJoin(Posts)
    .on(() => eq(Posts.userId, Users.id))
    .select("*")
    .forUpdate({ of: [Posts] });
  // SQL: ... FOR UPDATE OF "posts"
});
```

Rows of `Users` stay lockable while `Posts` rows are held.

### Skip or fail instead of waiting

```typescript
import { eq } from "durcno";

// Claim a row, or move on without waiting
const [next] = await db.transaction(async (tx) => {
  return await tx
    .from(Users)
    .select("*")
    .forUpdate({ skipLocked: true })
    .limit(1);
});

// Fail fast instead of waiting
const [admin] = await db.transaction(async (tx) => {
  return await tx
    .from(Users)
    .select("*")
    .where(() => eq(Users.type, "admin"))
    .forUpdate({ noWait: true });
});
```

### Chaining order is free

The clause is always emitted after `LIMIT`/`OFFSET`, no matter where you call it:

```typescript
// Build order is free; run the query inside a transaction to hold the lock
db.from(Users).select("*").limit(10).offset(5).forUpdate();
db.from(Users).select("*").forUpdate().limit(10).offset(5); // same SQL
```

## Restrictions

PostgreSQL accepts locking clauses on plain, non-aggregated selects. It rejects them for:

- `GROUP BY` / aggregates / `HAVING` — rows are collapsed, so there is no row to lock. The `.for*()` methods are removed from the type after `.groupBy()` / `.having()`.
- `DISTINCT` and set operations (`UNION`, `INTERSECT`, `EXCEPT`).
- The nullable side of an outer join — a missing row carries no lock.
- Relations that are not real tables: subqueries and CTEs cannot be locked; lock their source tables with `of` instead.

## Related

- [Select](./select.md) — full query builder surface.
- [Joins](./joins.md) — locking rows of joined tables with `of`.
- [Transactions](./transaction.md) — begin/commit/rollback around locks.
