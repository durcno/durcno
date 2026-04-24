import { PGlite, type PGliteOptions } from "@electric-sql/pglite";

import {
  $Client,
  $Pool,
  Connector,
  type ConnectorOptions,
  getUrlFromDbCredentials,
} from "./common";

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
  #driverOptions?: PGliteOptions;

  constructor(options: ConnectorOptions, driverOptions?: PGliteOptions) {
    super(options);
    this.#driverOptions = driverOptions;
  }

  getClient() {
    return new PgLiteClient(this.options, this.#driverOptions);
  }
  getPool() {
    return new PgLitePool(this.options, this.#driverOptions);
  }
}

/** Creates a PgLite connector instance, accepting connection options and optionally PGlite driver options (e.g., extensions). */
export function pglite(
  options: ConnectorOptions,
  driverOptions?: PGliteOptions,
): PgLiteConnector {
  return new PgLiteConnector(options, driverOptions);
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
  constructor(options: ConnectorOptions, driverOptions?: PGliteOptions) {
    super(options);
    this.#client = new PGlite(
      getUrlFromDbCredentials(options.dbCredentials),
      driverOptions,
    );
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
  constructor(options: ConnectorOptions, driverOptions?: PGliteOptions) {
    super(options);
    this.#pool = new PGlite(
      getUrlFromDbCredentials(options.dbCredentials),
      driverOptions,
    );
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
    return Promise.resolve(new PgLitePoolClient(this.#pool, this.options));
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
  constructor(client: PGlite, options: ConnectorOptions) {
    super(options);
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
