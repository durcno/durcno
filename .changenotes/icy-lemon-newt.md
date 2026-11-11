---
bump: patch
---

# fix(columns/pgvector): validate bit and vector values

`pgvector.bit` now rejects values that are not strings of `0` and `1` before building SQL. This closes a path where a quote in the value could escape the `B'…'` literal.

`pgvector.vector` and `pgvector.halfvec` now require an array whose elements are all finite numbers. Both checks run on the SQL-literal path and the driver path, so inserts, updates, comparisons, and prepared statements fail early instead of sending unsafe or invalid SQL.

```ts
await db.insertInto(Embeddings).values({
  bits: "1' || pg_sleep(5) || '", // throws: Invalid bit string value
  embedding: [1, Number.NaN, 3], // throws: Invalid vector element
});
```
