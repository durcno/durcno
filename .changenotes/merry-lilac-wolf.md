---
bump: minor
---

# feat(qb): add full-text search support

Add a `tsvector` column type with Zod validation, driver conversion, and migration support. Declare search columns directly and index them with GIN:

```ts
export const Articles = table(
  "public",
  "articles",
  {
    id: pk(),
    title: varchar({ length: 255, notNull }),
    body: text({ notNull }),
    search: tsvector({ notNull }),
  },
  {
    indexes: (t) => [index([t.search]).using("gin")],
  },
);
```

Introduce `tsMatch(vector, query)` for the `@@` predicate and the full-text helper family: `toTsvector`, `toTsquery`, `plaintoTsquery`, `phrasetoTsquery`, `websearchToTsquery`, `tsHeadline`, `tsRank`, `tsRankCd`, `setweight`, `strip`, `querytree`, and `numnode`.

```ts
const term = websearchToTsquery("postgres full text");

const results = await db
  .from(Articles)
  .select(() => ({ id: Articles.id, rank: tsRank(Articles.search, term) }))
  .where(() => tsMatch(Articles.search, term))
  .orderBy(() => desc(tsRank(Articles.search, term)));
```

Vector and query literals are cast to `tsvector` / `tsquery`, and text search configurations accept named configs or prepared parameters. `tsMatch` also tracks direct `Arg` operands so unprepared queries reject bound placeholders while `db.prepare()` accepts them.
