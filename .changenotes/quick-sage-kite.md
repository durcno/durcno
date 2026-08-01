---
bump: minor
---

# feat(query-builder): support left joins

`leftJoin` is now fully supported in the query builder! Columns and SQL functions originating from a `leftJoin` are now correctly inferred as nullable (`T | null`) in TypeScript, matching runtime SQL behavior when a joined record doesn't exist.

```ts
const query = db
  .from(Users)
  .leftJoin(Posts, eq(Users.id, Posts.userId))
  .select({
    username: Users.username,
    postTitle: Posts.title, // Left joined column
    lowerPostTitle: lower(Posts.title), // Left joined SQL function
  });

type ReturnType = Awaited<typeof query>;
// Inferenced as:
// {
//   username: string;
//   postTitle: string | null;
//   lowerPostTitle: string | null;
// }[]
```