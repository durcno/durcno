import type {
  Config,
  ConnectorOptions,
  DurcnoLogger,
  LogMetadata,
  QueryLogData,
  QueryLogger,
} from "durcno";
import { pg } from "durcno/connectors/pg";
import {
  createDurcnoLogger,
  createLogger,
  createQueryLogger,
} from "durcno/logger";
import { type Equal, Expect } from "./utils";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

Expect<Equal<DurcnoLogger, QueryLogger>>();

type LoggerInfo = DurcnoLogger["info"];
type LoggerError = DurcnoLogger["error"];
Expect<Equal<LoggerInfo, (message: string, meta?: LogMetadata) => void>>();
Expect<Equal<LoggerError, (message: string, meta?: LogMetadata) => void>>();

type QueryMetadata = LogMetadata["query"];
Expect<Equal<QueryMetadata, QueryLogData | undefined>>();
Expect<
  Equal<
    QueryLogData,
    { sql: string; arguments?: unknown[]; durationMs: number }
  >
>();

// -----------------------------------------------------------------------------
// Factories
// -----------------------------------------------------------------------------

const _logger: DurcnoLogger = createLogger();
const _legacyLogger: DurcnoLogger = createQueryLogger();
const _durcnoLogger: DurcnoLogger = createDurcnoLogger();
void _logger;
void _legacyLogger;
void _durcnoLogger;

// -----------------------------------------------------------------------------
// Connector integration
// -----------------------------------------------------------------------------

const _optionsWithLogger: ConnectorOptions = {
  dbCredentials: { url: "postgres://x" },
  logger: { info: () => {}, error: () => {} },
};
void _optionsWithLogger;

const _optionsWithoutLogger: ConnectorOptions = {
  dbCredentials: { url: "postgres://x" },
};
void _optionsWithoutLogger;

declare function acceptConnectorOptions(o: ConnectorOptions): void;

acceptConnectorOptions({
  dbCredentials: { url: "postgres://x" },
  // @ts-expect-error - a logger is not a plain string
  logger: "not-a-logger",
});

acceptConnectorOptions({
  dbCredentials: { url: "postgres://x" },
  // @ts-expect-error - the logger must implement info
  logger: { warn: () => {} },
});

// -----------------------------------------------------------------------------
// Log calls
// -----------------------------------------------------------------------------

const fakeLogger: DurcnoLogger = {
  info: (_msg: string, _meta?: LogMetadata) => {},
  error: (_msg: string, _meta?: LogMetadata) => {},
};

fakeLogger.info("Query executed", {
  query: { sql: "SELECT 1", arguments: [], durationMs: 12.5 },
});

fakeLogger.error("Query failed", {
  query: { sql: "SELECT 1", arguments: [], durationMs: 12.5 },
  error: new Error("fail"),
});

fakeLogger.info("Query executed", {
  // @ts-expect-error - query metadata requires `sql`
  query: { arguments: [], durationMs: 12.5 },
});

// Config accepts a connector with a logger
const _configWithLogger: Config = {
  schema: "db/schema.ts",
  connector: pg({
    dbCredentials: { url: "postgres://x" },
    logger: { info: () => {}, error: () => {} },
  }),
};
void _configWithLogger;
