---
bump: minor
---

# feat(constraints): add column-level check constraints

Adds support for defining CHECK constraints directly on column definitions using the new `.check()` method. This allows for more intuitive constraint definitions at the column level.

## Key Changes

- **Column.check()**: New method to attach a CHECK constraint function to a column that receives the column and returns a filter or SQL expression
- **Type System Updates**: Updated filter functions (`arrayContains`, `arrayHas`, etc.) and constraint types to accept both table columns and individual columns via the new `AnyColumn` type
- **CheckExpression Enhancement**: The `CheckExpression` type now supports both `TableAnyColumn` and `AnyColumn` for greater flexibility

## Example

```typescript
export const Projects = table("public", "projects", {
  name: varchar({ length: 255 }).check((c) => gte(length(c), 5)),
  budget: integer().check((c) => gte(c, 1)),
});
```

This provides a cleaner, more declarative way to define column constraints compared to table-level constraint definitions.