---
bump: minor
---

# feat(functions/comparison): add numNonNulls and numNulls

PostgreSQL's null-counting functions are now available as typed scalar expressions. Both accept one or more operands of any type and return `number`, so they compose with the rest of the expression API:

```typescript
import { numNonNulls, numNulls } from "durcno";

const [row] = await db.from(Users).select(() => ({
  filled: numNonNulls(Users.email, Users.phone, Users.username),
  missing: numNulls(Users.email, Users.phone, Users.username),
}));
```

- Operands can be columns, SQL functions, raw `sql` expressions, prepared `Arg`s, primitive literals, dates, arrays, objects, or `null`.
- At least one operand is required, matching PostgreSQL; zero-argument calls are rejected at compile time.
- Untyped prepared `Arg` operands are cast to `text`, since PostgreSQL cannot infer a parameter type inside a variadic `"any"` call.
- Column scope, prepared-argument presence, and aggregate/window flags propagate like other scalar functions, so an expression containing an aggregate is refused where PostgreSQL rejects it.
- The functions live in `src/functions/comparison.ts` and are exported from the package root.

Covered by type tests for inference and clause gating, plus runtime tests for mixed operands and prepared-argument casts.
