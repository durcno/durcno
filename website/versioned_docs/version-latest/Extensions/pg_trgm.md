---
sidebar_position: 3
---

# pg_trgm

[pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) compares text by splitting it into trigrams. Durcno exposes its similarity scores and predicates as typed expressions, so they work in `select`, `where`, and `orderBy` without raw SQL.

## Prerequisites

Enable the extension in a migration:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

`pg_trgm` is a PostgreSQL contrib extension and needs no extra column type. It works with the built-in `text` and `varchar` columns.

## Import

```typescript
import {
  showTrgm,
  similar,
  similarity,
  strictWordSimilar,
  strictWordSimilarity,
  wordSimilar,
  wordSimilarity,
} from "durcno";
```

## Indexing

Use a GIN index with the `gin_trgm_ops` operator class:

```typescript
import { index, notNull, pk, table, text } from "durcno";

export const Articles = table(
  "public",
  "articles",
  {
    id: pk(),
    title: text({ notNull }),
  },
  {
    indexes: (t) => [index([t.title.opclass("gin_trgm_ops")]).using("gin")],
  },
);
```

## Querying

Scores are useful for ranking; predicates filter by the session's similarity thresholds:

```typescript
import { desc, similar, similarity } from "durcno";

const term = "postgres full text";

const results = await db
  .from(Articles)
  .select(() => ({
    id: Articles.id,
    score: similarity(Articles.title, term),
  }))
  .where(() => similar(Articles.title, term))
  .orderBy(() => desc(similarity(Articles.title, term)));
```

See [Trigram Similarity Functions](../Expressions/functions#trigram-similarity-functions-pg_trgm) and [Trigram Similarity predicates](../Expressions/filters#trigram-similarity) for the full API.
