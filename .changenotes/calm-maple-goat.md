---
bump: major
---

# change(columns)!: introduce `array()` and `tuple()` helpers for array dimensions

The `dimension` option on column configs now requires a `Dimension` object instead of a raw tuple literal. Two helper functions are exported from `durcno` to construct these objects:

- `array()` — creates a variable-length (unbounded) dimension, equivalent to `type[]`
- `tuple(size)` — creates a fixed-length dimension of `size` elements, equivalent to `type[N]`

Both helpers return a `Dimension` instance that exposes `.array()` and `.tuple(size)` methods for chaining multi-dimensional shapes.

```typescript
// Before (no longer valid)
tags: varchar({ length: 50, dimension: [null] as const });
coordinates: integer({ dimension: [3] as const });
matrix: integer({ dimension: [null, null] as const });

// After
tags: varchar({ length: 50, dimension: array() });
coordinates: integer({ dimension: tuple(3) });
matrix: integer({ dimension: array().array() });
vectors: integer({ dimension: tuple(2).array() });
```

**Breaking change**: the `dimension` property type changed from `Readonly<[number | null, ...(number | null)[]]>` to `Dimension<readonly (number | null)[]>`. Raw tuple literals are no longer accepted.