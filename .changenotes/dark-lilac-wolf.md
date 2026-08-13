---
bump: minor
---

# feat(filters): add ilike string filter

Introduces `ilike(col, pattern)` for case-insensitive pattern matching in WHERE and CHECK clauses, wrapping PostgreSQL's `ILIKE` operator.

Supports both string literal patterns and query parameters via `Arg`.

```typescript
import { ilike } from "durcno";

await db.from(Users).select().where(ilike(Users.email, "%@example.com"));
```