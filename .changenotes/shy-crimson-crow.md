---
bump: major
---

# change(query)!: split the join clause into an .on() method

`innerJoin` and `leftJoin` each took the joined table _and_ the `ON` condition in one call. The condition is now supplied to a separate `.on()` on the join builder those two methods return.

```ts
// before
db.from(Users).innerJoin(Posts, () => eq(Users.id, Posts.userId));

// after
db.from(Users).innerJoin(Posts).on(() => eq(Users.id, Posts.userId));
```

Generated SQL, row decoding, and every inferred type are unchanged — only the call shape moved. To migrate, split each two-argument join at its callback. `.on()` takes the same callback, so the body is untouched.

## Why

`.on()` is what SQL itself uses, so the builder now reads like the statement it emits: `FROM users INNER JOIN posts ON ...` instead of a two-argument call that folded the table and its condition together.

Making that two steps also means a pending join is a distinct type with one method on it, so a join cannot be left half-written — there is no way to reach `.select()` on a join that never got an `ON`, and nothing to clean up at runtime.

It also gives the condition the same callback shape as `.select()`, `.where()`, `.orderBy()`, `.groupBy()` and `.having()`, rather than being the one join argument that was a callback and the other three that were not.

## Cost

Negligible. Splitting the call adds one small intermediate object per join, which measures in the low tens of nanoseconds — invisible next to the query build it belongs to, and far below the network round-trip that query then costs. A wide multi-join query sees the same per-join figure, not a compounding one.
