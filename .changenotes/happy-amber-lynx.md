---
bump: minor
---

# feat(update): add FROM clause and values aliases for bulk updates

`UPDATE` gains a `FROM` clause. `UpdateBuilder.from()` accepts real tables, CTEs, and values aliases, so many rows can be updated to _different_ values in one statement instead of one statement per row:

```ts
const V = db.values("v", {
  cartItemId: CartItems.id,
  orderItemId: CartItems.orderItemId,
}).as([
  { cartItemId: 1n, orderItemId: 100n },
  { cartItemId: 2n, orderItemId: 101n },
]);

await db
  .update(CartItems)
  .from(V)
  .set({ orderItemId: V.orderItemId })
  .where(eq(CartItems.id, V.cartItemId));
// UPDATE "public"."cart_items" SET "order_item_id" = "v"."orderItemId"
// FROM (VALUES (1, 100),
//  (2, 101)) AS "v"("cartItemId", "orderItemId")
// WHERE "cart_items"."id" = "v"."cartItemId"
```

`db.values(name, columns)` declares a typed values alias: each declared column wraps a source column (from any table, or a fresh column definition), so rows are type-checked per cell and each value keeps the source column's SQL encoding. `undefined` cells render `NULL` with the column's cast, and an alias with no rows throws when the statement is built — an empty `VALUES` list is not valid SQL.

`.from()` must be chained before `.set()` (mirroring how joins precede `.select()`), because the set payload type-checks against the sources' columns. Repeated `.from()` calls append sources, and `.where()` accepts references to any FROM source on either side of a comparison.

`RETURNING` now renders its columns — including `*` — qualified with the target table name, with or without `FROM`, so a same-named FROM column cannot make them ambiguous and `RETURNING *` keeps returning only the updated table's columns.
