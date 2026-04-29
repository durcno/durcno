---
bump: major
---

# change!: rename DurcnoLogger to QueryLogger

The exported `DurcnoLogger` interface has been renamed to `QueryLogger` for clarity and consistency.

This is a **breaking change**. Any code that imports or references `DurcnoLogger` must be updated to use `QueryLogger` instead.

```javascript
// Before
import type { DurcnoLogger } from "durcno";
const logger: DurcnoLogger = { info: (msg, meta) => console.log(msg, meta) };

// After
import type { QueryLogger } from "durcno";
const logger: QueryLogger = { info: (msg, meta) => console.log(msg, meta) };
```

The rename affects the exported type from `durcno`, the `logger` option in `ConnectorOptions`, and the return type of `createQueryLogger()`.