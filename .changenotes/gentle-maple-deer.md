---
bump: minor
---

# feat(columns): add real and double precision column types

Added support for PostgreSQL `real` (single precision floating-point) and `double precision` column types in the query builder.

- Includes schema generation and runtime validation logic for floating point values.
- Ensures compatibility with mathematical functions (`abs`, `round`, `sum`) using type-safe abstractions.
- Addresses a test syntax issue with exponentiation.