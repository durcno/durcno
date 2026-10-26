---
bump: minor
---

# feat(select): add row locking (FOR UPDATE & co.)

SELECT queries now support PostgreSQL row-level locking clauses via four new
chainable methods:

```ts
await db
  .from(Users)
  .select("*")
  .where(() => eq(Users.id, id))
  .forUpdate({ noWait: true });
```

- `.forUpdate()`, `.forNoKeyUpdate()`, `.forShare()`, `.forKeyShare()` map to
  the corresponding lock strengths.
- Options accept `of` to lock only named tables of the FROM/JOIN, and either
  `noWait: true` (`NOWAIT`) or `skipLocked: true` (`SKIP LOCKED`) — the two are
  mutually exclusive at the type level.

Type safety enforces PostgreSQL's restrictions: a query holds at most one
locking clause (methods are omitted from the returned builder), and the methods
disappear after GROUP BY / HAVING, where locking clauses are invalid. The
clause is emitted after LIMIT/OFFSET.

The `LockOptions` type is exported from the package root. Covered by runtime
tests against a live Postgres container (lock conflicts under `NOWAIT`,
`SKIP LOCKED` behavior, `of` scoping, clause ordering) and type tests.
