---
bump: patch
---

# fix(indexes): allow mixed column types in index keys

`index()` and `uniqueIndex()` used to infer a single column type from the key array, so a composite index rejected every key whose type differed from the first one. A key that mixed types — the shape the schema docs already advertised — failed to compile:

```
Type 'TableColumn<..., "userId", TextColumn<...>>' is not assignable to
type 'IndexOn<BigintColumn<...>> | StdTableColumn<BigintColumn<...>>'
```

Keys are now typed as `(StdTableColumn | IndexOn)[]`, so each key is checked as a column of its own type, and `Index` is no longer generic over a single column type.

```ts
export const CartItems = table(
  "public",
  "cartItems",
  {
    id: pk(),
    userId: text({ notNull }), // text
    productId: bigint({ notNull }), // bigint
  },
  {
    indexes: (t) => [
      uniqueIndex("cart_items_user_product_idx", [t.userId, t.productId]),
    ],
  },
);
```

Operator-class keys mix the same way: `index([t.id, t.email.opclass("text_pattern_ops")])`.

Generated SQL, migrations, and index naming are unchanged — the rejection was compile-time only, so existing schemas keep producing the same DDL. A composite unique index over mixed key types is now usable for `ON CONFLICT` targets, instead of being declared as raw SQL that `generate` would propose dropping.
