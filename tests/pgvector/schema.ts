import { index, pgvector, pk, table } from "durcno";

export { Migrations } from "durcno";

/**
 * Test table for pgvector column types: vector, halfvec, sparsevec, and bit.
 */
export const Items = table(
  "public",
  "items",
  {
    id: pk(),
    vec: pgvector.vector({ dimensions: 3 }),
    hvec: pgvector.halfvec({ dimensions: 3 }),
    svec: pgvector.sparsevec({ dimensions: 3 }),
    b: pgvector.bit({ length: 3 }),
  },
  {
    indexes: (t) => [
      index([t.vec.opclass("vector_l2_ops")]).using("hnsw"),
      index([t.hvec.opclass("halfvec_l2_ops")]).using("ivfflat"),
    ],
  },
);
