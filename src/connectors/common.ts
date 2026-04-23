import { getUrlFromDbCredentials } from "../cli/helpers";
import type { Config } from "../index";
import type { DurcnoLogger } from "../logger";
import type { Query } from "../query-builders/query";

/**
 * Default maximum number of connections in the pool.
 *
 * This value is used when no explicit pool size is specified in the
 * connector configuration.
 */
export const DEFAULT_POOL_MAX = 10;

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
  /** The configuration object containing file paths, database credentials, client configs etc. */
  config!: Config;
  /** The PostgreSQL connection URL derived from the configuration. */
  url!: string;
  /** Optional logger instance for query logging. */
  logger?: DurcnoLogger;

  /** Injects the configuration and derives the connection URL. Called by `defineConfig`. */
  _init(config: Config) {
    this.config = config;
    this.url = getUrlFromDbCredentials(config.dbCredentials);
    this.logger = config.logger;
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
 * Abstract base class for single-connection database clients.
 *
 * Implementations wrap specific PostgreSQL client libraries to provide
 * a unified interface for query execution, connection management, and
 * result parsing.
 *
 * @abstract
 */
export abstract class $Client {
  /** Optional logger instance for query logging. */
  logger?: DurcnoLogger;

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
   *
   * @param q - The {@link Query} object to execute.
   * @returns A promise that resolves with the raw query result.
   */
  execQuery(q: Query<any>): Promise<unknown> {
    if (this.logger) {
      this.logger.info("Query", {
        sql: q.sql,
        arguments: q.arguments,
      });
    }
    return this.query(q.sql, q.arguments);
  }

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
export abstract class $Pool {
  /** Optional logger instance for query logging. */
  logger?: DurcnoLogger;

  /**
   * Executes a SQL query with optional parameterized arguments.
   *
   * The pool automatically acquires a connection, executes the query,
   * and returns the connection to the pool.
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
   *
   * @param q - The {@link Query} object to execute.
   * @returns A promise that resolves with the raw query result.
   */
  execQuery(q: Query<any>): Promise<unknown> {
    if (this.logger) {
      this.logger.info("Query", {
        sql: q.sql,
        arguments: q.arguments,
      });
    }
    return this.query(q.sql, q.arguments);
  }

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
