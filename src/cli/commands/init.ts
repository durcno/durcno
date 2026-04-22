import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import chalk from "chalk";
import prompts from "prompts";
import { DURCNO_CONFIG_NAME } from "../consts";

const { bold, dim, magenta, green, yellow, cyan, gray } = chalk;

const RUNTIMES = ["node", "bun", "deno", "unknown"] as const;
type Runtime = (typeof RUNTIMES)[number];

const CONNECTORS = ["postgres", "pg", "bun", "pglite"] as const;
type Connector = (typeof CONNECTORS)[number];

type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

interface InitConfig {
  connector: Connector;
  connectionUrl: string;
  schemaPath: string;
  migrationsDir: string;
}

interface InitOptions {
  force?: boolean;
  yes?: boolean;
}

const DEFAULTS: InitConfig = {
  connector: "pg",
  connectionUrl: "",
  schemaPath: "db/schema.ts",
  migrationsDir: "migrations",
};

const CONNECTOR_LABELS: Record<Connector, string> = {
  pg: "pg (node-postgres)",
  postgres: "postgres (postgres.js)",
  bun: "bun (Bun SQL)",
  pglite: "pglite (WASM)",
};

const CONNECTOR_PACKAGES: Record<Connector, string[]> = {
  pg: ["pg", "@types/pg"],
  postgres: ["postgres"],
  pglite: ["@electric-sql/pglite"],
  bun: [], // Built-in
};

const CONNECTOR_FUNCTION_NAMES: Record<Connector, string> = {
  pg: "pg",
  postgres: "postgres",
  bun: "bun",
  pglite: "pglite",
};

const LOADER_PACKAGES: Record<Runtime, string[]> = {
  node: ["dotenv"],
  bun: [], // Built-in
  deno: [], // Built-in
  unknown: ["dotenv"],
};

const runtime: Runtime =
  typeof Bun !== "undefined"
    ? "bun"
    : typeof globalThis !== "undefined" && "Deno" in globalThis
      ? "deno"
      : typeof process !== "undefined" && process.versions?.node
        ? "node"
        : "unknown";

const pm: PackageManager = (() => {
  const userAgent = process.env.npm_config_user_agent ?? "";
  if (userAgent.startsWith("pnpm")) return "pnpm";
  if (userAgent.startsWith("yarn")) return "yarn";
  if (userAgent.startsWith("bun")) return "bun";
  return "npm";
})();

function generateConfigFile(config: InitConfig): string {
  const { connector, connectionUrl, schemaPath, migrationsDir } = config;
  const funcName = CONNECTOR_FUNCTION_NAMES[connector];

  const urlValue =
    connectionUrl === "" ? "process.env.DATABASE_URL!" : `"${connectionUrl}"`;
  const envLoader =
    connectionUrl === ""
      ? runtime === "bun"
        ? ""
        : runtime === "deno"
          ? `import "@std/dotenv/load";\n`
          : `import "dotenv/config";\n`
      : "";

  return `${envLoader}import { defineConfig } from "durcno";
import { ${funcName} } from "durcno/connectors/${connector}";

export default defineConfig(${funcName}(), {
  schema: "${schemaPath}",
  out: "${migrationsDir}",
  dbCredentials: {
    url: ${urlValue},
  },
});
`;
}

function generateSchemaFile(): string {
  return `import { notNull, now, pk, table, timestamp, unique, varchar } from "durcno";

export { Migrations } from "durcno";

export const Users = table("public", "users", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  email: varchar({ length: 255, notNull, unique }),
  password: varchar({ length: 255, notNull }),
  createdAt: timestamp({ notNull }).default(now()),
});
`;
}

function generateIndexFile(schemaPath: string): string {
  const schemaImport = schemaPath.replace(/^db\//, "./");
  return `import { database } from "durcno";
import * as schema from "${schemaImport}";
import setup from "../durcno.config.ts";

export const db = database(schema, setup);
`;
}

async function promptConfig(): Promise<InitConfig> {
  const response = await prompts(
    [
      {
        type: "select",
        name: "connector",
        message: "Select a database connector:",
        choices: CONNECTORS.map((value) => ({
          title: CONNECTOR_LABELS[value],
          value,
        })),
        initial: pm === "bun" ? CONNECTORS.indexOf("bun") : 0,
      },
      {
        type: (prev) => (prev === "pglite" ? null : "text"),
        name: "connectionUrl",
        message: "Connection URL/PATH (Default: process.env.DATABASE_URL!):",
        initial: "",
      },
      {
        type: "text",
        name: "schemaPath",
        message: "Schema file:",
        initial: DEFAULTS.schemaPath,
      },
      {
        type: "text",
        name: "migrationsDir",
        message: "Migrations folder:",
        initial: DEFAULTS.migrationsDir,
      },
    ],
    { onCancel },
  );

  return { ...DEFAULTS, ...response };
}

async function promptConfirmation(
  message: string,
  initial: boolean,
): Promise<boolean> {
  const response = await prompts(
    {
      type: "confirm",
      name: "any",
      message,
      initial,
    },
    { onCancel },
  );

  return response.any;
}

async function writeFiles(
  config: InitConfig,
  options: InitOptions,
): Promise<void> {
  console.log(green.bold("\n📄 Creating files ...\n"));

  const cwd = process.cwd();
  const configPath = resolve(cwd, DURCNO_CONFIG_NAME);
  const schemaPath = resolve(cwd, config.schemaPath);
  const indexPath = resolve(dirname(schemaPath), "index.ts");
  const files = [
    { path: configPath, content: () => generateConfigFile(config) },
    { path: schemaPath, content: () => generateSchemaFile() },
    { path: indexPath, content: () => generateIndexFile(config.schemaPath) },
  ];

  for (const { path, content } of files) {
    let writeFile = true;
    const relativePath = relative(cwd, path);
    if (existsSync(path) && !options.force) {
      const overwrite = await promptConfirmation(
        `Overwrite existing ${magenta.bold(relativePath)}?`,
        false,
      );
      if (!overwrite) {
        console.log(gray(`Skipping creation : ${relativePath}`));
        writeFile = false;
      }
    }

    if (writeFile) {
      if (!existsSync(dirname(path))) {
        mkdirSync(dirname(path), { recursive: true });
      }
      writeFileSync(path, content());
      console.log(bold(green("✔"), "Created", cyan(relativePath)));
    }
  }
}

export async function init(options: InitOptions): Promise<void> {
  console.log(green.bold("\n🚀 Durcno Setup\n"));

  const isInteractive =
    !options.yes && process.stdin.isTTY && process.env.CI !== "true";

  let config: InitConfig;

  if (isInteractive) {
    config = await promptConfig();
  } else {
    console.log(gray("Non-interactive mode, using defaults...\n"));
    config = DEFAULTS;
  }

  await writeFiles(config, options);

  console.log(green.bold("\n📦 Setup dependencies\n"));

  const toInstall: string[] = [];

  const toInstallDrivers: string[] = [];
  CONNECTOR_PACKAGES[config.connector].forEach((pkg) => {
    try {
      require.resolve(pkg);
    } catch (_) {
      toInstallDrivers.push(pkg);
    }
  });
  const toInstallLoaders: string[] = [];
  LOADER_PACKAGES[runtime].forEach((pkg) => {
    try {
      require.resolve(pkg);
    } catch (_) {
      toInstallLoaders.push(pkg);
    }
  });

  const installDrivers = isInteractive
    ? await promptConfirmation(
        `Install the database driver: ${toInstallDrivers.join(", ")} ?`,
        true,
      )
    : true;
  if (installDrivers) {
    toInstall.push(...toInstallDrivers);
  }
  const installLoaders = isInteractive
    ? await promptConfirmation(
        `Install the env loader: ${toInstallLoaders.join(", ")} ?`,
        true,
      )
    : true;
  if (installLoaders) {
    toInstall.push(...toInstallLoaders);
  }

  if (toInstall.length > 0) {
    console.log(cyan.bold(`\nInstalling (${toInstall.join(", ")})`));
    const installCmd = `${pm} ${pm === "npm" ? "install" : "add"}`;
    const installCmdStr = `${installCmd} ${toInstall.join(" ")}`;
    console.log(`\n${cyan(installCmdStr)}`);

    try {
      execSync(installCmdStr, { stdio: ["ignore", "ignore", "inherit"] });
      console.log(cyan.bold(`\nInstalled (${toInstall.join(", ")})`));
      // biome-ignore lint/suspicious/noExplicitAny: <>
    } catch (err: any) {
      // execSync throws an error with status/code when the command exits non-zero
      const exitCode = err.status ?? err.code ?? "unknown";
      console.log(
        yellow.bold(`\nInstallation failed with exit code ${exitCode}`),
      );
    }
  }
  console.log(green.bold("\n✨ Durcno Setuped!\n"));

  console.log(dim("Next steps:"));
  const execCmd =
    pm === "npm"
      ? "npm exec"
      : pm === "pnpm"
        ? "pnpm exec"
        : pm === "bun"
          ? "bunx"
          : pm;

  const nextSteps: string[][] = [
    ["Edit your schema in", magenta.bold(config.schemaPath)],
    ["Run", cyan.bold(`${execCmd} durcno generate`), "to create migrations"],
    ["Run", cyan.bold(`${execCmd} durcno migrate`), "to apply migrations"],
  ];
  nextSteps.forEach((step) => {
    console.log(" ", ...step);
  });
}

function onCancel() {
  console.log(gray("\nSetup cancelled."));
  process.exit(0);
}
