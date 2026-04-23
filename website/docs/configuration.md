---
sidebar_position: 4
---

# Configuration

Durcno uses a configuration file (`durcno.config.ts`) to define your database connection, schema location, and migration settings. This page documents all available configuration options.

## Config File Location

By default, Durcno looks for `durcno.config.ts` in your project root. You can specify a custom path using the `--config` flag:

```bash npm2yarns
npm exec durcno generate --config ./config/durcno.config.ts
```

## Basic Structure

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";

export default defineConfig(pg(), {
  schema: "db/schema.ts",
  out: "migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

## Configuration Options

### `schema`

**Type:** `string`  
**Required:** Yes

The path to your database schema file, relative to the config file location.

```typescript
export default defineConfig(pg(), {
  schema: "db/schema.ts",
  // ...
});
```

### `out`

**Type:** `string`  
**Default:** `"migrations"`

The output directory where generated migration files will be stored.

```typescript
export default defineConfig(pg(), {
  schema: "db/schema.ts",
  out: "migrations",
  // ...
});
```

### `dbCredentials`

**Type:** `object`  
**Required:** Yes

Database connection credentials. Can be specified either as a URL string or as individual connection parameters.

#### URL Format

```typescript
export default defineConfig(pg(), {
  schema: "db/schema.ts",
  dbCredentials: {
    url: "postgresql://user:password@localhost:5432/database",
  },
});
```

:::tip
Use environment variables for database credentials:

```typescript
dbCredentials: {
  url: process.env.DATABASE_URL!,
}
```

:::

#### Individual Parameters

| Parameter  | Type                                     | Required | Description                          |
| ---------- | ---------------------------------------- | -------- | ------------------------------------ |
| `host`     | `string`                                 | Yes      | Database server hostname             |
| `port`     | `number`                                 | No       | Database server port (default: 5432) |
| `user`     | `string`                                 | Yes      | Database username                    |
| `password` | `string`                                 | No       | Database password                    |
| `database` | `string`                                 | Yes      | Database name                        |
| `ssl`      | `boolean \| string \| ConnectionOptions` | No       | SSL/TLS configuration                |

```typescript
export default defineConfig(pg(), {
  schema: "db/schema.ts",
  dbCredentials: {
    host: "localhost",
    port: 5432,
    user: "postgres",
    password: "password",
    database: "myapp",
  },
});
```

#### SSL Configuration

The `ssl` option supports multiple formats:

```typescript
// Disable SSL
dbCredentials: {
  host: "localhost",
  user: "postgres",
  database: "myapp",
  ssl: false,
}

// Require SSL (no certificate verification)
dbCredentials: {
  host: "db.example.com",
  user: "postgres",
  database: "myapp",
  ssl: "require",
}

// SSL with full certificate verification
dbCredentials: {
  host: "db.example.com",
  user: "postgres",
  database: "myapp",
  ssl: "verify-full",
}

// Custom SSL options (Node.js TLS ConnectionOptions)
dbCredentials: {
  host: "db.example.com",
  user: "postgres",
  database: "myapp",
  ssl: {
    rejectUnauthorized: true,
    ca: fs.readFileSync("/path/to/ca-cert.pem").toString(),
  },
}
```

**SSL Mode Values:**

| Value           | Description                                          |
| --------------- | ---------------------------------------------------- |
| `false`         | Disable SSL                                          |
| `true`          | Enable SSL                                           |
| `"require"`     | Require SSL connection (no certificate verification) |
| `"allow"`       | Try SSL first, fall back to non-SSL                  |
| `"prefer"`      | Prefer SSL, fall back to non-SSL                     |
| `"verify-full"` | Require SSL with full certificate verification       |

### `logger`

**Type:** `DurcnoLogger`  
**Optional**

A logger instance that receives every SQL query before it is sent to the database. Any object with a compatible `info()` method can be used. Durcno ships a pre-configured Winston logger via `durcno/logger`.

See [Query Logger](./Advanced/logger) for full details and examples.

```typescript
import { createDurcnoLogger } from "durcno/logger";

export default defineConfig(pg(), {
  schema: "db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  logger: createDurcnoLogger(),
});
```

### `pool`

**Type:** `object`  
**Optional**

Connection pool configuration.

| Property | Type     | Default | Description                                    |
| -------- | -------- | ------- | ---------------------------------------------- |
| `max`    | `number` | `10`    | Maximum number of connections in the `db` pool |

```typescript
export default defineConfig(pg(), {
  schema: "db/schema.ts",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  pool: {
    max: 20,
  },
});
```

## Full Example

Here's a complete configuration example with all options:

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";

export default defineConfig(pg(), {
  // Schema file location
  schema: "db/schema.ts",

  // Migration output directory
  out: "migrations",

  // Database connection
  dbCredentials: {
    host: process.env.DB_HOST ?? "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER ?? "postgres",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME ?? "myapp",
    ssl: process.env.NODE_ENV === "production" ? "require" : false,
  },

  // Connection pool settings
  pool: {
    max: 20,
  },
});
```

## Environment-Specific Configuration

You can create environment-specific configurations:

```typescript
// durcno.config.ts
import { defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";

const isDevelopment = process.env.NODE_ENV !== "production";

export default defineConfig(pg(), {
  schema: "db/schema.ts",
  out: "migrations",
  dbCredentials: isDevelopment
    ? {
        host: "localhost",
        port: 5432,
        user: "postgres",
        password: "devpassword",
        database: "myapp_dev",
      }
    : {
        url: process.env.DATABASE_URL!,
      },
  pool: {
    max: isDevelopment ? 5 : 20,
  },
});
```

## Type Reference

The full TypeScript type for the configuration object:

```typescript
type Config = {
  schema: string;
  out?: string;
  dbCredentials:
    | {
        host: string;
        port?: number;
        user: string;
        password?: string;
        database: string;
        ssl?:
          | boolean
          | "require"
          | "allow"
          | "prefer"
          | "verify-full"
          | ConnectionOptions;
      }
    | {
        url: string;
      };
  pool?: {
    max?: number;
  };
  logger?: DurcnoLogger;
};
```