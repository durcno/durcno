---
sidebar_position: 1.1
---

# Joins

Use `.innerJoin()` and `.leftJoin()` to combine rows from related tables in a `SELECT` query. Both methods take a target table and a callback to produce an `ON` condition built from filter expressions such as `eq()`.

## Join methods

| Method                        | Description                                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `.innerJoin(table, callback)` | Return only rows where the join condition matches via `() => condition`                                        |
| `.leftJoin(table, callback)`  | Return every row from the left table, with `null` values for unmatched rows on the right via `() => condition` |

## Inner joins

Use `.innerJoin()` when you only want rows that have matching values in both tables.

```typescript
import { eq } from "durcno";
import { Users, Posts } from "./db/schema.ts";

const postsByAuthor = await db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(() => ({
    username: Users.username,
    title: Posts.title,
  }));
```

## Left joins

Use `.leftJoin()` when you want every row from the left table and nullable values from the right table for unmatched rows. Columns from the left-joined table are destructured from the callback parameter and inferred as nullable in the select result.

```typescript
const authorsAndPosts = await db
  .from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({
    username: Users.username,
    postTitle: posts.title,
  }));
```

## Multiple joins

Chain joins in the same query to traverse more than one relationship:

```typescript
const data = await db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .leftJoin(Comments, () => eq(Posts.id, Comments.postId))
  .select(({ comments }) => ({
    username: Users.username,
    postTitle: Posts.title,
    commentBody: comments.body,
  }));
```

## Using joins in other clauses

Join columns work in the same clauses as base-table columns. You can use them in `.where()`, `.orderBy()`, `.groupBy()`, and `.having()` after the join is added:

```typescript
import { asc, eq } from "durcno";

const recentPosts = await db
  .from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({
    username: Users.username,
    title: posts.title,
  }))
  .where(() => eq(Users.type, "admin"))
  .orderBy(() => asc(Users.username));
```

## Aggregating 1-to-many joins into JSON

When joining a 1-to-many relation, standard SQL joins duplicate the parent row for every matching child. You can use `jsonAgg` and `jsonBuildObject` to collapse children directly into a typed array on the parent row in a single query:

```typescript
import { asc, coalesce, eq, isNotNull, jsonAgg, jsonBuildObject } from "durcno";

const postsWithComments = await db
  .from(Posts)
  .leftJoin(Comments, () => eq(Comments.postId, Posts.id))
  .select(({ comments }) => ({
    id: Posts.id,
    title: Posts.title,
    comments: coalesce(
      jsonAgg(
        jsonBuildObject({
          id: comments.id,
          body: comments.body,
          createdAt: comments.createdAt,
        }),
      )
        .orderBy(asc(comments.createdAt))
        .filter(isNotNull(comments.id)),
      [],
    ),
  }));
```

### Why this pattern works:

- **`jsonBuildObject`**: Constructs a strongly-typed JSON object with exact field names and types inferred from your schema.
- **`.filter(isNotNull(comments.id))`**: Translates to SQL `FILTER (WHERE comments.id IS NOT NULL)`, preventing `json_agg` from packing a `[{ id: null, ... }]` element when the post has zero comments.
- **`coalesce(..., [])`**: PostgreSQL's `json_agg` returns SQL `NULL` when all rows are filtered out. Wrapping with `coalesce(..., [])` returns a guaranteed non-null `Comment[]` array (typed as `Comment[]`, never `null`).
- **`.orderBy(...)`**: Aggregate functions support inline `.orderBy()` to sort items within the aggregated array.
- **Automatic `GROUP BY`**: When non-aggregate and aggregate columns are mixed in `.select()`, Durcno automatically groups by the parent columns (`Posts.id`, `Posts.title`).

## Nesting 1-to-1 joins into JSON objects

For 1-to-1 or many-to-one relations, you can nest the joined record into an object using `jsonBuildObject`. When using `.leftJoin()`, use `caseWhen()` to return `null` instead of an object with null fields if no related record exists:

```typescript
import { caseWhen, eq, isNull, jsonBuildObject } from "durcno";

const postsWithAuthor = await db
  .from(Posts)
  .leftJoin(Users, () => eq(Users.id, Posts.userId))
  .select(({ users }) => ({
    id: Posts.id,
    title: Posts.title,
    author: caseWhen(isNull(users.id), null).else(
      jsonBuildObject({
        id: users.id,
        username: users.username,
        email: users.email,
      }),
    ),
  }));
// author is inferred as { id: bigint; username: string; email: string | null } | null
```

## Related

- [Select](./select.md) — build SELECT queries and reuse joins in the fluent API
- [Functions](../Expressions/functions.md) — JSON functions (`jsonAgg`, `jsonBuildObject`), CASE expressions, and aggregates
- [Filters](../Expressions/filters.md) — operators for the join condition