---
bump: minor
---

# feat: add pgvector extension support

Adds complete pgvector extension support to Durcno, enabling vector similarity search and distance calculations.

## New Features

- **pgvector column type**: New `pgvector` columns for storing and querying vector embeddings
- **Distance functions**: L2, L1, Hamming, and cosine distance operators for vector comparisons
- **Vector operations**: Support for pgvector distance, similarity search, and filtering
- **Index opclass support**: Ability to specify custom operator classes for indexes to support pgvector and other specialized index types

## Usage

Define vectors in your schema and perform similarity searches:

```typescript
import { pgvector, pk, table } from "durcno";

export const Records = table("public", "records", {
  id: pk(),
  embedding: pgvector.vector({ dimensions: 1536 }),
});

// Query with distance operations
const results = await db
  .from(Records)
  .select()
  .where(lt(l2Distance(Records.embedding, queryVector), 1.0)) // threshold
  .orderBy(asc(l2Distance(Records.embedding, queryVector)))
  .limit(10);
```