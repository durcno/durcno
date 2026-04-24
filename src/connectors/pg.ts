import { Client, Pool, type PoolClient } from "pg";

import {
  $Client,
  $Pool,
  Connector,
  type ConnectorOptions,
  DEFAULT_POOL_MAX,
  getUrlFromDbCredentials,
} from "./common";

/**
 * Connector implementation for the `pg` (node-postgres) library.
 *
 * Non-blocking PostgreSQL client for Node.js. Pure JavaScript and
 * optional native libpq bindings.
 *
 * @see https://node-postgres.com/
 * @see https://www.npmjs.com/package/pg
 */
export class PgConnector extends Connector {
  constructor(options: ConnectorOptions) {
    super(options);
  }

  getClient() {
    return new PgClient(this.options);
  }
  getPool() {
    return new PgPool(this.options);
  }
}

/** Creates a pg (node-postgres) connector instance. */
export function pg(options: ConnectorOptions): PgConnector {
  return new PgConnector(options);
}

/**
 * Single-connection client wrapper for the `pg` library.
 *
 * Uses a single dedicated connection to the PostgreSQL database.
 * Best suited for CLI tools, scripts, or scenarios where connection
 * pooling is not required.
 *
 * @internal
 */
class PgClient extends $Client {
  #client: Client;
  constructor(options: ConnectorOptions) {
    super(options);
    this.#client = new Client({
      connectionString: getUrlFromDbCredentials(options.dbCredentials),
    });
    this.query = this.#client.query.bind(this.#client);
  }

  async connect(): Promise<void> {
    await this.#client.connect();
  }
  getRows(response: any): any[] {
    return response.rows;
  }
  async close(): Promise<void> {
    await this.#client.end();
  }
}

/**
 * Connection pool wrapper for the `pg` library.
 *
 * Manages a pool of reusable connections to the PostgreSQL database.
 * Recommended for web applications and services that handle multiple
 * concurrent database requests.
 *
 * @internal
 */
class PgPool extends $Pool {
  #pool: Pool;
  constructor(options: ConnectorOptions) {
    super(options);
    this.#pool = new Pool({
      connectionString: getUrlFromDbCredentials(options.dbCredentials),
      max: options.pool?.max ?? DEFAULT_POOL_MAX,
    });
    this.query = this.#pool.query.bind(this.#pool);
  }
  async connect(): Promise<void> {
    await this.#pool.connect();
  }
  getRows(response: any): any[] {
    return response.rows;
  }
  async close(): Promise<void> {
    await this.#pool.end();
  }
  async acquireClient(): Promise<$Client> {
    const client = await this.#pool.connect();
    return new PgPoolClient(client, this.options);
  }
}

/**
 * Client wrapper for a connection acquired from a pg Pool.
 *
 * This client wraps a PoolClient and releases it back to the pool
 * when closed.
 *
 * @internal
 */
class PgPoolClient extends $Client {
  #client: PoolClient;
  constructor(client: PoolClient, options: ConnectorOptions) {
    super(options);
    this.#client = client;
    this.query = this.#client.query.bind(this.#client);
  }

  async connect(): Promise<void> {}
  getRows(response: any): any[] {
    return response.rows;
  }
  async close(): Promise<void> {
    this.#client.release();
  }
}
