---
sidebar_position: 3
---

# Connectors

Durcno supports multiple PostgreSQL drivers through connector modules. Each connector provides the same interface but uses a different underlying database driver.

## Available Connectors

| Connector    | Import Path                  | Driver                                              | Best For                                                |
| ------------ | ---------------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| **postgres** | `durcno/connectors/postgres` | [postgres.js](https://github.com/porsager/postgres) | High-performance Node.js, Deno, Bun and CloudFlare apps |
| **pg**       | `durcno/connectors/pg`       | [node-postgres](https://node-postgres.com/)         | Node.js applications                                    |
| **bun**      | `durcno/connectors/bun`      | [Bun SQL](https://bun.sh/docs/api/sql)              | Bun runtime applications                                |
| **pglite**   | `durcno/connectors/pglite`   | [@electric-sql/pglite](https://pglite.dev/)         | Embedded PostgreSQL, testing, local dev                 |

## postgres Connector

The `postgres` connector uses [postgres.js](https://github.com/porsager/postgres), a high-performance PostgreSQL client with a focus on speed and modern JavaScript features.

```bash npm2yarn
npm install postgres
```

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { PostgresConnector } from "durcno/connectors/postgres";

export default defineConfig(PostgresConnector, {
  schema: "db/schema.ts",
  out: "migrations",
  dbCredentials: {
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "password",
    database: "myapp",
  },
});
```

## pg Connector

The `pg` connector uses the popular [node-postgres](https://node-postgres.com/) (`pg`) package. This is the most widely used PostgreSQL driver for Node.js.

```bash npm2yarn
npm install pg
```

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { PgConnector } from "durcno/connectors/pg";

export default defineConfig(PgConnector, {
  schema: "db/schema.ts",
  out: "migrations",
  dbCredentials: {
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "password",
    database: "myapp",
  },
});
```

## bun Connector

The `bun` connector uses Bun's native [SQL API](https://bun.sh/docs/api/sql) for PostgreSQL connections. Use this connector when running your application with the Bun runtime.

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { BunConnector } from "durcno/connectors/bun";

export default defineConfig(BunConnector, {
  schema: "db/schema.ts",
  out: "migrations",
  dbCredentials: {
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "password",
    database: "myapp",
  },
});
```

## pglite Connector

The `pglite` connector uses [PGlite](https://pglite.dev/) from ElectricSQL, an embedded PostgreSQL implementation that runs entirely in-process. PGlite is perfect for local development, testing, and applications that need a serverless PostgreSQL experience without requiring a separate database server.

```bash npm2yarn
npm install @electric-sql/pglite
```

### In-Memory Database

For testing or temporary data, use an in-memory database:

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { PgLiteConnector } from "durcno/connectors/pglite";

export default defineConfig(PgLiteConnector, {
  schema: "db/schema.ts",
  out: "migrations",
  dbCredentials: {
    url: "memory://",
  },
});
```

### File-Based Database

For persistent local storage, specify a file path:

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { PgLiteConnector } from "durcno/connectors/pglite";

export default defineConfig(PgLiteConnector, {
  schema: "db/schema.ts",
  out: "migrations",
  dbCredentials: {
    url: "./data/myapp.db",
  },
});
```

### Use Cases for PGlite

- **Unit Testing**: Run tests with a real PostgreSQL database without external dependencies
- **Local Development**: Develop offline without needing a PostgreSQL server
- **Embedded Applications**: Build desktop or Electron apps with embedded PostgreSQL
- **Edge/Serverless**: Run PostgreSQL in edge environments or serverless functions
- **Prototyping**: Quickly prototype database schemas without setup overhead

## Configuration Options

All connectors accept the same configuration options:

```typescript
import { defineConfig } from "durcno";
import { PgConnector } from "durcno/connectors/pg";

export default defineConfig(PgConnector, {
  // Required: Path to your schema file
  schema: "db/schema.ts",

  // Optional: Output directory for migrations (default: "./migrations")
  out: "migrations",

  // Required: Database connection credentials
  dbCredentials: {
    host: "localhost",
    port: 5432, // Optional, defaults to 5432
    user: "postgres",
    password: "password",
    database: "myapp",
  },

  // Optional: Connection pool settings
  pool: {
    max: 10, // Maximum connections (default: 10)
  },
});
```

### Using a Connection URL

Instead of individual credentials, you can use a connection URL:

```typescript
import { defineConfig } from "durcno";
import { PgConnector } from "durcno/connectors/pg";

export default defineConfig(PgConnector, {
  schema: "db/schema.ts",
  out: "migrations",
  dbCredentials: {
    url: "postgresql://postgres:password@localhost:5432/myapp",
  },
});
```

### SSL Configuration

For secure connections, configure SSL:

```typescript
import { defineConfig } from "durcno";
import { PgConnector } from "durcno/connectors/pg";

export default defineConfig(PgConnector, {
  schema: "db/schema.ts",
  out: "migrations",
  dbCredentials: {
    host: "your-db-host.com",
    port: 5432,
    user: "postgres",
    password: "password",
    database: "myapp",
    ssl: "require", // or "verify-full" for strict verification
  },
});
```

SSL options:

- `true` - Enable SSL
- `"require"` - Require SSL connection
- `"allow"` - Allow SSL if available
- `"prefer"` - Prefer SSL if available
- `"verify-full"` - Require SSL with full certificate verification
- `ConnectionOptions` - Node.js TLS options object for advanced configuration

### Environment Variables

For production, use environment variables for sensitive credentials:

```typescript
import { defineConfig } from "durcno";
import { PgConnector } from "durcno/connectors/pg";

export default defineConfig(PgConnector, {
  schema: "db/schema.ts",
  out: "migrations",
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "myapp",
    ssl: process.env.DB_SSL === "true" ? "require" : undefined,
  },
});
```

## Using the Setup

After creating your configuration, use it with the `database` function:

```typescript
// db/index.ts
import { database } from "durcno";
import * as schema from "./schema";
import setup from "../durcno.config";

export const db = database(schema, setup);
```

The `db` instance is now ready for type-safe queries:

```typescript
import { db } from "./db";
import { Users } from "./db/schema";

// Execute queries
const users = await db.from(Users).select();
```

## Choosing a Connector

| Use Case                         | Recommended Connector |
| -------------------------------- | --------------------- |
| Cross-runtime applications       | `postgres`            |
| Standard Node.js application     | `pg`                  |
| Bun runtime                      | `bun`                 |
| Performance-critical application | `postgres`            |
| Maximum ecosystem compatibility  | `pg`                  |
| Modern ESM-first projects        | `postgres`            |
| Local / Offline / Embedded apps  | `pglite`              |
| Testing / Unit tests             | `pglite`              |