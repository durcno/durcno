import { Client, Pool, type PoolClient } from "pg";

import { $Client, $Pool, Connector, DEFAULT_POOL_MAX } from "./common";

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
  getClient() {
    return new PgClient(this.url);
  }
  getPool() {
    return new PgPool(this.url, this.config.pool);
  }
}

/** Creates a pg (node-postgres) connector instance. */
export function pg(): PgConnector {
  return new PgConnector();
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
  constructor(connectionString: string) {
    super();
    this.#client = new Client({ connectionString });
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
  constructor(connectionString: string, pool?: { max?: number }) {
    super();
    this.#pool = new Pool({
      connectionString: connectionString,
      max: pool?.max ?? DEFAULT_POOL_MAX,
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
    return new PgPoolClient(client);
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
  constructor(client: PoolClient) {
    super();
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
