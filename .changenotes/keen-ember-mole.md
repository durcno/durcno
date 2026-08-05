---
bump: patch
---

# refac(query-builders): standardize RETURNING clause rendering

Extracted `buildReturningClause` helper into `src/query-builders/helpers.ts` to unify `RETURNING` clause SQL generation across `InsertQuery`, `UpdateQuery`, and `DeleteQuery`.

This ensures consistent handling of `"*"` wildcard selection, explicit field inclusions (`{ col: true }`), and exclusion rules across all query builders.