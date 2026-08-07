---
bump: patch
---

# fix(rq): support extra foreign key constraints in relation subqueries

Update `buildRelationSubquery` in the relational query builder to resolve foreign key column references defined via table extra foreign key constraints (`extra.foreignKeys`) when inline column references (`getReferencesCol`) are absent.

This resolves issues where relational queries failed to resolve relations defined through table-level foreign key definitions.