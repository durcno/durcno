---
bump: minor
---

# feat(functions): add arithmetic operators (add, sub, mul, div)

Adds four arithmetic operator functions — `add`, `sub`, `mul`, `div` — for building numeric expressions in queries. Each function accepts two `NumericOperand` values (a numeric column, another numeric function, a plain number literal, or an `Arg<number>`) and returns a composable `SqlFn`.

The functions wrap their operands in parentheses, making it safe to nest them into complex expressions.

```ts
const result = await db.from(Products).select({
  total: mul(Products.price, Products.quantity),
  discounted: sub(mul(Products.price, Products.quantity), 10),
});
```

All four functions are exported from the top-level `durcno` package.