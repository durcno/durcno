---
bump: patch
---

# impr(cli): unquote migration options in generated files

Generated `up.ts` and `down.ts` files now use plain object keys for migration options:

```ts
export const options: MigrationOptions = {
  transaction: true,
};
```

The serializer also no longer mutates the provided options and skips `undefined` values.
