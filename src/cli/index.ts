#!/usr/bin/env node
import { program } from "commander";
import { down } from "./commands/down";
import { generate } from "./commands/generate";
import { init } from "./commands/init";
import { migrate } from "./commands/migrate";
import { push } from "./commands/push";
import { shell } from "./commands/shell";
import { squash } from "./commands/squash";
import { status } from "./commands/status";

program.version(process.env.VERSION ?? "1.0.0");

const Options = {
  config: ["--config <path>", "Path to the config file"],
} as const;

export type Options = {
  /** Path to the config file */
  config?: string;
};

program
  .command("init")
  .option("--force", "Overwrite existing files without prompting")
  .option("-y, --yes", "Skip all prompts and use defaults")
  .description("initialize a new Durcno project")
  .action(async (opts: { force?: boolean; yes?: boolean }) => {
    await init(opts);
  });

program
  .command("shell")
  .alias("shel")
  .option(...Options.config)
  .description("open an interactive SQL REPL shell")
  .action(async (opts: Options) => {
    await shell(opts);
  });

program
  .command("generate")
  .alias("generat")
  .alias("gen")
  .option(...Options.config)
  .description("generate a new migration")
  .action(async (opts: Options) => {
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
  .description("generate migration and migrate all pending migrations")
  .action(async (opts: Options) => {
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
  .description("squash a range of migrations into a single migration")
  .action(
    async (start: string, end: string, opts: Options & { force?: boolean }) => {
      await squash(start, end, opts);
    },
  );

program.parse();
