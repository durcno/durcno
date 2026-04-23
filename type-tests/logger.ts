import type { Config, DurcnoLogger } from "durcno";
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

// Positive: Config accepts a logger property
const _configWithLogger: Config = {
  schema: "db/schema.ts",
  dbCredentials: { url: "postgres://x" },
  logger: { info: () => {} },
};
void _configWithLogger;

// Positive: Config accepts undefined logger
const _configWithoutLogger: Config = {
  schema: "db/schema.ts",
  dbCredentials: { url: "postgres://x" },
};
void _configWithoutLogger;

// Positive: createDurcnoLogger returns a DurcnoLogger
const _logger: DurcnoLogger = createDurcnoLogger();
void _logger;

// Positive: Winston-style info call with metadata
const _fakeLogger: DurcnoLogger = {
  info: (_msg: string, _meta?: Record<string, unknown>) => {},
};
_fakeLogger.info("Query", { sql: "SELECT 1", arguments: [] });

// Negative: logger must have an info method
declare function acceptConfig(c: Config): void;
acceptConfig({
  schema: "db/schema.ts",
  dbCredentials: { url: "postgres://x" },
  // @ts-expect-error - logger must have an info method, not a plain string
  logger: "not-a-logger",
});

acceptConfig({
  schema: "db/schema.ts",
  dbCredentials: { url: "postgres://x" },
  // @ts-expect-error - logger must have an info method, not a number
  logger: 42,
});

acceptConfig({
  schema: "db/schema.ts",
  dbCredentials: { url: "postgres://x" },
  // @ts-expect-error - logger must have info, not just warn
  logger: { warn: () => {} },
});
