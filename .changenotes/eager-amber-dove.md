---
bump: patch
---

# perf: use columnsBySql index for faster column lookups

Replace repeated `snakeToCamel` string conversions with a pre-built `columnsBySql` index keyed by SQL column names. This optimization eliminates runtime string transformations during result row conversion in query builders (Select, Insert, InsertReturning, FirstQuery, Update).

The `Table` configuration now includes a `columnsBySql` object that maps SQL column names directly to column definitions, enabling O(1) lookups instead of string conversion followed by object lookup. This reduces CPU overhead on every row returned from the database.