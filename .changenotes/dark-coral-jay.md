---
bump: patch
---

# fix(cli/init): preserve .ts extension in imports

The generated `db/index.ts` now includes proper `.ts` extensions:

```ts
import * as schema from "./schema.ts";
import setup from "../durcno.config.ts";
```

So that, Node.js versions lower than 25 can properly resolve the imports.