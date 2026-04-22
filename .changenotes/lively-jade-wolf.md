---
bump: patch
---

# refac(cli): replace require with dynamic import

Replaced all synchronous `require()` calls in the CLI with `await import()` to use native ESM dynamic imports.

`getSetup` in `src/cli/helpers.ts` is now `async`, and all CLI commands (`down`, `generate`, `shell`, `squash`, `status`) have been updated to `await` it.

Migration module loading in `generate` and `squash` commands was also migrated from `require()` to `await import()`.