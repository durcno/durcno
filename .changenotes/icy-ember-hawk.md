---
bump: patch
---

# perf(filters): remove toSQL in favor of direct query mutation

All filter classes previously implemented both `toSQL(): string` and `toQuery(query: Query): void`. Query builders conditionally called one or the other depending on whether a prepared statement was being built, creating redundant string allocations.

The `toSQL()` method has been removed from every filter class (`EqualValCondition`, `InCondition`, `AndCondition`, `OrCondition`, array filters, etc.) and from the abstract `Filter` base class. Query builders now call `toQuery()` unconditionally, appending directly to `query.sql` via `+=` without intermediate string returns or joins.

This eliminates unnecessary string concatenation overhead and reduces the number of code paths that had to be maintained in sync.