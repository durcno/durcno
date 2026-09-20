---
sidebar_position: 1
---

# Functions

Durcno provides a suite of type-safe SQL functions that can be used in `.select()`, `.where()`, and `.orderBy()` clauses. Functions are strongly typed against your column definitions — string functions only accept string columns, numeric functions only accept numeric columns, and so on.

Functions can also be **composed**: you can pass the result of one function as the input to another (e.g., `lower(trim(Users.email))`), and the type system enforces that both types are compatible.

## Aggregate Functions

Aggregate functions collapse multiple rows into a single value. When you mix aggregate and non-aggregate expressions in a single `.select()` call, Durcno automatically generates the appropriate `GROUP BY` clause for the non-aggregate columns.

| Function             | SQL                   | Returns           | Description                                                              |
| -------------------- | --------------------- | ----------------- | ------------------------------------------------------------------------ |
| `count("*")`         | `count(*)`            | `number`          | Counts all rows including nulls                                          |
| `count(col)`         | `count(col)`          | `number`          | Counts non-null values in the column                                     |
| `countDistinct(col)` | `count(DISTINCT col)` | `number`          | Counts distinct non-null values in the column                            |
| `sum(col)`           | `sum(col)`            | `ColType \| null` | Sum of non-null values; type follows the column; `null` if no rows match |
| `avg(col)`           | `avg(col)`            | `ColType \| null` | Average value; type follows the column; `null` if empty                  |
| `min(col)`           | `min(col)`            | `ColType \| null` | Minimum value; type follows the column                                   |
| `max(col)`           | `max(col)`            | `ColType \| null` | Maximum value; type follows the column                                   |

### `count`

Counts rows. Pass `"*"` to count all rows (including nulls), or a column to count only non-null values.

```typescript
import { count } from "durcno";

// Count all rows
const [{ total }] = await db.from(Users).select(() => ({ total: count("*") }));

// Count non-null values in a specific column
const [{ emailCount }] = await db
  .from(Users)
  .select(({ users }) => ({ emailCount: count(users.email) }));
```

### `countDistinct`

Counts the number of distinct non-null values.

```typescript
import { countDistinct } from "durcno";

const [{ uniqueTypes }] = await db
  .from(Users)
  .select(({ users }) => ({ uniqueTypes: countDistinct(users.type) }));
```

### `sum`

Returns the sum of all non-null values. The return type follows the column's TypeScript type (e.g., `bigint | null` for `bigint`/`bigserial` columns). Returns `null` if no rows match.

```typescript
import { sum } from "durcno";

const [{ total }] = await db
  .from(Orders)
  .select(({ orders }) => ({ total: sum(orders.amount) }));
```

### `avg`

Returns the average value. The return type follows the column's TypeScript type (e.g., `number | null` for numeric columns). Returns `null` if no rows match.

```typescript
import { avg } from "durcno";

const [{ average }] = await db
  .from(Orders)
  .select(({ orders }) => ({ average: avg(orders.amount) }));
// average is `number | null`
```

### `min` / `max`

Returns the minimum or maximum value. The return type matches the column's value type (or `null` if no rows match).

```typescript
import { min, max } from "durcno";

const [row] = await db.from(Orders).select(({ orders }) => ({
  earliest: min(orders.createdAt),
  latest: max(orders.createdAt),
}));
// earliest and latest are `Date | null`
```

### Aggregates with `GROUP BY`

When mixing aggregate and non-aggregate columns in a single `.select()`, Durcno auto-generates the `GROUP BY`:

```typescript
import { count, sum } from "durcno";

const stats = await db.from(Orders).select(({ orders }) => ({
  status: orders.status,
  total: count("*"),
  revenue: sum(orders.amount),
}));
// Equivalent to: SELECT status, count(*), sum(amount) FROM orders GROUP BY status
```

### Aggregates with `HAVING` and `orderBy`

Aggregate functions can be filtered in `.having()` clauses and sorted by alias in `.orderBy()`:

```typescript
import { count, sum, gt, desc } from "durcno";

// Order by aggregate alias
await db
  .from(Orders)
  .select(({ orders }) => ({ status: orders.status, total: count("*") }))
  .orderBy(({ orders }, { total }) => desc(total));

// Filter by aggregate in HAVING
await db
  .from(Orders)
  .select(({ orders }) => ({ status: orders.status, total: count("*") }))
  .having(() => gt(count("*"), 5));
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

const result = await db.from(Users).select(({ users }) => ({
  emailLower: lower(users.email),
  nameUpper: upper(users.name),
}));
```

### `trim`

Removes leading and trailing whitespace.

```typescript
import { trim } from "durcno";

const result = await db.from(Users).select(({ users }) => ({
  cleanName: trim(users.name),
}));
```

### `length`

Returns the number of characters in a string expression.

```typescript
import { length, gt } from "durcno";

// Select the length
const result = await db
  .from(Users)
  .select(({ users }) => ({ nameLength: length(users.name) }));

// Filter by length
await db
  .from(Users)
  .select("*");
  .where(({ users }) => gt(length(users.name), 5));
```

### `left` / `right`

Return the first or last `n` characters of a string.

```typescript
import { left, right } from "durcno";

const result = await db.from(Users).select(({ users }) => ({
  prefix: left(users.postalCode, 3),
  suffix: right(users.postalCode, 3),
}));
```

### `position`

Returns the 1-based position of a substring within a string expression. Returns `0` if not found.

```typescript
import { position, gt } from "durcno";

// Get position of '@' in email
const result = await db.from(Users).select(({ users }) => ({
  atPos: position(users.email, "@"),
}));

// Filter emails where '@' appears after position 5
await db
  .from(Users)
  .select("*");
  .where(({ users }) => gt(position(users.email, "@"), 5));
```

### Composing String Functions

String functions that return a string can be passed as the input to another string function:

```typescript
import { lower, trim, startsWith } from "durcno";

// Trim whitespace then lowercase before filtering
await db
  .from(Users)
  .select("*");
  .where(({ users }) => startsWith(lower(trim(users.email)), "admin"));
```

---

## Mathematical Functions

Mathematical functions accept any numeric column (`integer`, `bigint`, `numeric`, `smallint`, etc.) or the result of another numeric-producing function.

| Function         | SQL              | Returns  | Description                               |
| ---------------- | ---------------- | -------- | ----------------------------------------- |
| `abs(expr)`      | `abs(expr)`      | `number` | Absolute value                            |
| `mod(expr, n)`   | `mod(expr, n)`   | `number` | Remainder of `expr` divided by `n`        |
| `round(expr)`    | `round(expr)`    | `number` | Rounds to the nearest integer             |
| `round(expr, n)` | `round(expr, n)` | `number` | Rounds to `n` decimal places              |
| `ceil(expr)`     | `ceil(expr)`     | `number` | Smallest integer ≥ expression (round up)  |
| `floor(expr)`    | `floor(expr)`    | `number` | Largest integer ≤ expression (round down) |
| `trunc(expr)`    | `trunc(expr)`    | `number` | Truncates to nearest integer              |
| `trunc(expr, n)` | `trunc(expr, n)` | `number` | Truncates to `n` decimal places           |
| `power(expr, n)` | `power(expr, n)` | `number` | Raises `expr` to the power of `n`         |

### `abs`

Returns the absolute value of a numeric expression.

```typescript
import { abs } from "durcno";

const result = await db.from(Accounts).select(({ accounts }) => ({
  absBalance: abs(accounts.balance),
}));
```

### `mod`

Returns the remainder of dividing the expression by `n`.

```typescript
import { mod, eq } from "durcno";

// Get rows with even IDs
await db
  .from(Users)
  .select("*");
  .where(({ users }) => eq(mod(users.id, 2), 0));
```

### `round`

Rounds a numeric expression. Omit `decimals` to round to the nearest integer, or pass a value to round to that many decimal places.

```typescript
import { round } from "durcno";

const result = await db.from(Products).select(({ products }) => ({
  roundedPrice: round(products.price),
  twoDecimals: round(products.price, 2),
}));
```

### `ceil` / `floor`

Round up or down to the nearest integer.

```typescript
import { ceil, floor } from "durcno";

const result = await db.from(Products).select(({ products }) => ({
  ceiling: ceil(products.price),
  floored: floor(products.price),
}));
```

### `trunc`

Truncates a numeric expression towards zero. Omit `decimals` to truncate to the nearest integer, or pass a value to truncate to that many decimal places.

```typescript
import { trunc } from "durcno";

const result = await db.from(Products).select(({ products }) => ({
  truncatedPrice: trunc(products.price),
  twoDecimals: trunc(products.price, 2),
}));
```

### `power`

Returns a numeric expression raised to the power of `exponent`.

```typescript
import { power } from "durcno";

const result = await db.from(Products).select(({ products }) => ({
  squared: power(products.price, 2),
}));
```

---

## Arithmetic Operators

Arithmetic operators combine two numeric expressions using standard math operators. Both operands can be a numeric column, the result of another numeric function, a plain number literal, or an `Arg<number>`.

| Function    | SQL       | Returns  | Description                           |
| ----------- | --------- | -------- | ------------------------------------- |
| `add(a, b)` | `(a + b)` | `number` | Sum of two numeric expressions        |
| `sub(a, b)` | `(a - b)` | `number` | Difference of two numeric expressions |
| `mul(a, b)` | `(a * b)` | `number` | Product of two numeric expressions    |
| `div(a, b)` | `(a / b)` | `number` | Quotient of two numeric expressions   |

### Basic Usage

```typescript
import { add, sub, mul, div } from "durcno";

const result = await db.from(Orders).select(({ orders }) => ({
  grossTotal: add(orders.subtotal, orders.tax),
  discount: sub(orders.price, orders.discountAmount),
  doubled: mul(orders.quantity, 2),
  half: div(orders.amount, 2),
}));
```

### Nesting Arithmetic Operators

Arithmetic results are wrapped in parentheses, so they compose safely:

```typescript
import { add, mul, sub } from "durcno";

// (age * 2) + (5 - 1)
const result = await db.from(Users).select(({ users }) => ({
  derived: add(mul(users.age, 2), sub(5, 1)),
}));
```

---

## Functions in `orderBy`

All scalar functions can be used with `asc()` / `desc()` in `.orderBy()`:

```typescript
import { lower, length, asc, desc } from "durcno";

// Order by lowercased name
await db
  .from(Users)
  .select("*");
  .orderBy(({ users }) => asc(lower(users.name)));

// Order by name length descending
await db
  .from(Users)
  .select("*");
  .orderBy(({ users }) => desc(length(users.name)));
```