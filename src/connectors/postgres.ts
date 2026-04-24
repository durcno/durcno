import postgresLib, { type ReservedSql } from "postgres";

import {
  $Client,
  $Pool,
  Connector,
  type ConnectorOptions,
  DEFAULT_POOL_MAX,
  getUrlFromDbCredentials,
} from "./common";

/**
 * Connector implementation for the `postgres` (postgres.js) library.
 *
 * Postgres.js - The Fastest full featured PostgreSQL client for Node.js,
 * Deno, Bun and CloudFlare.
 *
 * @see https://github.com/porsager/postgres
 * @see https://www.npmjs.com/package/postgres
 */
export class PostgresConnector extends Connector {
  constructor(options: ConnectorOptions) {
    super(options);
  }

  getClient() {
    return new PostgresClient(this.options);
  }
  getPool() {
    return new PostgresPool(this.options);
  }
}

/** Creates a postgres.js connector instance. */
export function postgres(options: ConnectorOptions): PostgresConnector {
  return new PostgresConnector(options);
}

/**
 * Single-connection client wrapper for postgres.js.
 *
 * Configures postgres.js with `max: 1` to simulate single-connection behavior.
 * Connection is established lazily on first query.
 *
 * @internal
 */
class PostgresClient extends $Client {
  #sql: ReturnType<typeof postgresLib>;
  constructor(options: ConnectorOptions) {
    super(options);
    this.#sql = postgresLib(getUrlFromDbCredentials(options.dbCredentials), {
      max: 1,
    });
    this.query = this.#sql.unsafe.bind(this.#sql);
  }

  async connect(): Promise<void> {}
  getRows(response: any): any[] {
    return response;
  }
  async close(): Promise<void> {
    await this.#sql.end();
  }
}

/**
 * Connection pool wrapper for postgres.js.
 *
 * postgres.js has built-in connection pooling, so this wrapper configures
 * the pool size via the `max` option. Connections are managed automatically.
 *
 * @internal
 */
class PostgresPool extends $Pool {
  #sql: ReturnType<typeof postgresLib>;
  constructor(options: ConnectorOptions) {
    super(options);
    this.#sql = postgresLib(getUrlFromDbCredentials(options.dbCredentials), {
      max: options.pool?.max ?? DEFAULT_POOL_MAX,
    });
    this.query = this.#sql.unsafe.bind(this.#sql);
  }
  async connect(): Promise<void> {}
  getRows(response: any): any[] {
    return response;
  }
  async close(): Promise<void> {
    await this.#sql.end();
  }
  async acquireClient(): Promise<$Client> {
    const reserved = await this.#sql.reserve();
    return new PostgresPoolClient(reserved, this.options);
  }
}

/**
 * Client wrapper for a reserved connection from a postgres.js pool.
 *
 * This client uses a reserved connection that's exclusive until released.
 *
 * @internal
 */
class PostgresPoolClient extends $Client {
  #sql: ReservedSql;
  constructor(sql: ReservedSql, options: ConnectorOptions) {
    super(options);
    this.#sql = sql;
    this.query = this.#sql.unsafe.bind(this.#sql);
  }

  async connect(): Promise<void> {}
  getRows(response: any): any[] {
    return response;
  }
  async close(): Promise<void> {
    this.#sql.release();
  }
}
