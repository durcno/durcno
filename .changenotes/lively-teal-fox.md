---
bump: minor
---

# perf(db): optimize prepared query execution

Introduced `execStrArgs` in the query executor to directly execute raw query strings and arguments. This avoids unnecessarily instantiating `Query` objects, significantly improving the performance of prepared statements.

Additionally, expanded `SqlArgType` to include `bigint` and `boolean` types, allowing them to be passed directly as arguments to `db.raw` and prepared queries.