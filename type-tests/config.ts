import { type Config, type ConnectorOptions, defineConfig } from "durcno";
import { PgConnector, pg } from "durcno/connectors/pg";
import { type Equal, Expect, testConnectorOptions } from "./utils";

// --- ConnectorOptions type tests ---

// Positive: url-form credentials
export const goodUrlOptions: ConnectorOptions = {
  dbCredentials: { url: "postgres://user:pass@localhost/db" },
};

// Positive: host/user/password form credentials
export const goodFullOptions: ConnectorOptions = {
  dbCredentials: {
    host: "localhost",
    user: "u",
    password: "p",
    database: "db",
  },
};

// Negative helpers
declare function acceptConnectorOptions(o: ConnectorOptions): void;

// Negative: missing required `dbCredentials`
// @ts-expect-error - `dbCredentials` is required
acceptConnectorOptions({});

// Negative: incomplete dbCredentials (host provided but missing required fields)
// @ts-expect-error - `user` and `database` required when using host form
acceptConnectorOptions({ dbCredentials: { host: "localhost" } });

// --- Config type tests ---

declare function acceptConfig(c: Config): void;

// Positive: minimal valid config with connector
export const goodConfig: Config<PgConnector> = {
  schema: "db/schema.ts",
  connector: pg(testConnectorOptions),
};

// Negative: missing required `schema`
// @ts-expect-error - `schema` is required
acceptConfig({ connector: pg(testConnectorOptions) });

// Negative: missing required `connector`
// @ts-expect-error - `connector` is required
acceptConfig({ schema: "db/schema.ts" });

// Negative: `dbCredentials` is no longer a valid Config field
acceptConfig({
  schema: "db/schema.ts",
  // @ts-expect-error - dbCredentials does not belong in Config
  dbCredentials: { url: "postgres://x" },
  connector: pg(testConnectorOptions),
});

// --- Config type tests (defineConfig return type) ---

// Positive: defineConfig with factory function returns Config with correct connector type
const _setup = defineConfig({
  schema: "db/schema.ts",
  connector: pg(testConnectorOptions),
});
type _SetupType = typeof _setup;
Expect<Equal<_SetupType, Config<PgConnector>>>();

// Positive: defineConfig with `new PgConnector()` also works
const _setupNew = defineConfig({
  schema: "db/schema.ts",
  connector: new PgConnector(testConnectorOptions),
});
type _SetupNewType = typeof _setupNew;
Expect<Equal<_SetupNewType, Config<PgConnector>>>();

// Positive: setup has connector property of the correct type
type _ConnectorType = _SetupType["connector"];
Expect<Equal<_ConnectorType, PgConnector>>();

// Positive: Config with default generic is assignable
const _genericSetup: Config = _setup;
void _genericSetup;

// Negative: cannot call defineConfig without a connector
// @ts-expect-error - `connector` is required in Config
defineConfig({ schema: "db/schema.ts" });

// Negative: connector must be a Connector instance, not a string
// @ts-expect-error - connector must be a Connector instance
defineConfig({ schema: "db/schema.ts", connector: "not-a-connector" });

// Negative: Config is not assignable to a plain Connector
declare function acceptPgConnector(c: PgConnector): void;
// @ts-expect-error - Config is not a Connector
acceptPgConnector(_setup);
