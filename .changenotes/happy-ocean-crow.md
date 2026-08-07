---
bump: patch
---

# perf(qb): optimize object mapping for relation and select queries

This optimization refines how rows returned by the database are transformed into TypeScript objects across `rq.ts` (RelationQuery) and `select.ts` (SelectQuery) to improve overall performance and reduce memory allocations.

- **Relation Queries**: Now leverage SQL aliasing directly in the query (`AS "colName"`) to retrieve rows with TypeScript keys pre-mapped, eliminating the need to iterate through objects and rewrite keys in JavaScript. It also uses traditional `for` loops rather than `for...in` to iterate array relations, optimizing array processing.
- **Select Queries**: The object mapping logic now short-circuits on empty arrays. Additionally, it caches `Object.keys()` from the first row and re-uses it to iterate over subsequent rows instead of calling `Object.entries()` on every row, reducing garbage collection overhead for large result sets.