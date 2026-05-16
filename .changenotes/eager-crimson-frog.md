---
bump: minor
---

# fix(columns/validators): correct type inference for nullable columns in insert and update

Fixed incorrect TypeScript type inference for nullable columns across `ValTypeInsert`, `ValTypeUpdate`, and `ValTypeSelect` in `Column`, as well as the Zod insert/update schema generators.

**`ValTypeInsert`** now correctly marks nullable columns as `ValType | Sql | null | undefined` (optional with null), and `notNull` columns without a default as `ValType | Sql` (required, no null).

**`ValTypeUpdate`** now consistently returns `ValType | undefined` for `notNull` columns and `ValType | undefined | null` for nullable ones. The `UpdateBuilder.set()` method excludes `undefined` from accepted values so that partial updates remain type-safe.

**`ValTypeSelect`** logic was simplified to use `this extends ...` structural checks instead of `TConfig extends ...`, avoiding edge-cases with config-level vs runtime-resolved column traits.

**Zod schemas** (`createInsertSchema` / `createUpdateSchema`) were updated to match:

- Nullable columns → `zodSchema.nullable().optional()`
- `notNull` columns with a default or insert function → `zodSchema.optional()`
- `notNull` columns with no default → `zodSchema` (required)

Also fixed a subtle bug in array-dimension tuple schema generation where `Array(n).map(...)` was replaced with `Array.from({ length: n }, ...)` to avoid iterating over sparse arrays.