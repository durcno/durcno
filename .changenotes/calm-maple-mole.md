---
bump: patch
---

# fix(rq/types): use explicit return type in .findFirst

Use an explicit return type for `findFirst` in `RelationQueryBuilder` so nested relation queries preserve their inferred result shape. Added a type-level annotation and coverage for a 3-level nested relation query (`Posts` → `comments` → `author`).