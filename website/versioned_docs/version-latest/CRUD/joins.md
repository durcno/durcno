---
sidebar_position: 1.1
---

# Joins

Use `.innerJoin()` and `.leftJoin()` to combine rows from related tables in a `SELECT` query. Both methods take a target table and an `ON` condition built from filter expressions such as `eq()`.

## Join methods

| Method                  | Description                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------- |
| `.innerJoin(table, on)` | Return only rows where the join condition matches                                        |
| `.leftJoin(table, on)`  | Return every row from the left table, with `null` values for unmatched rows on the right |

## Inner joins

Use `.innerJoin()` when you only want rows that have matching values in both tables.

```typescript
import { eq } from "durcno";
import { Users, Posts } from "./db/schema.ts";

const postsByAuthor = await db
  .from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select({
    username: Users.username,
    title: Posts.title,
  });
```

## Left joins

Use `.leftJoin()` when you want every row from the left table and nullable values from the right table for unmatched rows. Columns from the joined table are inferred as nullable in the select result.

```typescript
const authorsAndPosts = await db
  .from(Users)
  .leftJoin(Posts, eq(Users.id, Posts.userId))
  .select({
    username: Users.username,
    postTitle: Posts.title,
  });
```

## Multiple joins

Chain joins in the same query to traverse more than one relationship:

```typescript
const data = await db
  .from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .leftJoin(Comments, eq(Posts.id, Comments.postId))
  .select({
    username: Users.username,
    postTitle: Posts.title,
    commentBody: Comments.body,
  });
```

## Using joins in other clauses

Join columns work in the same clauses as base-table columns. You can use them in `.where()`, `.orderBy()`, `.groupBy()`, and `.having()` after the join is added:

```typescript
const recentPosts = await db
  .from(Users)
  .leftJoin(Posts, eq(Users.id, Posts.userId))
  .select({
    username: Users.username,
    title: Posts.title,
  })
  .where(eq(Users.type, "admin"))
  .orderBy(Users.username);
```

## Related

- [Select](./select.md) — build SELECT queries and reuse joins in the fluent API
- [Filters](../Expressions/filters.md) — operators for the join condition