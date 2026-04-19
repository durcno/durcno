---
sidebar_position: 2
---

# Indexes

Indexes are critical for optimizing database query performance. Durcno provides a type-safe API for defining indexes on your tables using PostgreSQL's various index types.

## Basic Index Definition

Indexes are defined using the `indexes` callback in your table definition's third argument:

```typescript
import { table, pk, varchar, integer, index, notNull } from "durcno";

export const Users = table(
  "public",
  "users",
  {
    id: pk(),
    username: varchar({ length: 50, notNull }),
    email: varchar({ length: 255, notNull }),
    age: integer({}),
  },
  {
    indexes: (t) => [index([t.username]), index([t.email])],
  },
);
```

## Index Function

The `index()` function creates a new index on one or more columns. The returned `Index` object can be further configured with chaining methods such as `.using()` or `.unique()`.

### Syntax

```typescript
index(columns: TableColumn[], using?: IndexType)
```

**Parameters:**

- `columns`: Array of table columns to index
- `using` (optional): Index type (default: `"btree"`). For more explicit control, call `.using()` on the resulting index instance instead of passing this argument.

### Single Column Index

```typescript
export const Users = table(
  "public",
  "users",
  {
    id: pk(),
    email: varchar({ length: 255, notNull }),
  },
  {
    indexes: (t) => [index([t.email])],
  },
);
```

### Multi-Column (Composite) Index

```typescript
export const Posts = table(
  "public",
  "posts",
  {
    id: pk(),
    userId: bigint({ notNull }),
    categoryId: bigint({ notNull }),
    createdAt: timestamp({ notNull }),
  },
  {
    indexes: (t) => [
      // Composite index on userId and categoryId
      index([t.userId, t.categoryId]),

      // Composite index on userId and createdAt for sorting
      index([t.userId, t.createdAt]),
    ],
  },
);
```

## Index Types

PostgreSQL supports multiple index types, each optimized for different use cases. Durcno supports all PostgreSQL index types via the `using()` method on the returned `Index` object.

### B-Tree Index (Default)

B-Tree is the default and most commonly used index type, suitable for equality and range queries.

```typescript
export const Users = table(
  "public",
  "users",
  {
    id: pk(),
    createdAt: timestamp({ notNull }),
  },
  {
    indexes: (t) => [
      index([t.createdAt]).using("btree"),
      // or simply (btree is default)
      index([t.createdAt]),
    ],
  },
);
```

**Use Cases:**

- Equality comparisons (`=`, `!=`)
- Range queries (`<`, `>`, `<=`, `>=`, `BETWEEN`)
- Sorting (`ORDER BY`)
- Pattern matching with `LIKE` (if pattern is anchored at the start)

### Hash Index

Hash indexes are optimized for simple equality comparisons.

```typescript
export const Sessions = table(
  "public",
  "sessions",
  {
    id: pk(),
    token: varchar({ length: 255, notNull }),
  },
  {
    indexes: (t) => [index([t.token]).using("hash")],
  },
);
```

**Use Cases:**

- Exact equality lookups (`=`)
- Not suitable for range queries

:::caution
Hash indexes are not WAL-logged and need to be rebuilt after crashes. Consider using B-Tree for most cases.
:::

### GiST Index

Generalized Search Tree indexes support complex data types and custom operators.

```typescript
export const Documents = table(
  "public",
  "documents",
  {
    id: pk(),
    location: geography.point({ notNull }),
    content: text({ notNull }),
  },
  {
    indexes: (t) => [index([t.location]).using("gist")],
  },
);
```

**Use Cases:**

- Geometric data types (PostGIS)
- Full-text search
- Range types
- Network address types

### SP-GiST Index

Space-Partitioned Generalized Search Tree for non-balanced data structures.

```typescript
export const IPLogs = table(
  "public",
  "ip_logs",
  {
    id: pk(),
    ipAddress: varchar({ length: 45, notNull }),
  },
  {
    indexes: (t) => [index([t.ipAddress]).using("spgist")],
  },
);
```

**Use Cases:**

- Quad-trees
- k-d trees
- IP addresses
- Phone numbers

### GIN Index

Generalized Inverted Indexes for composite values (arrays, JSONB, full-text search).

```typescript
export const Articles = table(
  "public",
  "articles",
  {
    id: pk(),
    tags: text({ notNull }), // Array of tags
    searchVector: text({ notNull }), // tsvector for full-text search
  },
  {
    indexes: (t) => [
      index([t.tags]).using("gin"),
      index([t.searchVector]).using("gin"),
    ],
  },
);
```

**Use Cases:**

- JSONB columns
- Array columns
- Full-text search (tsvector)
- Containment queries

### BRIN Index

Block Range Indexes for very large tables with naturally ordered data.

```typescript
export const Logs = table(
  "public",
  "logs",
  {
    id: pk(),
    timestamp: timestamp({ notNull }),
    message: text({ notNull }),
  },
  {
    indexes: (t) => [index([t.timestamp]).using("brin")],
  },
);
```

**Use Cases:**

- Very large tables (millions/billions of rows)
- Naturally ordered/clustered data (timestamps, sequences)
- Time-series data
- Append-only tables

:::tip
BRIN indexes are extremely small compared to B-Tree but only efficient when data is naturally ordered.
:::

### Vector Indexes (pgvector)

For AI/ML applications using vector embeddings, Durcno supports pgvector index types.

#### HNSW Index

Hierarchical Navigable Small World index for approximate nearest neighbor search.

```typescript
export const Embeddings = table(
  "public",
  "embeddings",
  {
    id: pk(),
    embedding: text({ notNull }), // vector(1536) in PostgreSQL
    content: text({ notNull }),
  },
  {
    indexes: (t) => [index([t.embedding]).using("hnsw")],
  },
);
```

**Use Cases:**

- High-dimensional vector similarity search
- Semantic search
- RAG (Retrieval-Augmented Generation) applications
- Better recall than IVFFlat

#### IVFFlat Index

Inverted File Flat index for approximate nearest neighbor search.

```typescript
export const Documents = table(
  "public",
  "documents",
  {
    id: pk(),
    embedding: text({ notNull }), // vector column
    title: varchar({ length: 255, notNull }),
  },
  {
    indexes: (t) => [index([t.embedding]).using("ivfflat")],
  },
);
```

**Use Cases:**

- Vector similarity search
- Faster build time than HNSW
- Lower memory usage than HNSW
- Good for large datasets with acceptable recall trade-offs

:::note pgvector Extension
Vector indexes require the pgvector extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

:::

## Unique Indexes

Create unique indexes to enforce uniqueness constraints across one or more columns.

```typescript
import { uniqueIndex } from "durcno";

export const Users = table(
  "public",
  "users",
  {
    id: pk(),
    email: varchar({ length: 255, notNull }),
    username: varchar({ length: 50, notNull }),
  },
  {
    indexes: (t) => [uniqueIndex([t.email]), uniqueIndex([t.username])],
  },
);
```

### Composite Unique Index

```typescript
export const UserProfiles = table(
  "public",
  "user_profiles",
  {
    id: pk(),
    userId: bigint({ notNull }),
    platform: varchar({ length: 50, notNull }),
    handle: varchar({ length: 100, notNull }),
  },
  {
    indexes: (t) => [
      // Ensure one profile per user per platform
      uniqueIndex([t.userId, t.platform]),
    ],
  },
);
```

## Index Naming

Durcno automatically generates index names based on the table and column names:

```typescript
// Table: users
// Columns: username, email
// Generated index names:
// - users_username_index
// - users_email_index
// - users_username_email_index (for composite)
```

## Best Practices

### Index the Right Columns

Index columns that are frequently used in:

- `WHERE` clauses
- `JOIN` conditions
- `ORDER BY` clauses
- `GROUP BY` clauses

```typescript
export const Posts = table(
  "public",
  "posts",
  {
    id: pk(),
    userId: bigint({ notNull }),
    status: varchar({ length: 20, notNull }),
    createdAt: timestamp({ notNull }),
  },
  {
    indexes: (t) => [
      index([t.userId]), // Frequently queried
      index([t.status]), // Used in WHERE clauses
      index([t.createdAt]), // Used for sorting
    ],
  },
);
```

### Use Composite Indexes Wisely

Order matters in composite indexes. Put the most selective column first:

```typescript
export const Orders = table(
  "public",
  "orders",
  {
    id: pk(),
    userId: bigint({ notNull }),
    status: varchar({ length: 20, notNull }),
    createdAt: timestamp({ notNull }),
  },
  {
    indexes: (t) => [
      // Good: userId is more selective than status
      index([t.userId, t.status]),

      // Good: Can be used for queries filtering by userId only
      // or by userId and createdAt together
      index([t.userId, t.createdAt]),
    ],
  },
);
```

:::tip Left-Prefix Rule
A composite index on `[A, B, C]` can be used for queries on:

- `A`
- `A, B`
- `A, B, C`

But NOT for queries on `B`, `C`, or `B, C` alone.
:::

### Avoid Over-Indexing

Every index has a cost:

- Slows down `INSERT`, `UPDATE`, and `DELETE` operations
- Consumes disk space
- Requires maintenance

Only create indexes that provide clear performance benefits:

```typescript
// ❌ Too many indexes
export const Users = table(
  "public",
  "users",
  {
    id: pk(),
    username: varchar({ length: 50, notNull }),
    email: varchar({ length: 255, notNull }),
    firstName: varchar({ length: 100 }),
    lastName: varchar({ length: 100 }),
  },
  {
    indexes: (t) => [
      index([t.username]),
      index([t.email]),
      index([t.firstName]), // Probably not needed
      index([t.lastName]), // Probably not needed
      index([t.firstName, t.lastName]), // Redundant if rarely queried
    ],
  },
);

// ✅ Only necessary indexes
export const Users = table(
  "public",
  "users",
  {
    id: pk(),
    username: varchar({ length: 50, notNull }),
    email: varchar({ length: 255, notNull }),
    firstName: varchar({ length: 100 }),
    lastName: varchar({ length: 100 }),
  },
  {
    indexes: (t) => [index([t.username]), index([t.email])],
  },
);
```

### Choose the Right Index Type

Different query patterns need different index types:

```typescript
export const Articles = table(
  "public",
  "articles",
  {
    id: pk(),
    title: varchar({ length: 255, notNull }),
    content: text({ notNull }),
    tags: text({ notNull }), // Array
    publishedAt: timestamp({}),
    views: integer().default(0),
  },
  {
    indexes: (t) => [
      index([t.title]).using("btree"), // Text searching with prefix
      index([t.tags]).using("gin"), // Array containment
      index([t.publishedAt]).using("btree"), // Range queries, sorting
      index([t.views]).using("btree"), // Range queries
    ],
  },
);
```

### Consider Partial Indexes

For filtering specific subsets of data, consider partial indexes (future Durcno feature):

```sql
-- Currently requires manual SQL
CREATE INDEX active_users_idx ON "public"."users" ("email") WHERE "is_active" = true;
```

### Monitor Index Usage

Regularly check which indexes are being used:

```sql
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;
```

Indexes with low `idx_scan` values are rarely used and may be candidates for removal.

## Common Index Patterns

### User Lookup

```typescript
export const Users = table(
  "public",
  "users",
  {
    id: pk(),
    email: varchar({ length: 255, notNull }),
    username: varchar({ length: 50, notNull }),
  },
  {
    indexes: (t) => [uniqueIndex([t.email]), uniqueIndex([t.username])],
  },
);
```

### Foreign Key Relationships

```typescript
export const Posts = table(
  "public",
  "posts",
  {
    id: pk(),
    userId: bigint({ notNull }).references(() => Users.id),
    categoryId: bigint({ notNull }),
  },
  {
    indexes: (t) => [
      index([t.userId]), // Speed up joins and lookups
      index([t.categoryId]), // Speed up category filtering
    ],
  },
);
```

### Time-Series Data

```typescript
export const Events = table(
  "public",
  "events",
  {
    id: pk(),
    userId: bigint({ notNull }),
    eventType: varchar({ length: 50, notNull }),
    timestamp: timestamp({ notNull }),
  },
  {
    indexes: (t) => [
      index([t.userId, t.timestamp]), // User's events over time
      index([t.eventType, t.timestamp]), // Event type over time
      index([t.timestamp]).using("brin"), // If table is very large
    ],
  },
);
```

### Full-Text Search

```typescript
export const Articles = table(
  "public",
  "articles",
  {
    id: pk(),
    title: varchar({ length: 255, notNull }),
    content: text({ notNull }),
    searchVector: text({ notNull }), // tsvector column
  },
  {
    indexes: (t) => [index([t.searchVector], "gin")],
  },
);
```

### Geospatial Queries

```typescript
export const Locations = table(
  "public",
  "locations",
  {
    id: pk(),
    name: varchar({ length: 255, notNull }),
    coordinates: geography.point({ notNull }),
  },
  {
    indexes: (t) => [index([t.coordinates], "gist")],
  },
);
```

## Performance Tips

### Analyze Query Plans

Use `EXPLAIN ANALYZE` to understand if your indexes are being used:

```sql
EXPLAIN ANALYZE SELECT * FROM "public"."users" WHERE "email" = 'user@example.com';
```

### Update Statistics

Keep table statistics up-to-date for better query planning:

```sql
ANALYZE "public"."users";
```

### Rebuild Indexes

Periodically rebuild indexes to reduce bloat:

```sql
REINDEX TABLE "public"."users";
```

## Next Steps

- Learn about [Columns](./columns.md) to define your table structure
- Explore [Relations](./relations.md) to work with table relationships