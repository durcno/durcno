---
bump: minor
---

# impr(prequery): improve prepared query support

Prepared query support now works more consistently for .insert() and .query() flows. The implementation now preserves the prepared statement's return type and correctly handles argument binding for values and filters, which makes prequery-based workflows more reliable.

This change also adds dedicated integration coverage for prepared select, insert, and query flows, helping ensure these paths remain stable as the query builder evolves.