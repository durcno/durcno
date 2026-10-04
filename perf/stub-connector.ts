import type { Config } from "durcno";

/**
 * A stub pool for benchmarks that must not talk to a database. Typed
 * structurally rather than by subclassing, because `Connector` and `$Pool` are
 * exported as types only and `database()` calls `config.connector.getPool()`
 * eagerly — without an `is()` check — so a structurally-compatible object is
 * enough.
 *
 * @param rows - Rows every `query()` resolves with. Omit it for benchmarks
 *   that only build SQL; any attempt to execute then throws, which turns a
 *   silent mistake into a loud one.
 * @returns A stub connector to pass to `defineConfig`.
 */
export function createStubConnector(rows?: unknown[]): Config["connector"] {
  const query = (): Promise<unknown> => {
    if (rows === undefined) {
      return Promise.reject(
        new Error("this benchmark builds SQL and must never execute a query"),
      );
    }
    return Promise.resolve(rows);
  };

  const pool = {
    options: {
      dbCredentials: { url: "postgres://bench:bench@127.0.0.1:5432/bench" },
    },
    query,
    execStrArgs: query,
    execQuery: query,
    connect: (): Promise<void> => Promise.resolve(),
    getRows: (response: unknown) => response,
    close: (): Promise<void> => Promise.resolve(),
    acquireClient: (): Promise<never> =>
      Promise.reject(new Error("not used by these benchmarks")),
  };

  return {
    options: {
      dbCredentials: { url: "postgres://bench:bench@127.0.0.1:5432/bench" },
    },
    getPool: () => pool,
    getClient: () => {
      throw new Error("not used by these benchmarks");
    },
  } as Config["connector"];
}
