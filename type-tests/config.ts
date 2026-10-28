import { type Config, type ConnectorOptions, defineConfig } from "durcno";
import { type PgConnector, pg } from "durcno/connectors/pg";
import { type Equal, Expect, testConnectorOptions } from "./utils";

// -----------------------------------------------------------------------------
// ConnectorOptions
// -----------------------------------------------------------------------------

export const goodUrlOptions: ConnectorOptions = {
  dbCredentials: { url: "postgres://user:pass@localhost/db" },
};

export const goodFullOptions: ConnectorOptions = {
  dbCredentials: {
    host: "localhost",
    user: "u",
    password: "p",
    database: "db",
  },
};

declare function acceptConnectorOptions(o: ConnectorOptions): void;

// @ts-expect-error - `dbCredentials` is required
acceptConnectorOptions({});

// @ts-expect-error - host credentials require `user` and `database`
acceptConnectorOptions({ dbCredentials: { host: "localhost" } });

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

declare function acceptConfig(c: Config): void;

export const goodConfig: Config<PgConnector> = {
  schema: "db/schema.ts",
  connector: pg(testConnectorOptions),
};

// @ts-expect-error - `schema` is required
acceptConfig({ connector: pg(testConnectorOptions) });

// @ts-expect-error - `connector` is required
acceptConfig({ schema: "db/schema.ts" });

acceptConfig({
  schema: "db/schema.ts",
  // @ts-expect-error - `dbCredentials` belongs to ConnectorOptions, not Config
  dbCredentials: { url: "postgres://x" },
  connector: pg(testConnectorOptions),
});

// -----------------------------------------------------------------------------
// defineConfig
// -----------------------------------------------------------------------------

const _setup = defineConfig({
  schema: "db/schema.ts",
  connector: pg(testConnectorOptions),
});
type SetupType = typeof _setup;
Expect<Equal<SetupType, Config<PgConnector>>>();

// Config is assignable to the default generic
const _genericSetup: Config = _setup;
void _genericSetup;

// @ts-expect-error - `connector` is required
defineConfig({ schema: "db/schema.ts" });

// @ts-expect-error - `connector` must be a Connector instance
defineConfig({ schema: "db/schema.ts", connector: "not-a-connector" });

// Config is not itself a Connector
declare function acceptPgConnector(c: PgConnector): void;
// @ts-expect-error - Config is not a Connector
acceptPgConnector(_setup);
