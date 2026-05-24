---
sidebar_position: 2
---

# pgvector

[pgvector](https://github.com/pgvector/pgvector) adds support for vector similarity search to PostgreSQL. Durcno provides type-safe column types for pgvector's vector types and distance functions, with automatic serialization for nearest-neighbor queries.

## Prerequisites

Enable the pgvector extension in your database:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

The pgvector extension requires PostgreSQL 14+. For Docker, use the `pgvector/pgvector` image.

## Import

All pgvector column types are available through the `pgvector` namespace:

```typescript
import { pgvector } from "durcno";
```

Distance functions are imported directly:

```typescript
import {
  l2Distance,
  cosineDistance,
  innerProduct,
  l1Distance,
  hammingDistance,
  jaccardDistance,
} from "durcno";
```

## Vector Column Types

### `pgvector.vector`

Represents a dense vector of floating-point numbers.

- **SQL type**: `vector` or `vector(dimensions)`
- **JS type**: `number[]`

```typescript
import { table, pk, varchar, notNull, pgvector } from "durcno";

export const Embeddings = table("public", "embeddings", {
  id: pk(),
  text: varchar({ length: 1000, notNull }),
  embedding: pgvector.vector({ dimensions: 1536, notNull }),
});

// Insert a vector
await db.insert(Embeddings).values({
  text: "The quick brown fox",
  embedding: [0.1, 0.2, 0.3, ..., 0.5], // 1536 dimensions
});

// Select returns the same array format
const rows = await db.from(Embeddings).select();
// rows[0].embedding → [0.1, 0.2, 0.3, ..., 0.5]
```

### `pgvector.halfvec`

Represents a half-precision (16-bit) vector for memory-efficient storage.

- **SQL type**: `halfvec` or `halfvec(dimensions)`
- **JS type**: `number[]`

```typescript
export const Embeddings = table("public", "embeddings", {
  id: pk(),
  text: varchar({ length: 1000, notNull }),
  embedding: pgvector.halfvec({ dimensions: 768, notNull }),
});

// Same usage as vector but with half-precision storage
await db.insert(Embeddings).values({
  text: "Sample text",
  embedding: [0.1, 0.2, 0.3, ..., 0.5], // 768 dimensions
});
```

### `pgvector.sparsevec`

Represents a sparse vector (only non-zero values are stored).

- **SQL type**: `sparsevec` or `sparsevec(dimensions)`
- **JS type**: `string` — space-separated format `{index:value,index:value}/total_dimensions`

```typescript
export const SparseEmbeddings = table("public", "sparseEmbeddings", {
  id: pk(),
  sparse: pgvector.sparsevec({ dimensions: 1000, notNull }),
});

// Sparse vectors use a compact format
await db.insert(SparseEmbeddings).values({
  sparse: "{10:0.5,42:0.3,100:0.2}/1000",
});

const rows = await db.from(SparseEmbeddings).select();
// rows[0].sparse → "{10:0.5,42:0.3,100:0.2}/1000"
```

### `pgvector.bit`

Represents a bit string (binary vector), useful for binary embeddings and Hamming distance.

- **SQL type**: `bit` or `bit(length)`
- **JS type**: `string` — binary string of `0` and `1` characters

```typescript
export const BinaryEmbeddings = table("public", "binaryEmbeddings", {
  id: pk(),
  bits: pgvector.bit({ length: 1024, notNull }),
});

await db.insert(BinaryEmbeddings).values({
  bits: "1010101010...", // 1024 bits
});

const rows = await db.from(BinaryEmbeddings).select();
// rows[0].bits → "1010101010..."
```

## Column Configuration

All pgvector columns accept these common options:

| Option       | Type     | Default | Description                                                          |
| ------------ | -------- | ------- | -------------------------------------------------------------------- |
| `dimensions` | `number` | —       | Fixed vector dimension length (optional, for `vector` and `halfvec`) |
| `length`     | `number` | —       | Fixed bit string length (optional, for `bit`)                        |
| `notNull`    | symbol   | —       | Makes the column NOT NULL                                            |
| `unique`     | symbol   | —       | Adds a UNIQUE constraint                                             |

## Distance Functions

Durcno provides type-safe distance functions for use in `.select()`, `.orderBy()`, and `.where()` clauses:

```typescript
import {
  l2Distance,
  cosineDistance,
  innerProduct,
  l1Distance,
  hammingDistance,
} from "durcno";
```

### Available Distance Functions

| Function                       | SQL Generated    | Use Case                           |
| ------------------------------ | ---------------- | ---------------------------------- |
| `l2Distance(col, vector)`      | `col <-> vector` | Euclidean distance (most common)   |
| `cosineDistance(col, vector)`  | `col <=> vector` | Cosine distance (normalized)       |
| `innerProduct(col, vector)`    | `col <#> vector` | Inner product (negative)           |
| `l1Distance(col, vector)`      | `col <+> vector` | Manhattan/Taxicab distance         |
| `hammingDistance(col, vector)` | `col <~> vector` | Hamming distance (for bit columns) |

Each function accepts:

- **Column**: A pgvector column (`vector`, `halfvec`, `sparsevec`, or `bit`)
- **Query vector**: A `number[]` array or binary string (typed from the column's ValType)

### In SELECT — Compute Distance

Add a computed distance column to results:

```typescript
const Embeddings = table("public", "embeddings", {
  id: pk(),
  text: varchar({ length: 1000, notNull }),
  embedding: pgvector.vector({ dimensions: 1536, notNull }),
});

const queryVector = [0.1, 0.2, 0.3, ..., 0.5]; // 1536 dimensions

const rows = await db
  .from(Embeddings)
  .select({
    id: Embeddings.id,
    text: Embeddings.text,
    distance: l2Distance(Embeddings.embedding, queryVector),
  });

// rows[0].distance → 0.123 (numeric distance)
```

### In ORDER BY — Find Nearest Neighbors

Find the closest vectors by ordering by distance:

```typescript
const queryVector = [0.1, 0.2, 0.3, ..., 0.5];

const nearest = await db
  .from(Embeddings)
  .select()
  .orderBy(asc(l2Distance(Embeddings.embedding, queryVector)))
  .limit(10);

// Returns the 10 closest vectors
```

### In WHERE — Distance Filter

Filter rows within a distance threshold:

```typescript
const queryVector = [0.1, 0.2, 0.3, ..., 0.5];

const similar = await db
  .from(Embeddings)
  .select()
  .where(lt(l2Distance(Embeddings.embedding, queryVector), 0.5));

// Returns all embeddings within 0.5 distance
```

### Hamming Distance for Bit Columns

For bit columns, use `hammingDistance` to count differing bits:

```typescript
const BinaryEmbeddings = table("public", "binaryEmbeddings", {
  id: pk(),
  bits: pgvector.bit({ length: 1024, notNull }),
});

const queryBits = "1010101010..."; // 1024 bits

const results = await db
  .from(BinaryEmbeddings)
  .select({
    id: BinaryEmbeddings.id,
    distance: hammingDistance(BinaryEmbeddings.bits, queryBits),
  })
  .orderBy(asc(hammingDistance(BinaryEmbeddings.bits, queryBits)))
  .limit(5);

// results[0].distance → number of bit differences
```

## Indexes for Vector Similarity

pgvector supports specialized index types for fast nearest-neighbor search. Use the `.opclass()` method to specify an operator class when creating indexes:

```typescript
import { table, pk, index, pgvector } from "durcno";

export const Embeddings = table(
  "public",
  "embeddings",
  {
    id: pk(),
    embedding: pgvector.vector({ dimensions: 1536, notNull }),
  },
  {
    indexes: (t) => [
      // IVFFlat index for large datasets (faster approximate search)
      index([t.embedding.opclass("vector_l2_ops")]).using("ivfflat"),

      // HNSW index for production use (best performance)
      index([t.embedding.opclass("vector_l2_ops")]).using("hnsw"),
    ],
  },
);
```

### Index Types and Operator Classes

| Index Type | Operator Classes                                      | Best For                           |
| ---------- | ----------------------------------------------------- | ---------------------------------- |
| `ivfflat`  | `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops` | Large datasets, approximate search |
| `hnsw`     | `vector_l2_ops`, `vector_ip_ops`, `vector_cosine_ops` | Production, real-time search       |
| `btree`    | None (use default)                                    | Exact vector matching (rare)       |

```typescript
import { asc, eq, index, pgvector, table, pk } from "durcno";

export const Embeddings = table(
  "public",
  "embeddings",
  {
    id: pk(),
    embedding: pgvector.vector({ dimensions: 1536, notNull }),
    halfEmbedding: pgvector.halfvec({ dimensions: 768, notNull }),
    bits: pgvector.bit({ length: 512, notNull }),
  },
  {
    indexes: (t) => [
      // L2 distance index for dense vectors
      index([t.embedding.opclass("vector_l2_ops")]).using("hnsw"),

      // Cosine distance index for half-precision vectors
      index([t.halfEmbedding.opclass("halfvec_cosine_ops")]).using("ivfflat"),

      // Hamming distance index for bit strings
      index([t.bits.opclass("bit_hamming_ops")]).using("hnsw"),
    ],
  },
);
```

## Complete Example

Combine vectors, distance functions, and indexes for a semantic search system:

```typescript
import {
  asc,
  database,
  defineConfig,
  eq,
  index,
  l2Distance,
  lt,
  pgvector,
  pk,
  table,
  varchar,
  notNull,
} from "durcno";
import { pg } from "durcno/connectors/pg";

// Define schema with embeddings and index
export const Documents = table(
  "public",
  "documents",
  {
    id: pk(),
    content: varchar({ length: 5000, notNull }),
    embedding: pgvector.vector({ dimensions: 1536, notNull }),
  },
  {
    indexes: (t) => [
      index([t.embedding.opclass("vector_l2_ops")]).using("hnsw"),
    ],
  },
);

// Setup database
const config = defineConfig({
  schema: "./schema.ts",
  connector: pg({
    dbCredentials: { url: process.env.DATABASE_URL! },
  }),
});

const db = database({ Documents }, config);

// Semantic search: find documents similar to a query embedding
async function searchSimilar(queryEmbedding: number[]) {
  const results = await db
    .from(Documents)
    .select({
      id: Documents.id,
      content: Documents.content,
      distance: l2Distance(Documents.embedding, queryEmbedding),
    })
    .where(lt(l2Distance(Documents.embedding, queryEmbedding), 1.0)) // threshold
    .orderBy(asc(l2Distance(Documents.embedding, queryEmbedding)))
    .limit(10);

  return results;
}

// Insert a document with embedding
await db.insert(Documents).values({
  content: "PostgreSQL is a powerful database",
  embedding: [0.1, 0.2, 0.3, ..., 0.5], // e.g., from OpenAI API
});

// Perform semantic search
const similar = await searchSimilar([0.12, 0.21, 0.31, ..., 0.51]);
console.log(similar); // Sorted by similarity
```

## Data Format

Durcno automatically handles serialization between:

- **TypeScript** ↔ JavaScript arrays (what you read/write)
- **PostgreSQL** ↔ pgvector native format (the internal wire format)

This means you work with simple `number[]` arrays in your application code while Durcno handles the database conversion transparently.

## Type Safety

Durcno provides full type safety for vector dimensions:

```typescript
const col = pgvector.vector({ dimensions: 1536 });

// TypeScript infers: [number, number, ..., number] (1536 tuple)
const vec: typeof col.ValType = /* must be exactly 1536 numbers */;

// Distance functions are type-safe
const dist = l2Distance(col, vec); // ✓ Compiles
const dist2 = l2Distance(col, [1, 2, 3]); // ✗ Type error: wrong dimensions
```