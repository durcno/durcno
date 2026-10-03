import {
  createLogger as createWinstonLogger,
  format,
  transports,
} from "winston";

const { combine, label, timestamp, printf } = format;

/**
 * Structured query execution details.
 */
export type QueryLogData = {
  sql: string;
  arguments?: unknown[];
  durationMs: number;
};

/**
 * Metadata passed to {@link DurcnoLogger} methods.
 */
export type LogMetadata = {
  query?: QueryLogData;
  error?: unknown;
  [key: string]: unknown;
};

/**
 * Minimal logger interface compatible with Winston's Logger.
 *
 * Any object satisfying this contract can be used as a Durcno logger.
 */
export interface DurcnoLogger {
  info(message: string, meta?: LogMetadata): void;
  error(message: string, meta?: LogMetadata): void;
}

/**
 * Alias for {@link DurcnoLogger}.
 */
export type QueryLogger = DurcnoLogger;

/**
 * Safely converts an error value to a readable string.
 */
function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.stack || error.message;
  }
  if (typeof error === "object" && error !== null) {
    try {
      return JSON.stringify(error, null, 2);
    } catch {
      return String(error);
    }
  }
  return String(error);
}

/**
 * Formats a log entry in Durcno's box-drawing style.
 */
export function formatDurcnoLog(info: Record<string, unknown>): string {
  const {
    level,
    message,
    label,
    timestamp,
    query: rawQuery,
    sql: legacySql,
    arguments: legacyArgs,
    durationMs: legacyDurationMs,
    error,
  } = info;

  const query =
    (rawQuery as QueryLogData | undefined) ??
    (legacySql
      ? {
          sql: String(legacySql),
          arguments: legacyArgs as unknown[] | undefined,
          durationMs:
            legacyDurationMs !== undefined
              ? Number(legacyDurationMs)
              : (undefined as unknown as number),
        }
      : undefined);

  const sections: { header: string; lines: string[] }[] = [];

  if (query?.sql) {
    sections.push({
      header: "SQL",
      lines: String(query.sql).split("\n"),
    });
  }

  if (Array.isArray(query?.arguments) && query.arguments.length > 0) {
    const argLines: string[] = [];
    for (let i = 0; i < query.arguments.length; i++) {
      const val =
        query.arguments[i] === null
          ? "NULL"
          : JSON.stringify(query.arguments[i]);
      argLines.push(`$${i + 1} = ${val}`);
    }
    sections.push({
      header: "Arguments",
      lines: argLines,
    });
  }

  if (query?.durationMs !== undefined) {
    sections.push({
      header: "Duration",
      lines: [`${Number(query.durationMs).toFixed(2)}ms`],
    });
  }

  if (error !== undefined) {
    sections.push({
      header: "Error",
      lines: formatError(error).split("\n"),
    });
  }

  if (sections.length === 0) {
    return `${timestamp} [${label}] ${String(level).toUpperCase()}: ${message}`;
  }

  const lines: string[] = [
    `${timestamp} [${label}] ${String(level).toUpperCase()}: ${message}`,
  ];
  for (let s = 0; s < sections.length; s++) {
    const prefix = s === 0 ? "  ┌ " : "  ├ ";
    lines.push(`${prefix}${sections[s].header}`);
    for (const line of sections[s].lines) {
      lines.push(`  │ ${line}`);
    }
  }
  lines.push("  └");
  return lines.join("\n");
}

/**
 * Custom Winston printf format for Durcno query and lifecycle logging.
 *
 * Reads `sql`, `arguments`, `durationMs`, and `error` from the info object metadata
 * and renders them in a box-drawing style.
 */
const durcnoFormat = printf((info) => formatDurcnoLog(info));

/**
 * Creates a pre-configured Winston logger for Durcno.
 *
 * Uses a `[durcno]` label, ISO timestamp, and a box-drawing format
 * that renders SQL, arguments, duration, and error details in a readable style.
 *
 * @example
 * ```ts
 * import { defineConfig } from "durcno";
 * import { pg } from "durcno/connectors/pg";
 * import { createLogger } from "durcno/logger";
 *
 * export default defineConfig({
 *   schema: "db/schema.ts",
 *   out: "migrations",
 *   connector: pg({
 *     dbCredentials: { url: process.env.DATABASE_URL! },
 *     logger: createLogger(),
 *   }),
 * });
 * ```
 */
export function createLogger(): DurcnoLogger {
  return createWinstonLogger({
    format: combine(label({ label: "durcno" }), timestamp(), durcnoFormat),
    transports: [new transports.Console()],
  });
}

/**
 * Alias for {@link createLogger}.
 */
export const createQueryLogger = createLogger;

/**
 * Alias for {@link createLogger}.
 */
export const createDurcnoLogger = createLogger;
