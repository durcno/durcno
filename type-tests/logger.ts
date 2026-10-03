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

// --- QueryLogger & DurcnoLogger type tests ---

Expect<Equal<DurcnoLogger, QueryLogger>>();

// Positive: DurcnoLogger is a valid type with an info method
type _LoggerHasInfo = DurcnoLogger["info"];
Expect<Equal<_LoggerHasInfo, (message: string, meta?: LogMetadata) => void>>();

// Positive: DurcnoLogger is a valid type with an error method
type _LoggerHasError = DurcnoLogger["error"];
Expect<Equal<_LoggerHasError, (message: string, meta?: LogMetadata) => void>>();

// Positive: LogMetadata has optional query and error properties
type _QueryMetadata = LogMetadata["query"];
Expect<Equal<_QueryMetadata, QueryLogData | undefined>>();

Expect<
  Equal<
    QueryLogData,
    {
      sql: string;
      arguments?: unknown[];
      durationMs: number;
    }
  >
>();

// Positive: ConnectorOptions accepts a logger property
const _optionsWithLogger: ConnectorOptions = {
  dbCredentials: { url: "postgres://x" },
  logger: { info: () => {}, error: () => {} },
};
void _optionsWithLogger;

// Positive: ConnectorOptions accepts undefined logger
const _optionsWithoutLogger: ConnectorOptions = {
  dbCredentials: { url: "postgres://x" },
};
void _optionsWithoutLogger;

// Positive: createLogger returns a DurcnoLogger
const _logger: DurcnoLogger = createLogger();
void _logger;

// Positive: createLogger returns a QueryLogger
const _queryLogger: QueryLogger = createLogger();
void _queryLogger;

// Positive: createQueryLogger returns a DurcnoLogger
const _legacyLogger: DurcnoLogger = createQueryLogger();
void _legacyLogger;

// Positive: createDurcnoLogger returns a DurcnoLogger
const _durcnoLogger: DurcnoLogger = createDurcnoLogger();
void _durcnoLogger;

// Positive: Winston-style info call with metadata
const _fakeLogger: DurcnoLogger = {
  info: (_msg: string, _meta?: LogMetadata) => {},
  error: (_msg: string, _meta?: LogMetadata) => {},
};
_fakeLogger.info("Query executed", {
  query: { sql: "SELECT 1", arguments: [], durationMs: 12.5 },
});
_fakeLogger.error("Query failed", {
  query: { sql: "SELECT 1", arguments: [], durationMs: 12.5 },
  error: new Error("fail"),
});
_fakeLogger.error("Transaction ROLLBACK failed", {
  error: new Error("aborted"),
});
_fakeLogger.error("Failed to release transaction connection", {
  error: "close failed",
});

// Negative: query must contain sql if provided
_fakeLogger.info("Query executed", {
  // @ts-expect-error - query requires sql
  query: { arguments: [], durationMs: 12.5 },
});

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
    logger: { info: () => {}, error: () => {} },
  }),
};
void _configWithLogger;
