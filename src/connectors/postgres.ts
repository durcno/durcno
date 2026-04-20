import postgresLib from "postgres";

import { $Client, $Pool, Connector, DEFAULT_POOL_MAX } from "./common";

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
  getClient() {
    return new PostgresClient(this.url);
  }
  getPool() {
    return new PostgresPool(this.url, this.config.pool);
  }
}

/** Creates a postgres.js connector instance. */
export function postgres(): PostgresConnector {
  return new PostgresConnector();
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
  constructor(connectionString: string) {
    super();
    this.#sql = postgresLib(connectionString, {
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
  constructor(connectionString: string, pool?: { max?: number }) {
    super();
    this.#sql = postgresLib(connectionString, {
      max: pool?.max ?? DEFAULT_POOL_MAX,
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
    return new PostgresPoolClient(reserved);
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
  #sql: ReturnType<typeof postgresLib>;
  constructor(sql: ReturnType<typeof postgresLib>) {
    super();
    this.#sql = sql;
    this.query = this.#sql.unsafe.bind(this.#sql);
  }

  async connect(): Promise<void> {}
  getRows(response: any): any[] {
    return response;
  }
  async close(): Promise<void> {
    // @ts-expect-error - release is available on reserved connections
    this.#sql.release();
  }
}
