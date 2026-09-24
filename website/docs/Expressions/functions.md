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
| `jsonAgg(expr)`      | `json_agg(expr)`      | `T[] \| null`     | Aggregates values or objects into a JSON array; `null` if 0 rows match   |
| `jsonbAgg(expr)`     | `jsonb_agg(expr)`     | `T[] \| null`     | Aggregates values or objects into a JSONB array; `null` if 0 rows match  |

### `count`

Counts rows. Pass `"*"` to count all rows (including nulls), or a column to count only non-null values.

```typescript
import { count } from "durcno";

// Count all rows
const [{ total }] = await db.from(Users).select(() => ({ total: count("*") }));

// Count non-null values in a specific column
const [{ emailCount }] = await db
  .from(Users)
  .select(() => ({ emailCount: count(Users.email) }));
```

### `countDistinct`

Counts the number of distinct non-null values.

```typescript
import { countDistinct } from "durcno";

const [{ uniqueTypes }] = await db
  .from(Users)
  .select(() => ({ uniqueTypes: countDistinct(Users.type) }));
```

### `sum`

Returns the sum of all non-null values. The return type follows the column's TypeScript type (e.g., `bigint | null` for `bigint`/`bigserial` columns). Returns `null` if no rows match.

```typescript
import { sum } from "durcno";

const [{ total }] = await db
  .from(Orders)
  .select(() => ({ total: sum(Orders.amount) }));
```

### `avg`

Returns the average value. The return type follows the column's TypeScript type (e.g., `number | null` for numeric columns). Returns `null` if no rows match.

```typescript
import { avg } from "durcno";

const [{ average }] = await db
  .from(Orders)
  .select(() => ({ average: avg(Orders.amount) }));
// average is `number | null`
```

### `min` / `max`

Returns the minimum or maximum value. The return type matches the column's value type (or `null` if no rows match).

```typescript
import { min, max } from "durcno";

const [row] = await db.from(Orders).select(() => ({
  earliest: min(Orders.createdAt),
  latest: max(Orders.createdAt),
}));
// earliest and latest are `Date | null`
```

### Aggregates with `GROUP BY`

When mixing aggregate and non-aggregate columns in a single `.select()`, Durcno auto-generates the `GROUP BY`:

```typescript
import { count, sum } from "durcno";

const stats = await db.from(Orders).select(() => ({
  status: Orders.status,
  total: count("*"),
  revenue: sum(Orders.amount),
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
  .select(() => ({ status: Orders.status, total: count("*") }))
  .orderBy((_, { total }) => desc(total));

// Filter by aggregate in HAVING
await db
  .from(Orders)
  .select(() => ({ status: Orders.status, total: count("*") }))
  .having(() => gt(count("*"), 5));
```

### Filter and OrderBy Modifiers (`FILTER (WHERE ...)` and `ORDER BY`)

All aggregate functions inherit from `AggregateSqlFn` and support inline `.filter()` and `.orderBy()` modifiers:

```typescript
import {
  asc,
  count,
  desc,
  eq,
  gt,
  jsonAgg,
  jsonBuildObject,
  sum,
} from "durcno";

const stats = await db.from(Orders).select(() => ({
  // SQL: count(id) FILTER (WHERE status = 'completed')
  completedCount: count(Orders.id).filter(eq(Orders.status, "completed")),

  // SQL: sum(amount) FILTER (WHERE amount > 100)
  largeOrdersTotal: sum(Orders.amount).filter(gt(Orders.amount, 100)),

  // SQL: json_agg(json_build_object('id', id, 'amount', amount) ORDER BY amount DESC)
  sortedOrders: jsonAgg(
    jsonBuildObject({
      id: Orders.id,
      amount: Orders.amount,
    }),
  ).orderBy(desc(Orders.amount)),
}));
```

---

## String Functions

String functions accept any string column (`varchar`, `text`, `char`) or the result of another string-producing function.

| Function                  | SQL                    | Returns  | Description                                  |
| ------------------------- | ---------------------- | -------- | -------------------------------------------- |
| `length(expr)`            | `length(expr)`         | `number` | Number of characters in the string           |
| `lower(expr)`             | `lower(expr)`          | `string` | Converts to lowercase                        |
| `upper(expr)`             | `upper(expr)`          | `string` | Converts to uppercase                        |
| `trim(expr)`              | `trim(expr)`           | `string` | Removes leading and trailing whitespace      |
| `left(expr, n)`           | `left(expr, n)`        | `string` | First `n` characters of the string           |
| `right(expr, n)`          | `right(expr, n)`       | `string` | Last `n` characters of the string            |
| `position(expr, substr)`  | `strpos(expr, substr)` | `number` | 1-based position of `substr`; 0 if not found |
| `concat(...exprs)`        | `concat(...)`          | `string` | Concatenates text representations of args    |
| `concatWs(sep, ...exprs)` | `concat_ws(...)`       | `string` | Concatenates arguments with a separator      |

### `lower` / `upper`

Convert a string expression to lowercase or uppercase.

```typescript
import { lower, upper } from "durcno";

const result = await db.from(Users).select(() => ({
  emailLower: lower(Users.email),
  nameUpper: upper(Users.name),
}));
```

### `trim`

Removes leading and trailing whitespace.

```typescript
import { trim } from "durcno";

const result = await db.from(Users).select(() => ({
  cleanName: trim(Users.name),
}));
```

### `length`

Returns the number of characters in a string expression.

```typescript
import { length, gt } from "durcno";

// Select the length
const result = await db
  .from(Users)
  .select(() => ({ nameLength: length(Users.name) }));

// Filter by length
await db
  .from(Users)
  .select("*")
  .where(() => gt(length(Users.name), 5));
```

### `left` / `right`

Return the first or last `n` characters of a string.

```typescript
import { left, right } from "durcno";

const result = await db.from(Users).select(() => ({
  prefix: left(Users.postalCode, 3),
  suffix: right(Users.postalCode, 3),
}));
```

### `position`

Returns the 1-based position of a substring within a string expression. Returns `0` if not found.

```typescript
import { position, gt } from "durcno";

// Get position of '@' in email
const result = await db.from(Users).select(() => ({
  atPos: position(Users.email, "@"),
}));

// Filter emails where '@' appears after position 5
await db
  .from(Users)
  .select("*")
  .where(() => gt(position(Users.email, "@"), 5));
```

### `concat`

Concatenates the text representations of all arguments into a single string. `null` arguments are ignored, matching PostgreSQL's `concat()` behavior. Arguments can be columns, SQL functions, raw `sql` expressions, prepared `Arg`s, or primitive values.

```typescript
import { concat } from "durcno";

const result = await db.from(Users).select(() => ({
  fullName: concat(Users.firstName, " ", Users.lastName),
  identifier: concat(Users.username, "#", Users.id),
}));
```

### `concatWs`

Concatenates arguments with a separator string (`concat_ws`). If the separator is `null`, the result is `null`. Any `null` values among the expressions to concatenate are skipped.

```typescript
import { concatWs } from "durcno";

const result = await db.from(Users).select(() => ({
  address: concatWs(", ", Users.city, Users.state, Users.country),
}));
```

### Composing String Functions

String functions that return a string can be passed as the input to another string function:

```typescript
import { lower, trim, startsWith } from "durcno";

// Trim whitespace then lowercase before filtering
await db
  .from(Users)
  .select("*")
  .where(() => startsWith(lower(trim(Users.email)), "admin"));
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

const result = await db.from(Accounts).select(() => ({
  absBalance: abs(Accounts.balance),
}));
```

### `mod`

Returns the remainder of dividing the expression by `n`.

```typescript
import { mod, eq } from "durcno";

// Get rows with even IDs
await db
  .from(Users)
  .select("*")
  .where(() => eq(mod(Users.id, 2), 0));
```

### `round`

Rounds a numeric expression. Omit `decimals` to round to the nearest integer, or pass a value to round to that many decimal places.

```typescript
import { round } from "durcno";

const result = await db.from(Products).select(() => ({
  roundedPrice: round(Products.price),
  twoDecimals: round(Products.price, 2),
}));
```

### `ceil` / `floor`

Round up or down to the nearest integer.

```typescript
import { ceil, floor } from "durcno";

const result = await db.from(Products).select(() => ({
  ceiling: ceil(Products.price),
  floored: floor(Products.price),
}));
```

### `trunc`

Truncates a numeric expression towards zero. Omit `decimals` to truncate to the nearest integer, or pass a value to truncate to that many decimal places.

```typescript
import { trunc } from "durcno";

const result = await db.from(Products).select(() => ({
  truncatedPrice: trunc(Products.price),
  twoDecimals: trunc(Products.price, 2),
}));
```

### `power`

Returns a numeric expression raised to the power of `exponent`.

```typescript
import { power } from "durcno";

const result = await db.from(Products).select(() => ({
  squared: power(Products.price, 2),
}));
```

---

## Arithmetic Operators

Arithmetic operators combine two numeric expressions using standard math operators. Both operands can be a numeric column, the result of another numeric function, a plain number or `bigint` literal, an `Arg`, or a typed `Sql` expression (`Sql<number>` / `Sql<bigint>`).

| Function    | SQL       | Returns  | Description                           |
| ----------- | --------- | -------- | ------------------------------------- |
| `add(a, b)` | `(a + b)` | `number` | Sum of two numeric expressions        |
| `sub(a, b)` | `(a - b)` | `number` | Difference of two numeric expressions |
| `mul(a, b)` | `(a * b)` | `number` | Product of two numeric expressions    |
| `div(a, b)` | `(a / b)` | `number` | Quotient of two numeric expressions   |

### Basic Usage

```typescript
import { add, sub, mul, div } from "durcno";

const result = await db.from(Orders).select(() => ({
  grossTotal: add(Orders.subtotal, Orders.tax),
  discount: sub(Orders.price, Orders.discountAmount),
  doubled: mul(Orders.quantity, 2),
  half: div(Orders.amount, 2),
}));
```

### Nesting Arithmetic Operators

Arithmetic results are wrapped in parentheses, so they compose safely:

```typescript
import { add, mul, sub } from "durcno";

// (age * 2) + (5 - 1)
const result = await db.from(Users).select(() => ({
  derived: add(mul(Users.age, 2), sub(5, 1)),
}));
```

---

## Conditional Functions

Conditional functions evaluate expressions based on conditions or nullability. Operands can be columns, SQL functions, raw `sql` expressions, prepared `Arg`s, primitive literals (`string`, `number`, `bigint`, `boolean`), or `null`.

| Function              | SQL                     | Returns     | Description                                                                    |
| --------------------- | ----------------------- | ----------- | ------------------------------------------------------------------------------ |
| `coalesce(...exprs)`  | `coalesce(...)`         | Inferred    | Returns the first non-null argument; drops `null` if any argument is non-null  |
| `nullif(expr, val)`   | `nullif(expr, val)`     | `T \| null` | Returns `null` if `expr = val`, otherwise returns `expr`                       |
| `greatest(...exprs)`  | `greatest(...)`         | Inferred    | Returns the largest value; skips nulls; drops `null` if any is non-null        |
| `least(...exprs)`     | `least(...)`            | Inferred    | Returns the smallest value; skips nulls; drops `null` if any is non-null       |
| `caseWhen(cond, res)` | `CASE WHEN ... THEN ..` | Inferred    | Builds a type-safe SQL CASE expression with `.when()`, `.else()`, and `.end()` |

### `coalesce`

Returns the first non-null expression among its arguments. Durcno evaluates argument nullability from left to right: if any argument is guaranteed non-null, `null` is automatically excluded from the inferred return type. When used with arrays (such as `coalesce(jsonAgg(...), [])`), `coalesce` narrows the type to a guaranteed non-null array `T[]`.

```typescript
import { coalesce } from "durcno";

// If fallback is non-null, result type is guaranteed non-null string
const result = await db.from(Users).select(() => ({
  displayName: coalesce(Users.nickname, Users.username),
  contactEmail: coalesce(
    Users.alternateEmail,
    Users.email,
    "no-reply@example.com",
  ),
}));
```

### `caseWhen`

Constructs a type-safe `CASE WHEN ... THEN ... ELSE ... END` expression. Durcno infers the exact **union (`|`)** type across all branch cases, preserving string and numeric literals without widening them to broad primitives.

Both `.else(...)` and `.end()` are **optional**: in PostgreSQL, omitting the `ELSE` clause implicitly returns `NULL` when no conditions match, so Durcno infers `Branches | null`.

```typescript
import { caseWhen, eq, isNull, jsonBuildObject } from "durcno";

// Inferred return type: "Administrator" | "Staff" | "Member"
const usersWithRole = await db.from(Users).select(() => ({
  username: Users.username,
  badge: caseWhen(eq(Users.type, "admin"), "Administrator")
    .when(eq(Users.type, "moderator"), "Staff")
    .else("Member"),
}));

// Direct caseWhen without .else() or .end() -> inferred as "Admin" | null
const adminsOnly = await db.from(Users).select(() => ({
  username: Users.username,
  role: caseWhen(eq(Users.type, "admin"), "Admin"),
}));

// Returning null on unmatched LEFT JOIN -> inferred as null | { id: bigint; username: string }
const postsWithAuthor = await db
  .from(Posts)
  .leftJoin(Users, () => eq(Users.id, Posts.userId))
  .select(({ users }) => ({
    title: Posts.title,
    author: caseWhen(isNull(users.id), null).else(
      jsonBuildObject({
        id: users.id,
        username: users.username,
      }),
    ),
  }));
```

### `nullif`

Returns `null` if `expr` equals `val`, otherwise returns `expr`. Useful for converting sentinel values or empty states into SQL `NULL`.

```typescript
import { nullif } from "durcno";

const result = await db.from(Users).select(() => ({
  status: nullif(Users.status, "unknown"),
}));
// status is string | null
```

### `greatest` / `least`

Returns the largest or smallest value among its arguments, skipping `null` values (unless all arguments are `null`). If any argument is guaranteed non-null, `null` is automatically excluded from the inferred return type.

```typescript
import { greatest, least } from "durcno";

const result = await db.from(Users).select(() => ({
  latestActivity: greatest(Users.updatedAt, Users.createdAt),
  minScore: least(Users.examScore, Users.quizScore, 0),
}));
```

---

## Subquery Functions

Subquery functions implement PostgreSQL's subquery expressions ([Section 9.24](https://www.postgresql.org/docs/current/functions-subquery.html)). They evaluate subquery returns or membership checks and yield a typed boolean value (`true` or `false`).

All subquery functions can be used in:

- `.select(...)` projections as boolean columns
- `.where(...)` and `.having(...)` clauses to filter rows
- `caseWhen(...)` conditions and branch results
- Compound boolean logic with `and(...)` and `or(...)`

| Function                       | SQL                | Returns   | Description                                                                  |
| ------------------------------ | ------------------ | --------- | ---------------------------------------------------------------------------- |
| `exists(subquery)`             | `EXISTS (...)`     | `boolean` | Returns `true` if subquery returns at least one row, else `false`            |
| `notExists(subquery)`          | `NOT EXISTS (...)` | `boolean` | Returns `true` if subquery returns no rows, else `false`                     |
| `isIn(col, valuesOrSubquery)`  | `col IN (...)`     | `boolean` | Returns `true` if column matches any value in list or subquery, else `false` |
| `notIn(col, valuesOrSubquery)` | `col NOT IN (...)` | `boolean` | Returns `true` if column matches no value in list or subquery, else `false`  |

### `exists` / `notExists`

Evaluates whether a subquery returns any rows. Correlated subqueries can reference columns from the outer query scope:

```typescript
import { eq, exists, notExists } from "durcno";

// Project existence as boolean columns in .select()
const userProfiles = await db.from(Users).select(() => ({
  id: Users.id,
  username: Users.username,
  hasPosts: exists(
    db
      .from(Posts)
      .select("*")
      .where(() => eq(Posts.userId, Users.id)),
  ),
  isNewUser: notExists(
    db
      .from(Posts)
      .select("*")
      .where(() => eq(Posts.userId, Users.id)),
  ),
}));

// Use in WHERE clause (correlated subquery)
const authors = await db
  .from(Users)
  .select("*")
  .where(() =>
    exists(
      db
        .from(Posts)
        .select("*")
        .where(() => eq(Posts.userId, Users.id)),
    ),
  );
```

### `isIn` / `notIn`

Checks whether a column value matches any (or none) of the values in a literal array or subquery result. Unlike basic filters, `isIn` and `notIn` can also be projected directly in `.select()`:

```typescript
import { isIn, notIn } from "durcno";

// Project membership check as boolean columns in .select()
const usersWithFlags = await db.from(Users).select(() => ({
  id: Users.id,
  isAdmin: isIn(Users.type, ["admin", "superadmin"]),
  isNotBanned: notIn(Users.status, ["banned", "suspended"]),
}));

// In WHERE clause with value array
const activeAdmins = await db
  .from(Users)
  .select("*")
  .where(() => isIn(Users.type, ["admin", "moderator"]));

// In WHERE clause with subquery
const usersWithRecentOrders = await db
  .from(Users)
  .select("*")
  .where(() =>
    isIn(
      Users.id,
      db.from(Orders).select(() => ({ userId: Orders.userId })),
    ),
  );

// In WHERE clause with NOT IN subquery
const usersWithoutOrders = await db
  .from(Users)
  .select("*")
  .where(() =>
    notIn(
      Users.id,
      db.from(Orders).select(() => ({ userId: Orders.userId })),
    ),
  );
```

When an empty array is passed:

- `isIn(col, [])` automatically evaluates to `FALSE` in SQL.
- `notIn(col, [])` automatically evaluates to `TRUE` in SQL.

---

## JSON & JSONB Functions

Durcno provides full type inference and runtime safety for PostgreSQL JSON and JSONB constructors and aggregates:

| Function           | SQL                               | Description                                             |
| ------------------ | --------------------------------- | ------------------------------------------------------- |
| `jsonBuildObject`  | `json_build_object(k1, v1, ...)`  | Builds a typed JSON object from key-value pairs         |
| `jsonbBuildObject` | `jsonb_build_object(k1, v1, ...)` | Builds a typed JSONB object from key-value pairs        |
| `jsonAgg`          | `json_agg(expr)`                  | Aggregates rows or objects into a typed JSON array      |
| `jsonbAgg`         | `jsonb_agg(expr)`                 | Aggregates rows or objects into a typed JSONB array     |
| `toJson`           | `to_json(tableOrExpr)`            | Converts a table view or expression into a JSON object  |
| `toJsonb`          | `to_jsonb(tableOrExpr)`           | Converts a table view or expression into a JSONB object |
| `jsonBuildArray`   | `json_build_array(e1, e2, ...)`   | Constructs a typed JSON array from expressions          |
| `jsonbBuildArray`  | `jsonb_build_array(e1, e2, ...)`  | Constructs a typed JSONB array from expressions         |
| `jsonStripNulls`   | `json_strip_nulls(jsonObj)`       | Strips null values from a JSON object                   |
| `jsonbStripNulls`  | `jsonb_strip_nulls(jsonbObj)`     | Strips null values from a JSONB object                  |

### `jsonBuildObject` / `jsonbBuildObject`

Builds a typed JSON object by passing an object of fields. Fields can be columns, functions, literals, or nested `jsonBuildObject` calls:

```typescript
import { jsonBuildObject } from "durcno";

const rows = await db.from(Users).select(() => ({
  userCard: jsonBuildObject({
    id: Users.id,
    username: Users.username,
    profile: jsonBuildObject({
      bio: Users.bio,
    }),
  }),
}));
// userCard is inferred as { id: bigint; username: string; profile: { bio: string | null } }
```

### `jsonAgg` / `jsonbAgg` with `coalesce`

Aggregates multiple rows into a typed JSON array. Supports `.filter(condition)`, `.orderBy(...)`, and `.distinct()`:

```typescript
import { asc, coalesce, isNotNull, jsonAgg, jsonBuildObject } from "durcno";

const postsWithComments = await db
  .from(Posts)
  .leftJoin(Comments, () => eq(Comments.postId, Posts.id))
  .select(({ comments }) => ({
    id: Posts.id,
    comments: coalesce(
      jsonAgg(
        jsonBuildObject({
          id: comments.id,
          body: comments.body,
        }),
      )
        .orderBy(asc(comments.id))
        .filter(isNotNull(comments.id)),
      [],
    ),
  }));
// comments is inferred as { id: bigint; body: string | null }[] (never null!)
```

### `toJson` / `toJsonb`

Converts a table view or table definition into a JSON or JSONB representation:

```typescript
import { toJson, toJsonb } from "durcno";

const rows = await db.from(Users).select(() => ({
  userJson: toJson(Users),
  userJsonb: toJsonb(Users),
}));
```

### `jsonBuildArray` / `jsonbBuildArray`

Constructs an array from arguments:

```typescript
import { jsonBuildArray } from "durcno";

const rows = await db.from(Users).select(() => ({
  tags: jsonBuildArray(Users.type, "verified", 1),
}));
```

### `jsonStripNulls` / `jsonbStripNulls`

Removes object fields that contain SQL `NULL`:

```typescript
import { jsonBuildObject, jsonStripNulls } from "durcno";

const rows = await db.from(Users).select(() => ({
  cleaned: jsonStripNulls(
    jsonBuildObject({
      username: Users.username,
      email: Users.email,
    }),
  ),
}));
```

---

## Null Safety & Return Typing

Durcno SQL functions accurately model PostgreSQL strict function nullability semantics in TypeScript:

- **Strict null**: Passing `null` directly (e.g., `lower(null)`) infers `null`.
- **Nullable inputs**: If an argument is a nullable column or expression, the return type is automatically inferred as `T | null`.
- **Guaranteed non-null**: When all arguments are guaranteed non-null (`notNull` columns, literal constants), the return type is inferred as `T`.

---

## Functions in `orderBy`

All scalar functions can be used with `asc()` / `desc()` in `.orderBy()`:

```typescript
import { lower, length, asc, desc } from "durcno";

// Order by lowercased name
await db
  .from(Users)
  .select("*")
  .orderBy(() => asc(lower(Users.name)));

// Order by name length descending
await db
  .from(Users)
  .select("*")
  .orderBy(() => desc(length(Users.name)));
```