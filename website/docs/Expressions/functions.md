---
sidebar_position: 1
---

# Functions

Durcno provides a suite of type-safe SQL functions that can be used in `.select()`, `.where()`, and `.orderBy()` clauses. Functions are strongly typed against your column definitions — string functions only accept string columns, numeric functions only accept numeric columns, and so on.

Functions can also be **composed**: you can pass the result of one function as the input to another (e.g., `lower(trim(Users.email))`), and the type system enforces that both types are compatible.

## Aggregate Functions

Aggregate functions collapse multiple rows into a single value. When you mix aggregate and non-aggregate expressions in a single `.select()` call, Durcno automatically generates the appropriate `GROUP BY` clause for the non-aggregate columns.

| Function             | SQL                   | Returns           | Description                                               |
| -------------------- | --------------------- | ----------------- | --------------------------------------------------------- |
| `count("*")`         | `count(*)`            | `number`          | Counts all rows including nulls                           |
| `count(col)`         | `count(col)`          | `number`          | Counts non-null values in the column                      |
| `countDistinct(col)` | `count(DISTINCT col)` | `number`          | Counts distinct non-null values in the column             |
| `sum(col)`           | `sum(col)`            | `number \| null`  | Sum of non-null values; `null` if no rows match           |
| `avg(col)`           | `avg(col)`            | `string \| null`  | Average as a PostgreSQL `numeric` string; `null` if empty |
| `min(col)`           | `min(col)`            | `ColType \| null` | Minimum value; type follows the column                    |
| `max(col)`           | `max(col)`            | `ColType \| null` | Maximum value; type follows the column                    |

### `count`

Counts rows. Pass `"*"` to count all rows (including nulls), or a column to count only non-null values.

```typescript
import { count } from "durcno";

// Count all rows
const [{ total }] = await db.from(Users).select({ total: count("*") });

// Count non-null values in a specific column
const [{ emailCount }] = await db
  .from(Users)
  .select({ emailCount: count(Users.email) });
```

### `countDistinct`

Counts the number of distinct non-null values.

```typescript
import { countDistinct } from "durcno";

const [{ uniqueTypes }] = await db
  .from(Users)
  .select({ uniqueTypes: countDistinct(Users.type) });
```

### `sum`

Returns the sum of all non-null values. Returns `null` if no rows match.

```typescript
import { sum } from "durcno";

const [{ total }] = await db.from(Orders).select({ total: sum(Orders.amount) });
```

### `avg`

Returns the average as a `string` (PostgreSQL returns `avg` as a `numeric` type). Returns `null` if no rows match.

```typescript
import { avg } from "durcno";

const [{ average }] = await db
  .from(Orders)
  .select({ average: avg(Orders.amount) });
// average is `string | null`, e.g. "2.5000000000"
```

### `min` / `max`

Returns the minimum or maximum value. The return type matches the column's value type (or `null` if no rows match).

```typescript
import { min, max } from "durcno";

const [row] = await db.from(Orders).select({
  earliest: min(Orders.createdAt),
  latest: max(Orders.createdAt),
});
// earliest and latest are `Date | null`
```

### Aggregates with `GROUP BY`

When mixing aggregate and non-aggregate columns in a single `.select()`, Durcno auto-generates the `GROUP BY`:

```typescript
import { count, sum } from "durcno";

const stats = await db.from(Orders).select({
  status: Orders.status,
  total: count("*"),
  revenue: sum(Orders.amount),
});
// Equivalent to: SELECT status, count(*), sum(amount) FROM orders GROUP BY status
```

### Aggregates in `orderBy` and `where`

Aggregate functions can be used in `.orderBy()` and `.where()` clauses:

```typescript
import { count, sum, gt, asc, desc } from "durcno";

// Order by aggregate
await db
  .from(Orders)
  .select({ status: Orders.status, total: count("*") })
  .orderBy(desc(count("*")));

// Filter by aggregate (HAVING equivalent)
await db
  .from(Orders)
  .select({ status: Orders.status, total: count("*") })
  .where(gt(count("*"), 5));
```

---

## String Functions

String functions accept any string column (`varchar`, `text`, `char`) or the result of another string-producing function.

| Function                 | SQL                    | Returns  | Description                                  |
| ------------------------ | ---------------------- | -------- | -------------------------------------------- |
| `length(expr)`           | `length(expr)`         | `number` | Number of characters in the string           |
| `lower(expr)`            | `lower(expr)`          | `string` | Converts to lowercase                        |
| `upper(expr)`            | `upper(expr)`          | `string` | Converts to uppercase                        |
| `trim(expr)`             | `trim(expr)`           | `string` | Removes leading and trailing whitespace      |
| `left(expr, n)`          | `left(expr, n)`        | `string` | First `n` characters of the string           |
| `right(expr, n)`         | `right(expr, n)`       | `string` | Last `n` characters of the string            |
| `position(expr, substr)` | `strpos(expr, substr)` | `number` | 1-based position of `substr`; 0 if not found |

### `lower` / `upper`

Convert a string expression to lowercase or uppercase.

```typescript
import { lower, upper } from "durcno";

const result = await db.from(Users).select({
  emailLower: lower(Users.email),
  nameUpper: upper(Users.name),
});
```

### `trim`

Removes leading and trailing whitespace.

```typescript
import { trim } from "durcno";

const result = await db.from(Users).select({
  cleanName: trim(Users.name),
});
```

### `length`

Returns the number of characters in a string expression.

```typescript
import { length, gt } from "durcno";

// Select the length
const result = await db.from(Users).select({ nameLength: length(Users.name) });

// Filter by length
await db
  .from(Users)
  .select()
  .where(gt(length(Users.name), 5));
```

### `left` / `right`

Return the first or last `n` characters of a string.

```typescript
import { left, right } from "durcno";

const result = await db.from(Users).select({
  prefix: left(Users.postalCode, 3),
  suffix: right(Users.postalCode, 3),
});
```

### `position`

Returns the 1-based position of a substring within a string expression. Returns `0` if not found.

```typescript
import { position, gt } from "durcno";

// Get position of '@' in email
const result = await db.from(Users).select({
  atPos: position(Users.email, "@"),
});

// Filter emails where '@' appears after position 5
await db
  .from(Users)
  .select()
  .where(gt(position(Users.email, "@"), 5));
```

### Composing String Functions

String functions that return a string can be passed as the input to another string function:

```typescript
import { lower, trim, startsWith } from "durcno";

// Trim whitespace then lowercase before filtering
await db
  .from(Users)
  .select()
  .where(startsWith(lower(trim(Users.email)), "admin"));
```

---

## Numeric Functions

Numeric functions accept any numeric column (`integer`, `bigint`, `numeric`, `smallint`, etc.) or the result of another numeric-producing function.

| Function         | SQL              | Returns  | Description                               |
| ---------------- | ---------------- | -------- | ----------------------------------------- |
| `abs(expr)`      | `abs(expr)`      | `number` | Absolute value                            |
| `mod(expr, n)`   | `mod(expr, n)`   | `number` | Remainder of `expr` divided by `n`        |
| `round(expr)`    | `round(expr)`    | `number` | Rounds to the nearest integer             |
| `round(expr, n)` | `round(expr, n)` | `number` | Rounds to `n` decimal places              |
| `ceil(expr)`     | `ceil(expr)`     | `number` | Smallest integer ≥ expression (round up)  |
| `floor(expr)`    | `floor(expr)`    | `number` | Largest integer ≤ expression (round down) |

### `abs`

Returns the absolute value of a numeric expression.

```typescript
import { abs } from "durcno";

const result = await db.from(Accounts).select({
  absBalance: abs(Accounts.balance),
});
```

### `mod`

Returns the remainder of dividing the expression by `n`.

```typescript
import { mod, eq } from "durcno";

// Get rows with even IDs
await db
  .from(Users)
  .select()
  .where(eq(mod(Users.id, 2), 0));
```

### `round`

Rounds a numeric expression. Omit `decimals` to round to the nearest integer, or pass a value to round to that many decimal places.

```typescript
import { round } from "durcno";

const result = await db.from(Products).select({
  roundedPrice: round(Products.price),
  twoDecimals: round(Products.price, 2),
});
```

### `ceil` / `floor`

Round up or down to the nearest integer.

```typescript
import { ceil, floor } from "durcno";

const result = await db.from(Products).select({
  ceiling: ceil(Products.price),
  floored: floor(Products.price),
});
```

---

## Functions in `orderBy`

All scalar functions can be used with `asc()` / `desc()` in `.orderBy()`:

```typescript
import { lower, length, asc, desc } from "durcno";

// Order by lowercased name
await db
  .from(Users)
  .select()
  .orderBy(asc(lower(Users.name)));

// Order by name length descending
await db
  .from(Users)
  .select()
  .orderBy(desc(length(Users.name)));
```