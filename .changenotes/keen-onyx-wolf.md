---
bump: minor
---

# feat(qb): support expressions in insert and update

Add support for SQL expressions (scalar SQL functions, column assignments, raw SQL, and prepared arguments) across `INSERT`, `UPDATE`, and `ON CONFLICT DO UPDATE SET` clauses.

### Expressions in `UPDATE`

`UPDATE .set()` now supports column-to-column assignment and scalar SQL functions (arithmetic, string, conditional, etc.), fully validated for type compatibility:

```typescript
await db
  .update(Users)
  .set({
    score: add(Users.score, 10),
    bio: Users.description,
    username: lower(Users.username),
  })
  .where(eq(Users.id, 1));
```

### Expressions in `INSERT`

`INSERT .values()` now accepts column-free scalar SQL functions alongside literals and raw `sql`:

```typescript
await db.insertInto(Users).values({
  username: lower("ALICE"),
  score: add(10, 5),
  bio: coalesce(null, "Default bio"),
});
```

### Expressions in Upserts (`ON CONFLICT DO UPDATE SET`)

`doUpdateSet()` now supports scalar SQL functions and column references using existing table columns and `excluded.*`:

```typescript
await db
  .insertInto(Users)
  .values(newUser)
  .onConflict(Users.username)
  .doUpdateSet(({ excluded }) => ({
    score: add(Users.score, excluded.score),
    bio: concat(Users.bio, " - updated"),
  }));
```

### Partial Update Handling

`UPDATE .set()` and `doUpdateSet()` now automatically filter out keys with `undefined` values, ensuring partial updates only include columns with concrete values or SQL expressions.

### Model Type Inference

Also introduce table model type inference helpers (`InferSelect`, `InferInsert`, `InferUpdate`, and corresponding `*Model` / `*Value` aliases), and expose `inferSelect`, `inferInsert`, and `inferUpdate` on `table.$`:

```typescript
import { type InferInsert, type InferSelect, type InferUpdate } from "durcno";

type User = InferSelect<typeof Users>;
type NewUser = InferInsert<typeof Users>;
type UserUpdate = InferUpdate<typeof Users>;
```
