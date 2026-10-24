import { PGlite, type PGliteOptions } from "@electric-sql/pglite";
import type { RawRow } from "../types";
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
  /**
   * PGlite executes a single statement per `query()` call, so migrations run
   * sequentially instead of as one joined script.
   */
  static override migrationOptions = {
    transaction: true,
    execution: "sequential" as const,
  };
  #driverOptions?: PGliteOptions;
  #instance?: PGlite;
  #refs = 0;

  constructor(options: ConnectorOptions, driverOptions?: PGliteOptions) {
    super(options);
    this.#driverOptions = driverOptions;
  }

  getClient() {
    const { instance, release } = this.#acquire();
    return new PgLiteClient(this.options, instance, release);
  }
  getPool() {
    const { instance, release } = this.#acquire();
    return new PgLitePool(this.options, instance, release);
  }

  /**
   * PGlite keeps a whole database in one in-process instance. Every client and
   * pool for a connector must share that instance, otherwise closing one can
   * overwrite writes made through another.
   */
  #acquire() {
    this.#instance ??= new PGlite(
      getUrlFromDbCredentials(this.options.dbCredentials),
      this.#driverOptions,
    );
    this.#refs++;
    let released = false;
    return {
      instance: this.#instance,
      release: (): Promise<void> => {
        if (released) return Promise.resolve();
        released = true;
        if (--this.#refs > 0) return Promise.resolve();
        const instance = this.#instance;
        this.#instance = undefined;
        return instance?.close() ?? Promise.resolve();
      },
    };
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
 * Single-connection client wrapper for PGlite.
 *
 * Shares the connector's PGlite instance. Connection is established
 * automatically during initialization.
 *
 * @internal
 */
class PgLiteClient extends $Client {
  #client: PGlite;
  #release: () => Promise<void>;
  #closed = false;
  constructor(
    options: ConnectorOptions,
    client: PGlite,
    release: () => Promise<void>,
  ) {
    super(options);
    this.#client = client;
    this.#release = release;
  }

  async query(
    query: string,
    args?: (string | number | null)[],
  ): Promise<unknown> {
    return this.#client.query(query, args);
  }
  async connect(): Promise<void> {
    await this.#client.waitReady;
  }
  getRows(response: unknown): RawRow[] {
    return (response as { rows: RawRow[] }).rows;
  }
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    await this.#release();
  }
}
/**
 * Pool-like wrapper for PGlite.
 *
 * Since PGlite runs in-process, pooling is not applicable in the traditional
 * sense. This class provides API compatibility with other connectors while
 * sharing the connector's PGlite instance.
 *
 * @internal
 */
class PgLitePool extends $Pool {
  #pool: PGlite;
  #release: () => Promise<void>;
  #closed = false;
  constructor(
    options: ConnectorOptions,
    pool: PGlite,
    release: () => Promise<void>,
  ) {
    super(options);
    this.#pool = pool;
    this.#release = release;
  }

  async query(
    query: string,
    args?: (string | number | null)[],
  ): Promise<unknown> {
    return this.#pool.query(query, args);
  }
  async connect(): Promise<void> {
    await this.#pool.waitReady;
  }
  getRows(response: unknown): RawRow[] {
    return (response as { rows: RawRow[] }).rows;
  }
  async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    await this.#release();
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
  }

  async query(
    query: string,
    args?: (string | number | null)[],
  ): Promise<unknown> {
    return this.#client.query(query, args);
  }
  async connect(): Promise<void> {
    await this.#client.waitReady;
  }
  getRows(response: unknown): RawRow[] {
    return (response as { rows: RawRow[] }).rows;
  }
  async close(): Promise<void> {
    // No-op: Don't close the shared PGlite instance
  }
}
