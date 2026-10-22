import { createInterface } from "node:readline";
import chalk from "chalk";

import type { $Client } from "../../connectors/common";
import type { Options } from "..";
import { loadConfig, resolveConfigPath } from "../helpers";
import {
  formatError,
  getMetaHelp,
  printMetaRows,
  printQueryResult,
  runMetaCommand,
  runSqlStatement,
} from "../sql-runner";

const { cyan, green, red, yellow, gray, bgCyan } = chalk;

/**
 * Opens an interactive SQL REPL.
 *
 * Connects to the database using the config connector and allows
 * executing SQL queries interactively. Results are displayed in
 * a formatted table.
 */
export async function repl(options: Options): Promise<void> {
  const configPath = resolveConfigPath(options.config);
  const { connector } = await loadConfig(configPath);
  connector.options.logger = undefined;
  const client = connector.getClient();

  console.log(gray("Connecting to database..."));
  await client.connect();
  console.log(green("✔ Connected to database\n"));

  console.log(bgCyan.black.bold(" DURCNO REPL "));
  console.log(gray("Type SQL queries and press Enter to execute."));
  console.log(gray('Enter "exit" or "quit" to close the REPL.\n'));

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: cyan("durcno> "),
    historySize: 100,
  });

  let multiLineBuffer = "";
  let inMultiLine = false;

  rl.prompt();

  rl.on("line", async (input: string) => {
    const trimmed = input.trim();

    // Handle exit commands
    if (
      !inMultiLine &&
      (trimmed.toLowerCase() === "exit" || trimmed.toLowerCase() === "quit")
    ) {
      console.log(gray("\nClosing connection..."));
      await client.close();
      console.log(green("✔ Connection closed."));
      rl.close();
      return;
    }

    // Handle special commands
    if (!inMultiLine && trimmed.startsWith("\\")) {
      await handleMetaCommand(trimmed, client);
      rl.prompt();
      return;
    }

    // Handle multi-line input
    if (inMultiLine || (!trimmed.endsWith(";") && trimmed.length > 0)) {
      multiLineBuffer += (multiLineBuffer ? "\n" : "") + input;
      if (trimmed.endsWith(";")) {
        inMultiLine = false;
        await executeQuery(multiLineBuffer, client);
        multiLineBuffer = "";
      } else {
        inMultiLine = true;
        rl.setPrompt(`${yellow("... ")} `);
        rl.prompt();
        return;
      }
    } else if (trimmed.length > 0) {
      await executeQuery(trimmed, client);
    }

    rl.setPrompt(cyan("durcno> "));
    rl.prompt();
  });

  rl.on("close", () => {
    process.exit(0);
  });

  // Handle Ctrl+C gracefully
  rl.on("SIGINT", async () => {
    if (inMultiLine) {
      // Cancel multi-line input
      multiLineBuffer = "";
      inMultiLine = false;
      console.log(gray("\nQuery cancelled."));
      rl.setPrompt(cyan("durcno> "));
      rl.prompt();
    } else {
      console.log(gray("\nClosing connection..."));
      await client.close();
      console.log(green("✔ Connection closed."));
      rl.close();
    }
  });
}

/**
 * Execute a SQL query and display results.
 */
async function executeQuery(query: string, client: $Client): Promise<void> {
  try {
    const result = await runSqlStatement(client, query);
    printQueryResult(query, result);
  } catch (error) {
    console.log(`${red("ERROR: ")}${formatError(error)}\n`);
  }
}

/**
 * Handle meta commands (starting with \).
 */
async function handleMetaCommand(
  command: string,
  client: $Client,
): Promise<void> {
  try {
    const result = await runMetaCommand(client, command);
    switch (result.kind) {
      case "rows":
        printMetaRows(result);
        break;
      case "help":
        console.log(getMetaHelp());
        break;
      case "clear":
        console.clear();
        break;
      default:
        console.log(
          yellow(`Unknown command: ${command}. Type \\? for help.\n`),
        );
    }
  } catch (error) {
    console.log(`${red("ERROR: ")}${formatError(error)}\n`);
  }
}
