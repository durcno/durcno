---
bump: patch
---

# fix(filters): cast array values in comparisons to the column type

Comparing an array column with an array value failed with a PostgreSQL error:

```sql
ERROR:  operator does not exist: character varying[] = text[]
```

PostgreSQL types every `ARRAY[...]` literal it parses as `text[]`, and a comparison has no target column to coerce it — unlike `INSERT`, where the target column supplies the type. The write path already emitted the cast, but the read paths did not.

Array values rendered on the value side of a comparison are now cast to the column's array type, via the new `Column.toSQLExpression`:

```sql
SELECT * FROM "items" WHERE "items"."tags" = ARRAY['a', 'b']::varchar(100)[]
```

This covers `eq`/`ne`/`gt`/`lt`/`gte`/`lte`, `isIn`/`notIn` with array values, and array operands of SQL functions such as `coalesce`/`greatest`/`caseWhen`. The existing array filters (`arrayContains`, `arrayContainedBy`, `arrayOverlaps`) now go through the same helper and emit identical SQL.

Scalar filter values are untouched — a string literal is `unknown` and PostgreSQL resolves it from the other side of the comparison, so `eq(Users.name, "a")` still emits `"users"."name" = 'a'`. Index usage is unaffected: the cast is on the value side of the operator and is folded into a constant at plan time, so a btree/GIN index on the array column is still selected.
