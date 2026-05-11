---
bump: major
---

# feat!: add SQL functions, extended filters, and unified check expressions

Introduces a comprehensive set of SQL functions and filters across four new modules, along with a refactored filter base class.

**New SQL functions:**

- **Aggregate** (`count`, `countDistinct`, `sum`, `min`, `max`, `avg`) — usable in `.select()`
- **String** (`lower`, `upper`, `trim`, `length`, `left`, `right`, `position`) — scalar string transformations
- **Numeric** (`abs`, `ceil`, `floor`, `round`, `mod`) — scalar numeric operations
- **PostGIS** (`stDistance`) — geography distance computation

**New filters:**

- **String filters** (`startsWith`, `endsWith`, `contains`, `like`) — pattern matching for text columns
- **PostGIS spatial filters** (`stDWithin`, `stIntersects`, `stContains`, `stWithin`) — geography predicate support with `Arg` placeholder compatibility
- **`notIn`** — complement of the existing `in` filter

```typescript
// Aggregate in select
const result = await db.from(Orders).select({ total: sum(Orders.amount) });
// → { total: number | null }[]

// String filter
await db.from(Users).select().where(startsWith(Users.name, "Jo"));
```

**Breaking: check constraints now use filters and functions directly**

The `CheckBuilder` class has been removed. Check constraint expressions are now defined using the same filter and function APIs used in queries — `Filter` instances or raw `Sql`.

The `checkConstraints` callback no longer receives a builder object as its third argument.

```javascript
// Before
checkConstraints: (t, check, { gt, lt, and, length, fnGt, fnLte, in: inOp }) => [
  check("positive_price", gt(t.price, 0)),
  check("name_length", and(fnGt(length(t.userName), 2), fnLte(length(t.userName), 100))),
  check("valid_category", inOp(t.categoryId, [1, 2, 3])),
],

// After — import filters/functions from "durcno"
import { gt, lt, and, length, isIn, notIn, like } from "durcno";

checkConstraints: (t, check) => [
  check("positive_price", gt(t.price, 0)),
  check("name_length", and(gt(length(t.userName), 2), lte(length(t.userName), 100))),
  check("valid_category", isIn(t.categoryId, [1, 2, 3])),
],
```

This redesign unifies the expression syntax for check constraints and queries, eliminates the need for a separate builder API, and allows using the full range of filters and functions in constraints.