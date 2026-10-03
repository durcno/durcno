---
bump: patch
---

# fix(columns): validate numeric values before serializing them to SQL

A `numeric` column was interpolated into SQL without validation, so a non-numeric value produced broken statements instead of an error:

```ts
db.from(Products).select("*").where(() => eq(Products.price, "abc"));
```

```sql
-- before
SELECT * FROM "public"."products" WHERE "products"."price" = abc
-- ERROR:  column "abc" does not exist
```

Values are now checked against the PostgreSQL `numeric` literal grammar (optional sign, digits, optional fraction, optional exponent) before being serialized, and an invalid value throws immediately — matching how `uuid` already reports bad input:

```ts
db.from(Products).select("*").where(() => eq(Products.price, "abc"));
// Error: Invalid numeric value: abc
```

The check rejects more than the previous `Number()`-based one could: `""`, `"0x27"`, `"1_000"`, `"NaN"`, `"Infinity"`, and anything containing SQL punctuation such as `0; DROP TABLE users; --` were all accepted before and emitted verbatim.

The literal itself is unchanged — valid values are still emitted bare (`WHERE "products"."price" = 10.50`), so existing queries, prepared statements (`$1::numeric`), and generated migrations keep byte-identical SQL. The Zod schema used by `createInsertSchema` shares the same predicate, so validation no longer disagrees between the two paths: it previously accepted `0x27` while the SQL layer produced a syntax error.

```ts
const schema = createInsertSchema(Products);

schema.safeParse({ price: "123.50" }); // ok
schema.safeParse({ price: "0x27" }); // fails: "Invalid numeric value"
```
