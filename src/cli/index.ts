#!/usr/bin/env node
import { program } from "commander";
import { down } from "./commands/down";
import { type ExecOptions, exec } from "./commands/exec";
import { type GenerateOptions, generate } from "./commands/generate";
import { init } from "./commands/init";
import { migrate } from "./commands/migrate";
import { push } from "./commands/push";
import { repl } from "./commands/repl";
import { squash } from "./commands/squash";
import { status } from "./commands/status";

program.version(process.env.VERSION ?? "0.0.0");

const Options = {
  config: ["--config <path>", "Path to the config file"],
} as const;

export type Options = {
  /** Path to the config file */
  config?: string;
};

function collectRename(value: string, previous: string[]): string[] {
  return [...previous, value];
}

program
  .command("init")
  .option("--force", "Overwrite existing files without prompting")
  .option("-y, --yes", "Skip all prompts and use defaults")
  .description("initialize a new Durcno project")
  .action(async (opts: { force?: boolean; yes?: boolean }) => {
    await init(opts);
  });

program
  .command("repl")
  .option(...Options.config)
  .description("open an interactive SQL REPL")
  .action(async (opts: Options) => {
    await repl(opts);
  });

program
  .command("exec")
  .option(...Options.config)
  .option("-c, --command <sql>", "execute SQL and exit")
  .option("-f, --file <path>", "execute SQL from a file and exit")
  .option("--json", "output returned rows as JSON")
  .option("-q, --quiet", "suppress banners and row summaries")
  .description("execute SQL non-interactively")
  .action(async (opts: ExecOptions) => {
    await exec(opts);
  });

program
  .command("generate")
  .alias("generat")
  .alias("gen")
  .option(...Options.config)
  .option("-y, --yes", "treat unconfirmed potential renames as drop + create")
  .option(
    "--rename-table <mapping>",
    "declare a table rename as old=new (schema defaults to public); repeatable",
    collectRename,
    [],
  )
  .option(
    "--rename-column <mapping>",
    "declare a column rename as table.old=new (schema defaults to public); repeatable",
    collectRename,
    [],
  )
  .description("generate a new migration")
  .action(async (opts: GenerateOptions) => {
    await generate(opts);
  });

program
  .command("migrate")
  .alias("migrat")
  .alias("mig")
  .option(...Options.config)
  .description("run all the unapplied migrations")
  .action(async (opts: Options) => {
    await migrate(opts);
  });

program
  .command("push")
  .option(...Options.config)
  .option("-y, --yes", "treat unconfirmed potential renames as drop + create")
  .option(
    "--rename-table <mapping>",
    "declare a table rename as old=new (schema defaults to public); repeatable",
    collectRename,
    [],
  )
  .option(
    "--rename-column <mapping>",
    "declare a column rename as table.old=new (schema defaults to public); repeatable",
    collectRename,
    [],
  )
  .description("generate migration and migrate all pending migrations")
  .action(async (opts: GenerateOptions) => {
    await push(opts);
  });

program
  .command("status")
  .alias("stat")
  .option(...Options.config)
  .description("show all migrations status")
  .action(async (opts: Options) => {
    await status(opts);
  });

program
  .command("down <migration>")
  .option(...Options.config)
  .description("down a specific migration")
  .action(async (migration, opts: Options) => {
    await down(migration, opts);
  });

program
  .command("squash <start> <end>")
  .option(...Options.config)
  .option("--force", "Squash even if custom statements exist")
  .option(
    "--skip-db",
    "Skip all database interaction (no validation, no tracking update)",
  )
  .description("squash a range of migrations into a single migration")
  .action(
    async (
      start: string,
      end: string,
      opts: Options & { force?: boolean; skipDb?: boolean },
    ) => {
      await squash(start, end, opts);
    },
  );

program.parse();
