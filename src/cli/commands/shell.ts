import { createInterface } from "node:readline";
import chalk from "chalk";

import type { $Client } from "../../connectors/common";
import type { Options } from "..";
import { getSetup, resolveConfigPath } from "../helpers";

const { cyan, green, red, yellow, gray, bgCyan, bold } = chalk;

/**
 * Opens an interactive SQL REPL shell.
 *
 * Connects to the database using the config connector and allows
 * executing SQL queries interactively. Results are displayed in
 * a formatted table.
 */
export async function shell(options: Options): Promise<void> {
  const configPath = resolveConfigPath(options.config);
  const { connector } = getSetup(configPath);
  const client = connector.getClient();

  console.log(gray("Connecting to database..."));
  await client.connect();
  console.log(green("✔ Connected to database\n"));

  console.log(bgCyan.black.bold(" DURCNO SHELL "));
  console.log(gray("Type SQL queries and press Enter to execute."));
  console.log(gray('Enter "exit" or "quit" to close the shell.\n'));

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
  const startTime = performance.now();

  try {
    const response = await client.query(query);
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);

    const rows = client.getRows(response);

    if (rows.length === 0) {
      // Check if it's a non-SELECT query
      const upperQuery = query.trim().toUpperCase();
      if (
        upperQuery.startsWith("INSERT") ||
        upperQuery.startsWith("UPDATE") ||
        upperQuery.startsWith("DELETE") ||
        upperQuery.startsWith("CREATE") ||
        upperQuery.startsWith("ALTER") ||
        upperQuery.startsWith("DROP") ||
        upperQuery.startsWith("TRUNCATE")
      ) {
        console.log(green(`✔ Query executed successfully (${duration}ms)\n`));
      } else {
        console.log(gray(`(0 rows) (${duration}ms)\n`));
      }
      return;
    }

    // Display results in a table format
    printTable(rows);
    console.log(
      gray(
        `\n(${rows.length} row${rows.length === 1 ? "" : "s"}) (${duration}ms)\n`,
      ),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log(`${red("ERROR: ")}${errorMessage}\n`);
  }
}

/**
 * Handle meta commands (starting with \).
 */
async function handleMetaCommand(
  command: string,
  client: $Client,
): Promise<void> {
  const cmd = command.toLowerCase();

  switch (cmd) {
    case "\\dt":
    case "\\d": {
      // List tables
      const query = `
        SELECT table_schema, table_name
        FROM information_schema.tables 
        WHERE (table_schema != 'pg_catalog') AND (table_schema != 'information_schema')
        ORDER BY table_schema, table_name;
      `;
      try {
        const response = await client.query(query);
        const rows = client.getRows(response);
        if (rows.length === 0) {
          console.log(gray("No tables found.\n"));
        } else {
          console.log(bold("\nTables:"));
          for (const row of rows) {
            console.log(`  ${cyan("•")} ${row.table_schema}.${row.table_name}`);
          }
          console.log();
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.log(`${red("ERROR: ")}${errorMessage}\n`);
      }
      break;
    }

    case "\\dn": {
      // List schemas
      const query = `
        SELECT schema_name 
        FROM information_schema.schemata 
        ORDER BY schema_name;
      `;
      try {
        const response = await client.query(query);
        const rows = client.getRows(response);
        console.log(bold("\nSchemas:"));
        for (const row of rows) {
          console.log(cyan("  • ") + row.schema_name);
        }
        console.log();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.log(`${red("ERROR: ")}${errorMessage}\n`);
      }
      break;
    }

    case "\\du": {
      // List users/roles
      const query = `SELECT rolname FROM pg_roles ORDER BY rolname;`;
      try {
        const response = await client.query(query);
        const rows = client.getRows(response);
        console.log(bold("\nRoles:"));
        for (const row of rows) {
          console.log(cyan("  • ") + row.rolname);
        }
        console.log();
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.log(`${red("ERROR: ")}${errorMessage}\n`);
      }
      break;
    }

    case "\\?":
    case "\\help": {
      console.log(bold("\nMeta Commands:"));
      console.log(cyan("  \\dt, \\d") + gray("  - List tables"));
      console.log(cyan("  \\dn") + gray("      - List schemas"));
      console.log(cyan("  \\du") + gray("      - List roles"));
      console.log(cyan("  \\?, \\help") + gray(" - Show this help"));
      console.log(cyan("  \\clear") + gray("   - Clear screen"));
      console.log();
      console.log(bold("Tips:"));
      console.log(gray("  • End queries with ; to execute"));
      console.log(gray("  • Multi-line input is supported"));
      console.log(gray('  • Type "exit" or "quit" to close'));
      console.log();
      break;
    }

    case "\\clear": {
      console.clear();
      break;
    }

    default: {
      console.log(yellow(`Unknown command: ${command}. Type \\? for help.\n`));
    }
  }
}

/**
 * Print query results as a formatted table.
 */
function printTable(rows: Record<string, unknown>[]): void {
  if (rows.length === 0) return;

  const columns = Object.keys(rows[0]);

  // Calculate column widths
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

  // Limit column width to 40 characters
  for (const col of columns) {
    widths[col] = Math.min(widths[col], 40);
  }

  // Print header
  const headerRow = columns.map((col) => col.padEnd(widths[col])).join(" | ");
  const separator = columns.map((col) => "-".repeat(widths[col])).join("-+-");

  console.log();
  console.log(bold(headerRow));
  console.log(separator);

  // Print rows
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

/**
 * Format a value for display.
 */
function formatValue(value: unknown): string {
  if (value === null) {
    return gray("NULL");
  }
  if (value === undefined) {
    return gray("undefined");
  }
  if (typeof value === "object") {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return JSON.stringify(value);
  }
  return String(value);
}
