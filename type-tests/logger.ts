import type { Config, ConnectorOptions, DurcnoLogger } from "durcno";
import { pg } from "durcno/connectors/pg";
import { createDurcnoLogger } from "durcno/logger";
import { type Equal, Expect } from "./utils";

// --- DurcnoLogger type tests ---

// Positive: DurcnoLogger is a valid type with an info method
type _LoggerHasInfo = DurcnoLogger["info"];
Expect<
  Equal<
    _LoggerHasInfo,
    (message: string, meta?: Record<string, unknown>) => void
  >
>();

// Positive: ConnectorOptions accepts a logger property
const _optionsWithLogger: ConnectorOptions = {
  dbCredentials: { url: "postgres://x" },
  logger: { info: () => {} },
};
void _optionsWithLogger;

// Positive: ConnectorOptions accepts undefined logger
const _optionsWithoutLogger: ConnectorOptions = {
  dbCredentials: { url: "postgres://x" },
};
void _optionsWithoutLogger;

// Positive: createDurcnoLogger returns a DurcnoLogger
const _logger: DurcnoLogger = createDurcnoLogger();
void _logger;

// Positive: Winston-style info call with metadata
const _fakeLogger: DurcnoLogger = {
  info: (_msg: string, _meta?: Record<string, unknown>) => {},
};
_fakeLogger.info("Query", { sql: "SELECT 1", arguments: [] });

// Negative: logger must have an info method
declare function acceptConnectorOptions(o: ConnectorOptions): void;
acceptConnectorOptions({
  dbCredentials: { url: "postgres://x" },
  // @ts-expect-error - logger must have an info method, not a plain string
  logger: "not-a-logger",
});

acceptConnectorOptions({
  dbCredentials: { url: "postgres://x" },
  // @ts-expect-error - logger must have an info method, not a number
  logger: 42,
});

acceptConnectorOptions({
  dbCredentials: { url: "postgres://x" },
  // @ts-expect-error - logger must have info, not just warn
  logger: { warn: () => {} },
});

// Positive: Config accepts connector with logger
const _configWithLogger: Config = {
  schema: "db/schema.ts",
  connector: pg({
    dbCredentials: { url: "postgres://x" },
    logger: { info: () => {} },
  }),
};
void _configWithLogger;
