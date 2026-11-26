---
bump: minor
---

# feat: add pg_trgm similarity and predicate helpers

Durcno can now call the `pg_trgm` functions and operators that its existing `gin_trgm_ops` indexes support. The scalar builders `similarity()`, `wordSimilarity()`, `strictWordSimilarity()`, and `showTrgm()` are first-class `SqlFn` expressions: results infer as `number` (or `number | null` for nullable operands), `Arg` placeholders carry through as prepared parameters, and scores compose with `greatest()`, `asc()`, and `desc()`. `showTrgm()` returns `string[]`.

Three filters cover the similarity operators: `similar()` renders `%`, `wordSimilar()` renders `<%`, and `strictWordSimilar()` renders `<<%`. The word operators keep PostgreSQL's argument order, with the search term first and the text second.

```typescript
const results = await db
  .from(Articles)
  .select(() => ({
    score: greatest(
      tsRankCd(Articles.search, websearchToTsquery(term)),
      similarity(Articles.body, term),
    ),
  }))
  .where(() => wordSimilar(term, Articles.title))
  .orderBy(() => desc(similarity(Articles.body, term)));
```

As with other extensions, enable `pg_trgm` in the database before using these helpers.
