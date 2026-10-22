import chalk from "chalk";

import type { $Client } from "../connectors/common";

const { bold, cyan, gray, green } = chalk;

const MUTATION_KEYWORDS = new Set([
  "ALTER",
  "ANALYZE",
  "BEGIN",
  "CALL",
  "COMMENT",
  "COMMIT",
  "COPY",
  "CREATE",
  "DELETE",
  "DO",
  "DROP",
  "GRANT",
  "INSERT",
  "REFRESH",
  "RESET",
  "REVOKE",
  "ROLLBACK",
  "SET",
  "START",
  "TRUNCATE",
  "UPDATE",
  "VACUUM",
]);

/** Result of executing a single SQL statement. */
export type SqlStatementResult = {
  rows: Record<string, unknown>[];
  durationMs: number;
};

/** Rows returned by a data-returning meta command. */
export type MetaRowsResult = {
  kind: "rows";
  title: string;
  rows: Record<string, unknown>[];
  formatRow: (row: Record<string, unknown>) => string;
};

export type MetaCommandResult =
  | MetaRowsResult
  | { kind: "help" }
  | { kind: "clear" }
  | { kind: "unknown"; command: string };

/** Executes a SQL statement and normalizes its rows across connectors. */
export async function runSqlStatement(
  client: $Client,
  sql: string,
): Promise<SqlStatementResult> {
  const start = performance.now();
  const response = await client.query(sql);
  return {
    rows: client.getRows(response) as Record<string, unknown>[],
    durationMs: performance.now() - start,
  };
}

/** Prints a statement result using the interactive REPL's table format. */
export function printQueryResult(
  sql: string,
  result: SqlStatementResult,
  quiet = false,
): void {
  const duration = result.durationMs.toFixed(2);

  if (result.rows.length === 0) {
    if (quiet) return;
    console.log(
      isMutation(sql)
        ? green(`✔ Query executed successfully (${duration}ms)\n`)
        : gray(`(0 rows) (${duration}ms)\n`),
    );
    return;
  }

  printTable(result.rows);
  if (!quiet) {
    console.log(
      gray(
        `\n(${result.rows.length} row${result.rows.length === 1 ? "" : "s"}) (${duration}ms)\n`,
      ),
    );
  }
}

/** Runs a psql-style meta command and returns its normalized data. */
export async function runMetaCommand(
  client: $Client,
  command: string,
): Promise<MetaCommandResult> {
  switch (command.trim().toLowerCase()) {
    case "\\dt":
    case "\\d": {
      const rows = await queryRows(
        client,
        `
        SELECT table_schema, table_name
        FROM information_schema.tables
        WHERE (table_schema != 'pg_catalog') AND (table_schema != 'information_schema')
        ORDER BY table_schema, table_name;
      `,
      );
      return {
        kind: "rows",
        title: "Tables:",
        rows,
        formatRow: (row) => `${row.table_schema}.${row.table_name}`,
      };
    }

    case "\\dn": {
      const rows = await queryRows(
        client,
        `
        SELECT schema_name
        FROM information_schema.schemata
        ORDER BY schema_name;
      `,
      );
      return {
        kind: "rows",
        title: "Schemas:",
        rows,
        formatRow: (row) => String(row.schema_name),
      };
    }

    case "\\du": {
      const rows = await queryRows(
        client,
        `SELECT rolname FROM pg_roles ORDER BY rolname;`,
      );
      return {
        kind: "rows",
        title: "Roles:",
        rows,
        formatRow: (row) => String(row.rolname),
      };
    }

    case "\\?":
    case "\\help":
      return { kind: "help" };

    case "\\clear":
      return { kind: "clear" };

    default:
      return { kind: "unknown", command };
  }
}

/** Prints rows returned by a meta command in the interactive REPL's style. */
export function printMetaRows(result: MetaRowsResult): void {
  console.log(bold(`\n${result.title}`));
  for (const row of result.rows) {
    console.log(`  ${cyan("•")} ${result.formatRow(row)}`);
  }
  console.log();
}

/** Help text for the interactive meta commands. */
export function getMetaHelp(): string {
  return [
    "",
    bold("Meta Commands:"),
    `${cyan("  \\dt, \\d")}${gray("  - List tables")}`,
    `${cyan("  \\dn")}${gray("      - List schemas")}`,
    `${cyan("  \\du")}${gray("      - List roles")}`,
    `${cyan("  \\?, \\help")}${gray(" - Show this help")}`,
    `${cyan("  \\clear")}${gray("   - Clear screen")}`,
    "",
    bold("Tips:"),
    gray("  • End queries with ; to execute"),
    gray("  • Multi-line input is supported"),
    gray('  • Type "exit" or "quit" to close'),
    "",
  ].join("\n");
}

/** Serializes rows for machine consumption, keeping 64-bit integers intact. */
export function rowsToJson(rows: Record<string, unknown>[]): string {
  return JSON.stringify(rows, (_key, value: unknown) => {
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Uint8Array) return `\\x${toHex(value)}`;
    return value;
  });
}

/** Normalizes any thrown value to a readable message. */
export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Prints query results as a formatted table. */
export function printTable(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);

  const widths: Record<string, number> = {};
  for (const col of columns) {
    widths[col] = col.length;
  }

  for (const row of rows) {
    for (const col of columns) {
      const value = formatValue(row[col]);
      widths[col] = Math.max(widths[col], value.length);
    }
  }

  for (const col of columns) {
    widths[col] = Math.min(widths[col], 40);
  }

  const headerRow = columns.map((col) => col.padEnd(widths[col])).join(" | ");
  const separator = columns.map((col) => "-".repeat(widths[col])).join("-+-");

  console.log();
  console.log(bold(headerRow));
  console.log(separator);

  for (const row of rows) {
    const rowStr = columns
      .map((col) => {
        const value = formatValue(row[col]);
        const truncated =
          value.length > widths[col]
            ? `${value.slice(0, widths[col] - 1)}…`
            : value;
        return truncated.padEnd(widths[col]);
      })
      .join(" | ");
    console.log(rowStr);
  }
}

function formatValue(value: unknown): string {
  if (value === null) return gray("NULL");
  if (value === undefined) return gray("undefined");
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `\\x${toHex(value)}`;
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString();
    return JSON.stringify(value);
  }
  return String(value);
}

function toHex(value: Uint8Array): string {
  let hex = "";
  for (const byte of value) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

function isMutation(sql: string): boolean {
  const keyword = /^\s*([A-Za-z]+)/.exec(sql)?.[1]?.toUpperCase();
  return keyword !== undefined && MUTATION_KEYWORDS.has(keyword);
}

async function queryRows(
  client: $Client,
  sql: string,
): Promise<Record<string, unknown>[]> {
  const response = await client.query(sql);
  return client.getRows(response) as Record<string, unknown>[];
}
