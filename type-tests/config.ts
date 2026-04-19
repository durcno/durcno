import { type Config, type DurcnoSetup, defineConfig } from "durcno";
import { PgConnector } from "durcno/connectors/pg";
import { type Equal, Expect, testConfig } from "./utils";

// Positive: valid minimal config (url form)
export const goodUrlConfig: Config = {
  schema: "db/schema.ts",
  dbCredentials: { url: "postgres://user:pass@localhost/db" },
};

// Positive: valid host/user/password form
export const goodFullConfig: Config = {
  schema: "db/schema.ts",
  dbCredentials: {
    host: "localhost",
    user: "u",
    password: "p",
    database: "db",
  },
};

// Negative helpers - use a function so we check call-site argument compatibility
declare function acceptConfig(c: Config): void;

// Negative: missing required `schema`
// @ts-expect-error - `schema` is required
acceptConfig({ dbCredentials: { url: "postgres://x" } });

// Negative: incomplete dbCredentials (host provided but missing required fields)
// @ts-expect-error - `user` and `database` required when using host form
acceptConfig({ schema: "db/schema.ts", dbCredentials: { host: "localhost" } });

// --- DurcnoSetup type tests ---

// Positive: defineConfig returns DurcnoSetup with correct connector type
const _setup = defineConfig(PgConnector, testConfig);
type _SetupType = typeof _setup;
Expect<Equal<_SetupType, DurcnoSetup<PgConnector>>>();

// Positive: setup has connector property of the correct type
type _ConnectorType = _SetupType["connector"];
Expect<Equal<_ConnectorType, PgConnector>>();

// Positive: setup has config property of the correct type
type _ConfigType = _SetupType["config"];
Expect<Equal<_ConfigType, Config>>();

// Positive: DurcnoSetup with default generic is assignable
const _genericSetup: DurcnoSetup = _setup;
void _genericSetup;

// Negative: cannot call defineConfig without a valid connector class
// @ts-expect-error - first arg must be a Connector constructor
defineConfig("not-a-class", testConfig);

// Negative: cannot call defineConfig without config
// @ts-expect-error - config is required
defineConfig(PgConnector);

// Negative: DurcnoSetup is not assignable to a plain Connector
declare function acceptConnector(c: PgConnector): void;
// @ts-expect-error - DurcnoSetup is not a Connector
acceptConnector(_setup);
