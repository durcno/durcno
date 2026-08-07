---
bump: minor
---

# feat(functions): add trunc and power mathematical functions

Added support for PostgreSQL `trunc` and `power` mathematical functions in query builder expressions.

`trunc` truncates a numeric expression to the nearest integer or optionally to a specified number of decimal places:

```typescript
import { trunc } from "durcno";

trunc(Users.price);
trunc(Users.price, 2);
```

`power` returns a numeric expression raised to the power of an exponent:

```typescript
import { power } from "durcno";

power(Users.price, 2);
```