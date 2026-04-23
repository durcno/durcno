---
sidebar_position: 0
---

# Query Logger

Durcno supports query logging through a configurable `logger` option. When set, every SQL query executed against the database is passed to the logger's `info()` method along with its SQL string and bound arguments.

## Interface

Any object implementing the `DurcnoLogger` interface can be used:

```typescript
interface DurcnoLogger {
  info(message: string, meta?: Record<string, unknown>): void;
}
```

This interface is intentionally minimal so that any logger — Winston, Pino, a custom object — can be used without additional adapters.

## Built-in Winston Logger

Durcno ships a pre-configured [Winston](https://github.com/winstonjs/winston) logger via the `durcno/logger` sub-path export. It uses a `[durcno]` label, an ISO timestamp, and a box-drawing format that renders the SQL and bound arguments in a readable style.

### Installation

Winston is a peer dependency. Install it alongside Durcno:

```bash npm2yarn
npm install winston
```

### Usage

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";
import { createDurcnoLogger } from "durcno/logger";

export default defineConfig(pg(), {
  schema: "db/schema.ts",
  out: "migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  logger: createDurcnoLogger(),
});
```

### Output Format

Each logged query is printed in a box-drawing style:

```
2026-04-23T10:00:00.000Z [durcno] INFO: Query
  ┌ SQL
  │ SELECT "id", "name", "email"
  │ FROM "public"."users"
  │ WHERE "id" = $1
  ├ Arguments
  │ $1 = 42
  └
```

If a query has no bound arguments the `Arguments` section is omitted.

## Custom Logger

Pass any object with a compatible `info()` method. The metadata object will always contain:

| Key         | Type                                        | Description                   |
| ----------- | ------------------------------------------- | ----------------------------- |
| `sql`       | `string`                                    | The SQL string sent to the DB |
| `arguments` | `(string \| number \| null)[] \| undefined` | The bound parameter values    |

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";

export default defineConfig(pg(), {
  schema: "db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  logger: {
    info(message, meta) {
      console.log(`[db] ${message}`, meta);
    },
  },
});
```

### Using Pino

```typescript
import pino from "pino";

const log = pino();

export default defineConfig(pg(), {
  schema: "db/schema.ts",
  dbCredentials: { url: process.env.DATABASE_URL! },
  logger: {
    info: (message, meta) => log.info(meta ?? {}, message),
  },
});
```

## Disabling the Logger

Omit the `logger` option (or set it to `undefined`) to disable query logging entirely. No queries will be logged and there is no performance overhead.