---
sidebar_position: 5
---

# Filters

Durcno provides a set of type-safe filter operators for building WHERE conditions.

## Operator Reference

| Operator                      | Description                      | Example                                      |
| ----------------------------- | -------------------------------- | -------------------------------------------- |
| `eq(col, val)`                | Equal                            | `eq(Users.type, "admin")`                    |
| `ne(col, val)`                | Not equal                        | `ne(Users.type, "admin")`                    |
| `gt(col, val)`                | Greater than                     | `gt(Users.id, 10n)`                          |
| `gte(col, val)`               | Greater than or equal            | `gte(Users.id, 10n)`                         |
| `lt(col, val)`                | Less than                        | `lt(Users.id, 10n)`                          |
| `lte(col, val)`               | Less than or equal               | `lte(Users.id, 10n)`                         |
| `isNull(col)`                 | IS NULL                          | `isNull(Users.email)`                        |
| `isNotNull(col)`              | IS NOT NULL                      | `isNotNull(Users.email)`                     |
| `isIn(col, arrOrSubquery)`    | IN array or subquery             | `isIn(Users.id, [1n, 2n, 3n])`               |
| `and(...conditions)`          | AND logic                        | `and(eq(...), gte(...))`                     |
| `or(...conditions)`           | OR logic                         | `or(eq(...), eq(...))`                       |
| `arrayContains(col, values)`  | Array contains all values (`@>`) | `arrayContains(Posts.tags, ["ts", "pg"])`    |
| `arrayContainedBy(col, vals)` | Array subset of values (`<@`)    | `arrayContainedBy(Posts.tags, ["ts", "pg"])` |
| `arrayOverlaps(col, values)`  | Array overlaps values (`&&`)     | `arrayOverlaps(Posts.tags, ["ts"])`          |
| `arrayHas(col, value)`        | Value exists in array (`ANY`)    | `arrayHas(Posts.tags, "typescript")`         |
| `arrayAll(col, value)`        | All elements match value (`ALL`) | `arrayAll(Posts.flags, true)`                |

## Comparison Operators

### Equal (`eq`)

Check if a column equals a value:

```typescript
import { eq } from "durcno";

// Filter by exact value
await db.from(Users).select().where(eq(Users.type, "admin"));

// Compare two columns
await db.from(Users).innerJoin(Posts, eq(Users.id, Posts.userId)).select();
```

### Not Equal (`ne`)

Check if a column does not equal a value:

```typescript
import { ne } from "durcno";

// Get all non-admin users
await db.from(Users).select().where(ne(Users.type, "admin"));
```

### Greater Than or Equal (`gte`)

Check if a column is greater than or equal to a value:

```typescript
import { gte } from "durcno";

// Get users created after a date
await db
  .from(Users)
  .select()
  .where(gte(Users.createdAt, new Date("2024-01-01")));

// Get users with id >= 10
await db.from(Users).select().where(gte(Users.id, 10n));
```

### Less Than or Equal (`lte`)

Check if a column is less than or equal to a value:

```typescript
import { lte } from "durcno";

// Get users created before a date
await db
  .from(Users)
  .select()
  .where(lte(Users.createdAt, new Date("2024-01-01")));
```

### Greater Than (`gt`)

Check if a column is strictly greater than a value:

```typescript
import { gt } from "durcno";

// Get users with id > 10 (excludes 10)
await db.from(Users).select().where(gt(Users.id, 10n));

// Get users created after a date
await db
  .from(Users)
  .select()
  .where(gt(Users.createdAt, new Date("2024-01-01")));
```

### Less Than (`lt`)

Check if a column is strictly less than a value:

```typescript
import { lt } from "durcno";

// Get users with id < 100 (excludes 100)
await db.from(Users).select().where(lt(Users.id, 100n));

// Get users created before a date
await db
  .from(Users)
  .select()
  .where(lt(Users.createdAt, new Date("2024-12-31")));
```

### IS NULL (`isNull`)

Check if a column is NULL:

```typescript
import { isNull } from "durcno";

// Get users without an email
await db.from(Users).select().where(isNull(Users.email));
```

### IS NOT NULL (`isNotNull`)

Check if a column is not NULL:

```typescript
import { isNotNull } from "durcno";

// Get users with an email
await db.from(Users).select().where(isNotNull(Users.email));
```

### IN Array (`isIn`)

Check if a column value is in an array:

```typescript
import { isIn } from "durcno";

// Get users with specific IDs
await db
  .from(Users)
  .select()
  .where(isIn(Users.id, [1n, 2n, 3n]));

// Get users with specific types
await db
  .from(Users)
  .select()
  .where(isIn(Users.type, ["admin", "user"]));
```

## Logical Operators

### AND (`and`)

Combine multiple conditions with AND logic:

```typescript
import { and, eq, gte } from "durcno";

// Multiple conditions - all must be true
await db
  .from(Users)
  .select()
  .where(
    and(eq(Users.type, "admin"), gte(Users.createdAt, new Date("2024-01-01"))),
  );

// Combine more than two conditions
await db
  .from(Users)
  .select()
  .where(
    and(eq(Users.type, "admin"), gte(Users.id, 10n), isNotNull(Users.email)),
  );
```

### OR (`or`)

Combine multiple conditions with OR logic:

```typescript
import { or, eq } from "durcno";

// Either condition can be true
await db
  .from(Users)
  .select()
  .where(or(eq(Users.type, "admin"), eq(Users.type, "user")));
```

### Combining AND and OR

Nest `and()` and `or()` for complex conditions:

```typescript
import { and, or, eq, gte, isNotNull } from "durcno";

// (type = 'admin' OR type = 'moderator') AND createdAt >= date
await db
  .from(Users)
  .select()
  .where(
    and(
      or(eq(Users.type, "admin"), eq(Users.type, "moderator")),
      gte(Users.createdAt, new Date("2024-01-01")),
    ),
  );
```

## Array Operators

Array operators are useful when working with PostgreSQL array columns.

### Array Contains (`arrayContains`)

Checks if an array column contains all provided values (`@>`):

```typescript
import { arrayContains } from "durcno";

await db
  .from(Posts)
  .select()
  .where(arrayContains(Posts.tags, ["typescript", "postgres"]));
```

### Array Contained By (`arrayContainedBy`)

Checks if an array column is a subset of provided values (`<@`):

```typescript
import { arrayContainedBy } from "durcno";

await db
  .from(Posts)
  .select()
  .where(arrayContainedBy(Posts.tags, ["typescript", "postgres", "orm"]));
```

### Array Overlaps (`arrayOverlaps`)

Checks if two arrays share at least one value (`&&`):

```typescript
import { arrayOverlaps } from "durcno";

await db
  .from(Posts)
  .select()
  .where(arrayOverlaps(Posts.tags, ["postgres"]));
```

### Array Has (`arrayHas`)

Checks if a value exists in an array column (`= ANY(column)`):

```typescript
import { arrayHas } from "durcno";

await db.from(Posts).select().where(arrayHas(Posts.tags, "typescript"));
```

### Array All (`arrayAll`)

Checks if all elements in an array column equal the provided value (`= ALL(column)`):

```typescript
import { arrayAll } from "durcno";

await db.from(Posts).select().where(arrayAll(Posts.publishedFlags, true));
```

## Column Comparisons

All comparison operators support comparing two columns:

```typescript
import { eq, gte } from "durcno";

// Join condition: compare columns from different tables
await db.from(Users).innerJoin(Posts, eq(Users.id, Posts.userId)).select();

// Compare columns from the same table
await db.from(Events).select().where(gte(Events.endDate, Events.startDate));
```

## Raw SQL in Filters

Use `sql()` for custom SQL expressions in filters:

```typescript
import { sql } from "durcno";

await db
  .from(Users)
  .select()
  .where(sql`LOWER(username) = 'admin'`);
```