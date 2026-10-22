import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import chalk from "chalk";

import type { $Client, Connector } from "../../connectors/common";
import type { Options } from "..";
import { loadConfig, resolveConfigPath } from "../helpers";
import {
  formatError,
  getMetaHelp,
  type MetaCommandResult,
  printMetaRows,
  printQueryResult,
  rowsToJson,
  runMetaCommand,
  runSqlStatement,
} from "../sql-runner";
import { splitSqlScript } from "../sql-split";

const { red } = chalk;

export type ExecOptions = Options & {
  /** SQL passed with -c/--command. */
  command?: string;
  /** Path to a SQL file passed with -f/--file. */
  file?: string;
  /** Print returned rows as JSON. */
  json?: boolean;
  /** Suppress connection banners, timings, and row counts. */
  quiet?: boolean;
};

/**
 * Executes SQL without opening a REPL.
 *
 * Reads SQL from `--command`, `--file`, or stdin, then runs the statements
 * sequentially and stops at the first error.
 */
export async function exec(options: ExecOptions): Promise<void> {
  if (options.command !== undefined && options.file !== undefined) {
    fail("Use either --command or --file, not both.");
    return;
  }

  let sql: string;
  if (options.command !== undefined) {
    sql = options.command;
  } else if (options.file !== undefined) {
    try {
      sql = await readFile(resolve(process.cwd(), options.file), "utf8");
    } catch (error) {
      fail(`Cannot read ${options.file}: ${formatError(error)}`);
      return;
    }
  } else if (!process.stdin.isTTY) {
    sql = await readStdin();
  } else {
    fail("No SQL provided. Use --command, --file, or pipe SQL via stdin.");
    return;
  }

  if (sql.trim().length === 0) {
    fail("No SQL provided.");
    return;
  }

  const configPath = resolveConfigPath(options.config);
  let connector: Connector;
  try {
    ({ connector } = await loadConfig(configPath));
  } catch (error) {
    fail(`Cannot load config ${configPath}: ${formatError(error)}`);
    return;
  }
  connector.options.logger = undefined;
  const client = connector.getClient();

  try {
    await client.connect();
  } catch (error) {
    fail(formatError(error));
    return;
  }

  try {
    await runScript(client, sql, options);
  } catch (error) {
    fail(formatError(error));
  } finally {
    await client.close().catch(() => {});
  }
}

async function runScript(
  client: $Client,
  script: string,
  options: ExecOptions,
): Promise<void> {
  const rows: Record<string, unknown>[] = [];

  for (const part of splitSqlScript(script)) {
    if (part.type === "meta") {
      const result = await runMetaCommand(client, part.command);
      handleMetaResult(result, rows, options);
      continue;
    }

    const statement = await runSqlStatement(client, part.sql);
    rows.push(...statement.rows);
    if (!options.json) {
      printQueryResult(part.sql, statement, options.quiet);
    }
  }

  if (options.json) {
    console.log(rowsToJson(rows));
  }
}

function handleMetaResult(
  result: MetaCommandResult,
  rows: Record<string, unknown>[],
  options: ExecOptions,
): void {
  if (result.kind === "rows") {
    rows.push(...result.rows);
    if (!options.json) printMetaRows(result);
    return;
  }

  if (result.kind === "help") {
    if (options.json) console.error(getMetaHelp());
    else console.log(getMetaHelp());
    return;
  }

  if (result.kind === "clear") return;

  throw new Error(`Unknown command: ${result.command}. Type \\? for help.`);
}

function fail(message: string): void {
  console.error(`${red("ERROR: ")}${message}`);
  process.exitCode = 1;
}

async function readStdin(): Promise<string> {
  process.stdin.setEncoding("utf8");
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}
