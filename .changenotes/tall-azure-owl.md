---
bump: patch
---

# rename(logger): rename createDurcnoLogger to createQueryLogger

The `createDurcnoLogger` function has been renamed to `createQueryLogger` for clarity.

The old name is kept as a deprecated alias so existing code continues to work without changes, but it will be removed in a future major release.

```ts
// Before
import { createDurcnoLogger } from "durcno/logger";
logger: createDurcnoLogger();

// After
import { createQueryLogger } from "durcno/logger";
logger: createQueryLogger();
```