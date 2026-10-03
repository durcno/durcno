---
sidebar_position: 0
---

# Query Logger

Durcno supports query and database lifecycle logging through a configurable `logger` option. When set, successful queries call the logger's `info()` method, while failed queries and lifecycle errors (such as transaction rollbacks or connection cleanup failures) call `error()` with relevant metadata.

## Interface

Any object implementing the `QueryLogger` interface can be used:

```typescript
interface QueryLogData {
  sql: string;
  arguments?: unknown[];
  durationMs: number;
}

interface LogMetadata {
  query?: QueryLogData;
  error?: unknown;
  [key: string]: unknown;
}

interface DurcnoLogger {
  info(message: string, meta?: LogMetadata): void;
  error(message: string, meta?: LogMetadata): void;
}
```

Durcno also exports `QueryLogger` as an alias for `DurcnoLogger`.

This interface is intentionally minimal so that any logger — Winston, Pino, a custom object — can be used without additional adapters.

## Built-in Winston Logger

Durcno ships a pre-configured [Winston](https://github.com/winstonjs/winston) logger via the `durcno/logger` sub-path export. It uses a `[durcno]` label, an ISO timestamp, and a box-drawing format that renders SQL, arguments, duration, and error details in a readable style.

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
import { createLogger } from "durcno/logger";

export default defineConfig({
  schema: "db/schema.ts",
  out: "migrations",
  connector: pg({
    dbCredentials: {
      url: process.env.DATABASE_URL!,
    },
    logger: createLogger(),
  }),
});
```

> `durcno/logger` also exports `createQueryLogger` and `createDurcnoLogger` as aliases for `createLogger`.

### Output Format

Each logged event is printed in a box-drawing style:

```
2026-04-23T10:00:00.000Z [durcno] INFO: Query executed
  ┌ SQL
  │ SELECT "id", "name", "email"
  │ FROM "public"."users"
  │ WHERE "id" = $1;
  ├ Arguments
  │ $1 = 42
  ├ Duration
  │ 3.21ms
  └
```

If a query has no bound arguments the `Arguments` section is omitted. The `Duration` section shows how long the query took to execute.

When a query fails, the error details are rendered in an `Error` block:

```
2026-04-23T10:00:00.000Z [durcno] ERROR: Query failed
  ┌ SQL
  │ SELECT * FROM "users" WHERE "id" = $1;
  ├ Duration
  │ 1.50ms
  ├ Error
  │ error: relation "users" does not exist
  │     at ...
  └
```

Database lifecycle failures (such as a failed transaction rollback or connection release error) render the error without SQL:

```
2026-04-23T10:00:00.000Z [durcno] ERROR: Transaction ROLLBACK failed
  ┌ Error
  │ Error: Connection terminated unexpectedly
  │     at ...
  └
```

## Custom Logger

Pass any object with compatible `info()` and `error()` methods. The metadata object can contain:

| Key     | Type                        | Description                                                         |
| ------- | --------------------------- | ------------------------------------------------------------------- |
| `query` | `QueryLogData \| undefined` | Structured query execution details (present for query events)       |
| `error` | `unknown \| undefined`      | The caught error (for failed queries, rollbacks, or cleanup errors) |

### Query Details (`meta.query`)

When present, `meta.query` provides:

| Key          | Type                                        | Description                          |
| ------------ | ------------------------------------------- | ------------------------------------ |
| `sql`        | `string`                                    | The SQL string sent to the DB        |
| `arguments`  | `(string \| number \| null)[] \| undefined` | The bound parameter values           |
| `durationMs` | `number`                                    | Query execution time in milliseconds |

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";

export default defineConfig({
  schema: "db/schema.ts",
  connector: pg({
    dbCredentials: {
      url: process.env.DATABASE_URL!,
    },
    logger: {
      info(message, meta) {
        if (meta?.query) {
          console.log(
            `[db] ${message} in ${
              meta.query.durationMs.toFixed(2)
            }ms: ${meta.query.sql}`,
          );
        } else {
          console.log(`[db] ${message}`);
        }
      },
      error(message, meta) {
        if (meta?.query) {
          console.error(`[db] ${message}: ${meta.query.sql}`, meta.error);
        } else {
          console.error(`[db] ${message}`, meta?.error);
        }
      },
    },
  }),
});
```

### Using Pino

```javascript
import pino from "pino";

const log = pino();

export default defineConfig({
  schema: "db/schema.ts",
  connector: pg({
    dbCredentials: { url: process.env.DATABASE_URL! },
    logger: {
      info: (message, meta) => log.info(meta ?? {}, message),
      error: (message, meta) => log.error(meta ?? {}, message),
    },
  }),
});
```

## Disabling the Logger

Omit the `logger` option (or set it to `undefined`) to disable query logging entirely. No queries will be logged and there is no performance overhead.
