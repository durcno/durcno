import { SQL } from "bun";

import { $Client, $Pool, Connector, DEFAULT_POOL_MAX } from "./common";

/**
 * Connector implementation for the Bun built-in SQL client.
 *
 * Bun provides a native, high-performance PostgreSQL client as part of
 * its runtime. This connector leverages Bun's built-in SQL API for
 * optimal performance in Bun environments.
 *
 * @see https://bun.sh/docs/api/sql
 */
export class BunConnector extends Connector {
  getClient() {
    return new BunClient(this.url);
  }
  getPool() {
    return new BunPool(this.url, this.config.pool);
  }
}

/**
 * Single-connection client wrapper for Bun's SQL API.
 *
 * Configures Bun's SQL client with `max: 1` to simulate single-connection
 * behavior. Uses Bun's native PostgreSQL protocol implementation.
 *
 * @internal
 */
class BunClient extends $Client {
  #client: SQL;
  constructor(connectionString: string) {
    super();
    this.#client = new SQL(connectionString, {
      max: 1,
    });
    this.query = this.#client.unsafe.bind(this.#client);
  }

  async connect(): Promise<void> {
    await this.#client.connect();
  }
  getRows(response: any): any[] {
    return response;
  }
  async close(): Promise<void> {
    await this.#client.end();
  }
}

/**
 * Connection pool wrapper for Bun's SQL API.
 *
 * Bun's SQL client has built-in connection pooling. This wrapper configures
 * the pool size via the `max` option for optimal concurrent query handling.
 *
 * @internal
 */
class BunPool extends $Pool {
  #pool: SQL;
  constructor(connectionString: string, pool?: { max?: number }) {
    super();
    this.#pool = new SQL(connectionString, {
      max: pool?.max ?? DEFAULT_POOL_MAX,
    });
    this.query = this.#pool.unsafe.bind(this.#pool);
  }
  async connect(): Promise<void> {
    await this.#pool.connect();
  }
  getRows(response: any): any[] {
    return response;
  }
  async close(): Promise<void> {
    await this.#pool.end();
  }
  async acquireClient(): Promise<$Client> {
    const reserved = await this.#pool.reserve();
    return new BunPoolClient(reserved);
  }
}

/**
 * Client wrapper for a reserved connection from a Bun SQL pool.
 *
 * This client uses a reserved connection that's exclusive until released.
 *
 * @internal
 */
class BunPoolClient extends $Client {
  #sql: SQL;
  constructor(sql: SQL) {
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
