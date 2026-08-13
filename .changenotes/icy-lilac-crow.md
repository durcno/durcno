---
bump: minor
---

# feat(functions): support literals and arguments

Updated string and mathematical SQL functions to support literal values (e.g., strings, numbers) and `Arg` instances, expanding their flexibility beyond only accepting columns and other SQL functions.

```typescript
import { lower, abs, Arg } from "durcno";

// You can now pass literal values directly
lower("HELLO"); // -> lower('HELLO')
abs(-42); // -> abs(-42)

// As well as Arg instances
abs(Arg.number()); // -> abs($1)
```