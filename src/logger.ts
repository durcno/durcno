import { createLogger, format, transports } from "winston";

const { combine, label, timestamp, printf } = format;

/**
 * Minimal logger interface compatible with Winston's Logger.
 *
 * Any object satisfying this contract can be used as a Durcno query logger.
 */
export interface DurcnoLogger {
  info(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Custom Winston printf format for Durcno query logging.
 *
 * Reads `sql` and `arguments` from the info object metadata
 * and renders them in a box-drawing style.
 */
const durcnoFormat = printf(
  ({ level, message, label, timestamp, sql, arguments: args, durationMs }) => {
    if (!sql) {
      return `${timestamp} [${label}] ${String(level).toUpperCase()}: ${message}`;
    }

    const lines: string[] = [];
    lines.push(
      `${timestamp} [${label}] ${String(level).toUpperCase()}: ${message}`,
    );
    lines.push("  ┌ SQL");
    for (const line of String(sql).split("\n")) {
      lines.push(`  │ ${line}`);
    }
    if (Array.isArray(args) && args.length > 0) {
      lines.push("  ├ Arguments");
      for (let i = 0; i < args.length; i++) {
        const val = args[i] === null ? "NULL" : JSON.stringify(args[i]);
        lines.push(`  │ $${i + 1} = ${val}`);
      }
    }
    if (durationMs !== undefined) {
      lines.push(`  ├ Duration`);
      lines.push(`  │ ${Number(durationMs).toFixed(2)}ms`);
    }
    lines.push("  └");
    return lines.join("\n");
  },
);

/**
 * Creates a pre-configured Winston logger for Durcno query logging.
 *
 * Uses a `[durcno]` label, ISO timestamp, and a box-drawing format
 * that renders SQL and arguments in a readable style.
 *
 * @example
 * ```ts
 * import { createQueryLogger } from "durcno/logger";
 * import { defineConfig } from "durcno";
 * import { pg } from "durcno/connectors/pg";
 *
 * export default defineConfig(pg(), {
 *   schema: "db/schema.ts",
 *   out: "migrations",
 *   dbCredentials: { url: process.env.DATABASE_URL! },
 *   logger: createQueryLogger(),
 * });
 * ```
 */
export function createQueryLogger(): DurcnoLogger {
  return createLogger({
    format: combine(label({ label: "durcno" }), timestamp(), durcnoFormat),
    transports: [new transports.Console()],
  });
}

/**
 * @deprecated Use `createQueryLogger` instead.
 */
export const createDurcnoLogger = createQueryLogger;
