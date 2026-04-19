import { PGlite } from "@electric-sql/pglite";

import { $Client, $Pool, Connector } from "./common";

/**
 * Connector implementation for the `@electric-sql/pglite` library.
 *
 * PGlite is a lightweight, embeddable PostgreSQL implementation that runs
 * entirely in-process using WASM. Perfect for local development, testing,
 * and edge computing scenarios.
 *
 * @see https://pglite.dev/
 * @see https://www.npmjs.com/package/@electric-sql/pglite
 */
export class PgLiteConnector extends Connector {
  getClient() {
    return new PgLiteClient(this.url);
  }
  getPool() {
    return new PgLitePool(this.url, this.config.pool);
  }
}

/**
 * Single-instance client wrapper for PGlite.
 *
 * Since PGlite runs in-process, this creates a single PGlite instance.
 * Connection is established automatically during initialization.
 *
 * @internal
 */
class PgLiteClient extends $Client {
  #client: PGlite;
  constructor(connectionString: string) {
    super();
    this.#client = new PGlite(connectionString);
    this.query = this.#client.query.bind(this.#client);
  }

  async connect(): Promise<void> {}
  getRows(response: any): any[] {
    return response.rows;
  }
  async close(): Promise<void> {
    await this.#client.close();
  }
}

/**
 * Pool-like wrapper for PGlite.
 *
 * Since PGlite runs in-process, pooling is not applicable in the traditional
 * sense. This class provides API compatibility with other connectors while
 * using a single PGlite instance internally.
 *
 * @internal
 */
class PgLitePool extends $Pool {
  #pool: PGlite;
  constructor(connectionString: string, pool?: { max?: number }) {
    super();
    this.#pool = new PGlite(connectionString);
    this.query = this.#pool.query.bind(this.#pool);
  }
  async connect(): Promise<void> {}
  getRows(response: any): any[] {
    return response.rows;
  }
  async close(): Promise<void> {
    await this.#pool.close();
  }
  async acquireClient(): Promise<$Client> {
    return new PgLitePoolClient(this.#pool);
  }
}

/**
 * Client wrapper for a connection acquired from a PGlite Pool.
 *
 * Since PGlite runs in-process, this wraps the shared PGlite instance.
 * The close() method is a no-op to avoid closing the shared instance.
 *
 * @internal
 */
class PgLitePoolClient extends $Client {
  #client: PGlite;
  constructor(client: PGlite) {
    super();
    this.#client = client;
    this.query = this.#client.query.bind(this.#client);
  }

  async connect(): Promise<void> {}
  getRows(response: any): any[] {
    return response.rows;
  }
  async close(): Promise<void> {
    // No-op: Don't close the shared PGlite instance
  }
}
