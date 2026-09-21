---
bump: minor
---

# feat: support expression projections and null-safe sql functions

Expands `.select()` projections and CTEs to support arbitrary expressions beyond table columns and SQL functions. Projections can now include raw `sql` template expressions, literal primitives (`string`, `number`, `bigint`, `boolean`), and `null` or `sql.null`, with runtime driver deserialization and full compile-time type inference:

- In CTE queries defined via `db.with(...).as(...)`, virtual tables automatically infer column types and non-nullability constraints from projected literals, `Sql` expressions, and `SqlFn` instances.
- Exports `SelectableItem`, `InferSelectRow`, and `InferSelectValue` utility types for working with selectable projections.
- Built-in SQL utilities `now()`, `uuidv4()`, and `uuidv7()` now return typed `Sql<Date>` and `Sql<string>` instances.

Introduces strict null-sensitive return type inference (`StrictFnReturn`) across mathematical, string, arithmetic, pgvector, and postgis functions. Function return types dynamically narrow based on operand nullability: returning `null` when an argument is strictly `null`, `T | null` when an argument is nullable, and non-nullable `T` when all arguments are guaranteed non-null.

Adds conditional SQL functions `coalesce` (which drops `null` from the return type when a non-null fallback is provided), `nullif`, `greatest`, and `least`, alongside string concatenation functions `concat` and `concatWs`.

```typescript
// Selecting literals, raw SQL, and conditional expressions
const users = await db.from(Users).select(({ users }) => ({
  username: users.username,
  displayName: coalesce(users.email, "Anonymous"),
  initial: left(users.username, 1), // typed as string
  statusLabel: "active", // literal string
  customCalc: sql<number>`${users.id} * 10`,
  score: greatest(users.id, 0n),
}));

// Using literals and raw SQL inside CTEs
const userStats = db.with("stats").as(
  db.from(Users).select(({ users }) => ({
    userId: users.id,
    activeFlag: true,
    created: now(), // typed as Date in CTE output
  })),
);

const rows = await db
  .with(userStats)
  .from((ctes) => ctes.stats)
  .select("*"); // full types preserved
```