---
bump: major
---

# fix(functions)!: JSON values keep the type of their source column

PostgreSQL serializes a value into JSON by its own rules — an `int8` becomes a number, a `timestamptz` a string — so a JSON expression used to hand back whatever the driver parsed, even though the inferred type said otherwise. Every JSON and JSONB expression now reads its result back through the expressions that built it, so a value keeps the type of its source column.

```ts
await db.from(Users).select(() => ({
  card: jsonBuildObject({
    id: Users.id, // bigint column -> bigint
    createdAt: Users.createdAt, // timestamptz column -> Date
  }),
}));
// card is inferred as { id: bigint; createdAt: Date }
```

The restore covers `jsonBuildObject`, `jsonbBuildObject`, `jsonAgg`, `jsonbAgg`, `jsonBuildArray`, `jsonbBuildArray`, `toJson`, `toJsonb`, `jsonStripNulls` and `jsonbStripNulls`. A literal operand is restored as well — a `Date` comes back as a `Date` and a `bigint` as a `bigint`.

An array literal is encoded as a JSON array in every JSON expression — empty, mixed, `bigint`, and `Date` arrays included — and its elements are restored to their declared types. `toJson`/`toJsonb` also accept scalar `string`, `null`, and array targets.

## Breaking

- `toJson(table)` returns the **JavaScript** column names, the ones its type always promised — `createdAt`, not `created_at`.
- `toJson(column)` restores the column's own type, so a `bigint` column comes back as a `bigint` instead of a number.
- `toJson(record)` returns exactly the entries the record names, under the record's own keys, and now compiles to `json_build_object(...)` instead of reading the whole row of the first column's table. Array entries are encoded as JSON arrays, and literal entries are restored to their declared type. A record that named a column of another table used to return that table's row; it now returns the record it was given.

```ts
await db.from(Users).select(() => ({
  card: toJson({ userId: Users.id, name: Users.username }),
}));
// card is inferred as { userId: bigint; name: string }
```

## Caveats

A restored document is no longer plain JSON — a `bigint` is not JSON-serializable — and the round trip through PostgreSQL's JSON encoding is not lossless:

- a `bigint` or `numeric` beyond the exact range of a double is rounded by the driver's JSON parser before it is restored;
- a timestamp comes back at millisecond precision.

Cast to text when the exact value matters:

```ts
await db.from(Users).select(() => ({
  card: jsonBuildObject({ id: sql<string>`${Users.id}::text` }),
}));
// card is inferred as { id: string }
```
