import type { ConnectionOptions } from "node:tls";
import type { QueryLogger } from "../logger";
import type { MigrationOptions } from "../migration/index";
import type { Query } from "../query-builders/query";

/**
 * Default maximum number of connections in the pool.
 *
 * This value is used when no explicit pool size is specified in the
 * connector configuration.
 */
export const DEFAULT_POOL_MAX = 10;

/**
 * Options passed to connector constructors containing database connection
 * credentials, pool settings, and an optional logger.
 *
 * These options were previously part of the top-level `Config` type and are
 * now scoped to the connector so that `Config` only contains schema/migration
 * settings.
 */
export type ConnectorOptions = {
  /**
   * Database connection credentials — either a connection URL or individual
   * host/user/password/database fields.
   */
  dbCredentials:
    | ({
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
      } & {})
    | {
        url: string;
      };
  /**
   * Connection pool configuration.
   */
  pool?: {
    /**
     * Maximum number of connections in the pool.
     * @default 10
     */
    max?: number;
  };
  /**
   * Optional logger instance for query logging.
   * Pass a Winston logger or any object with a compatible `info()` method.
   * When set, all executed queries will be logged at the `info` level with
   * structured `{ sql, arguments }` metadata.
   */
  logger?: QueryLogger;
};

/**
 * Derives a PostgreSQL connection URL string from `ConnectorOptions.dbCredentials`.
 *
 * Accepts either a plain `{ url }` object or an expanded
 * `{ host, port, user, password, database, ssl }` object and builds a
 * properly-encoded `postgresql://` URL.
 */
export function getUrlFromDbCredentials(
  dbCredentials: ConnectorOptions["dbCredentials"],
): string {
  if ("url" in dbCredentials) {
    return dbCredentials.url;
  }

  const { host, port, user, password, database, ssl } = dbCredentials;
  const auth =
    encodeURIComponent(user) +
    (password ? `:${encodeURIComponent(password)}` : "");
  const hostPort = port !== undefined ? `${host}:${port}` : host;
  const url = `postgresql://${auth}@${hostPort}/${encodeURIComponent(database)}`;

  const params: Record<string, string> = {};
  if (ssl !== undefined) {
    if (typeof ssl === "boolean") {
      if (ssl) params.ssl = "true";
    } else if (typeof ssl === "string") {
      params.sslmode = ssl;
    } else if (typeof ssl === "object") {
      throw new Error(
        "Cannot convert 'ssl' ConnectionOptions object into a URL. Provide dbCredentials.url or use a boolean/string ssl value (e.g. 'require').",
      );
    }
  }

  const qs = Object.keys(params).length
    ? `?${Object.entries(params)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join("&")}`
    : "";

  return `${url}${qs}`;
}

/**
 * Abstract base class for all database connectors.
 *
 * Connectors provide a unified interface for creating database clients
 * and connection pools across different PostgreSQL client libraries.
 * Each connector implementation wraps a specific library (pg, postgres.js,
 * PGlite, Bun SQL) while exposing a consistent API.
 *
 * @abstract
 */
export abstract class Connector {
  /**
   * Default migration options applied to generated migration files for this
   * connector. When set, the `generate` CLI command will use these values as
   * the `options` export in the produced `up.ts` / `down.ts` files instead of
   * the built-in defaults.
   *
   * @example
   * ```typescript
   * class MyConnector extends Connector {
   *   static override migrationOptions: MigrationOptions = {
   *     transaction: false,
   *     execution: "sequential",
   *   };
   * }
   * ```
   */
  static migrationOptions?: MigrationOptions;
  /**
   * The original options passed to the connector constructor.
   * Provides full access to `dbCredentials`, `pool`, and `logger`.
   * Note: `pool` and `logger` may be mutated on the connector instance after
   * construction (e.g. by CLI commands); use the instance fields for current values.
   */
  options: ConnectorOptions;

  constructor(options: ConnectorOptions) {
    this.options = options;
  }

  /**
   * Creates a single-connection client.
   *
   * Used by the Transaction class and CLI commands where connection
   * pooling is not required.
   *
   * @returns A client instance for executing queries.
   */
  abstract getClient(): $Client;

  /**
   * Creates a connection pool.
   *
   * Used by the Database class which handles multiple concurrent
   * database requests.
   *
   * @returns A pool instance for executing queries with connection reuse.
   */
  abstract getPool(): $Pool;
}

/**
 * Abstract base class shared by {@link $Client} and {@link $Pool}.
 *
 * Holds the common `options`, `logger`, `query`, and `execQuery` members so
 * they only need to be defined once.
 *
 * @abstract
 */
abstract class $QueryExecutor {
  /** The connector options used to create this executor. */
  options: ConnectorOptions;
  /** Optional logger instance for query logging. */
  logger?: QueryLogger;

  constructor(options: ConnectorOptions) {
    this.options = options;
    this.logger = options.logger;
  }

  /**
   * Executes a SQL query with optional parameterized arguments.
   *
   * @param query - The SQL query string to execute.
   * @param args - Optional array of parameter values for parameterized queries.
   * @returns A promise that resolves with the query result.
   */
  query!: (
    query: string,
    args?: (string | number | null)[],
  ) => Promise<unknown>;

  /**
   * Executes a {@link Query} object by forwarding its sql and arguments to {@link query}.
   * When a logger is configured, logs the SQL, arguments, and query duration after execution.
   *
   * @param q - The {@link Query} object to execute.
   * @returns A promise that resolves with the raw query result.
   */
  async execQuery(q: Query<unknown>): Promise<unknown> {
    const start = performance.now();
    const result = await this.query(q.sql, q.arguments);
    if (this.logger) {
      this.logger.info("Query", {
        sql: q.sql,
        arguments: q.arguments,
        durationMs: performance.now() - start,
      });
    }
    return result;
  }
}

/**
 * Abstract base class for single-connection database clients.
 *
 * Implementations wrap specific PostgreSQL client libraries to provide
 * a unified interface for query execution, connection management, and
 * result parsing.
 *
 * @abstract
 */
export abstract class $Client extends $QueryExecutor {
  /**
   * Establishes a connection to the database.
   *
   * @returns A promise that resolves when the connection is established.
   */
  abstract connect(): Promise<void>;

  /**
   * Extracts the rows array from a query response.
   *
   * Different client libraries return results in different formats.
   * This method normalizes the response to a standard array of rows.
   *
   * @param response - The raw query response from the underlying client.
   * @returns An array of row objects.
   */
  abstract getRows(response: any): any[];

  /**
   * Closes the database connection and releases resources.
   *
   * @returns A promise that resolves when the connection is closed.
   */
  abstract close(): Promise<void>;
}

/**
 * Abstract base class for database connection pools.
 *
 * Connection pools manage multiple reusable connections to improve
 * performance for applications with concurrent database access.
 * Implementations wrap specific PostgreSQL client libraries.
 *
 * @abstract
 */
export abstract class $Pool extends $QueryExecutor {
  /**
   * Initializes the connection pool.
   *
   * Some pool implementations establish connections lazily, so this
   * method may be a no-op in certain cases.
   *
   * @returns A promise that resolves when the pool is ready.
   */
  abstract connect(): Promise<void>;

  /**
   * Extracts the rows array from a query response.
   *
   * Different client libraries return results in different formats.
   * This method normalizes the response to a standard array of rows.
   *
   * @param response - The raw query response from the underlying client.
   * @returns An array of row objects.
   */
  abstract getRows(response: any): any[];

  /**
   * Closes all connections in the pool and releases resources.
   *
   * @returns A promise that resolves when all connections are closed.
   */
  abstract close(): Promise<void>;

  /**
   * Acquires a client connection from the pool.
   *
   * The returned client has exclusive use of a connection from the pool
   * until it is released by calling `close()`. This is useful for
   * transactions or operations that require connection affinity.
   *
   * **Important:** Always call `close()` on the returned client when done
   * to return the connection to the pool.
   *
   * @returns A promise that resolves with a client instance.
   */
  abstract acquireClient(): Promise<$Client>;
}

/**
 * Union type representing any query executor (client or pool).
 *
 * This type is used in contexts where either a single client or a
 * connection pool can be used interchangeably for query execution.
 */
export type QueryExecutor = $Client | $Pool;
