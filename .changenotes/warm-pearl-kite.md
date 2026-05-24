---
bump: minor
---

# change(pgvector): simplify vector/halfvec value type to number[]

The `vector` and `halfvec` pgvector columns no longer infer a fixed-length tuple type when `dimensions` is a numeric literal. Both columns now always return `number[]`.

Previously, providing a literal `dimensions` value would cause the TypeScript type to be inferred as a fixed-length tuple (e.g., `[number, number, number]` for `dimensions: 3`). This behavior has been removed in favor of the simpler `number[]` type.

The `zodTypeScaler` getter was also updated — instead of producing a `z.tuple(...)` schema for fixed dimensions, it now uses `z.array(z.number()).length(dimensions)`, which validates the length at runtime without requiring tuple types.