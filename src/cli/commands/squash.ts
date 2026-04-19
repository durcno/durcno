import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import chalk from "chalk";
import { createEmptySnapshot, type DDLStatement } from "durcno/migration";

import type { Options } from "..";
import { ensureMigrationsDirExists, getMigrationFolderNames } from "../checks";
import { DEFAULT_MIGRATIONS_DIR } from "../consts";
import { getSetup, resolveConfigPath } from "../helpers";
import { generateMigration } from "./generate";

const { bgGreen, bgRed, yellow, red, green, cyan, gray } = chalk;

export interface SquashOptions extends Options {
  force?: boolean;
}

export async function squash(
  start: string,
  end: string,
  options: SquashOptions,
): Promise<void> {
  const configPath = resolveConfigPath(options.config);
  const { config } = getSetup(configPath);
  const migrationsDir = resolve(
    dirname(configPath),
    config.out || DEFAULT_MIGRATIONS_DIR,
  );

  ensureMigrationsDirExists(migrationsDir);
  const migrationDirNames = getMigrationFolderNames(migrationsDir).sort();

  // Validate start and end migration names exist
  if (!migrationDirNames.includes(start)) {
    console.error(
      bgRed.white("[ERROR]") +
        " " +
        red(`Start migration ${cyan(start)} not found.`) +
        "\n  " +
        gray(`Available migrations: ${migrationDirNames.join(", ")}`),
    );
    process.exit(1);
  }
  if (!migrationDirNames.includes(end)) {
    console.error(
      bgRed.white("[ERROR]") +
        " " +
        red(`End migration ${cyan(end)} not found.`) +
        "\n  " +
        gray(`Available migrations: ${migrationDirNames.join(", ")}`),
    );
    process.exit(1);
  }

  // Validate start <= end chronologically
  const startIdx = migrationDirNames.indexOf(start);
  const endIdx = migrationDirNames.indexOf(end);
  if (startIdx > endIdx) {
    console.error(
      bgRed.white("[ERROR]") +
        " " +
        red(
          `Start migration ${cyan(start)} must come before end migration ${cyan(end)}.`,
        ),
    );
    process.exit(1);
  }

  // Partition migrations into: before, range, after
  const before = migrationDirNames.slice(0, startIdx);
  const range = migrationDirNames.slice(startIdx, endIdx + 1);
  // const after = migrationDirNames.slice(endIdx + 1); // not needed

  // Early exit if range has <= 1 migration
  if (range.length <= 1) {
    console.log(yellow("Only one migration in range. Nothing to squash."));
    process.exit(0);
  }

  // Scan for custom statements in range
  let hasCustomStatements = false;
  for (const migrationDirName of range) {
    const upPath = join(migrationsDir, migrationDirName, "up.ts");
    const upModule = require(upPath);
    const statements: DDLStatement[] = upModule.statements;
    if (statements.some((st) => st.isCustom)) {
      hasCustomStatements = true;
      break;
    }
  }

  if (hasCustomStatements && !options.force) {
    console.error(
      bgRed.white("[ERROR]") +
        " " +
        red("Custom statements detected in migration range.") +
        "\n  " +
        yellow(
          "Custom statements (ddl.custom(...)) cannot be preserved during squash.",
        ) +
        "\n  " +
        gray("Use --force to squash anyway (custom statements will be lost)."),
    );
    process.exit(1);
  }

  // Build "before" snapshot by replaying all migrations before the range
  const beforeSnapshot = createEmptySnapshot();
  for (const migrationDirName of before) {
    const upPath = join(migrationsDir, migrationDirName, "up.ts");
    const upModule = require(upPath);
    const statements: DDLStatement[] = upModule.statements;
    for (const statement of statements) {
      statement.applyToSnapshot(beforeSnapshot);
    }
  }

  // Build "after-range" snapshot by replaying before + range migrations
  const afterRangeSnapshot = createEmptySnapshot();
  for (const migrationDirName of [...before, ...range]) {
    const upPath = join(migrationsDir, migrationDirName, "up.ts");
    const upModule = require(upPath);
    const statements: DDLStatement[] = upModule.statements;
    for (const statement of statements) {
      statement.applyToSnapshot(afterRangeSnapshot);
    }
  }

  // Generate squashed migration
  const squashedUpTs = generateMigration(
    beforeSnapshot,
    afterRangeSnapshot,
    "up",
  );
  const squashedDownTs = generateMigration(
    afterRangeSnapshot,
    beforeSnapshot,
    "down",
  );

  if (squashedUpTs === null || squashedDownTs === null) {
    console.log(
      yellow("Squashed migration produces no changes. Nothing to write."),
    );
    process.exit(0);
  }

  // Delete all migration folders in range
  for (const migrationDirName of range) {
    const migrationPath = join(migrationsDir, migrationDirName);
    rmSync(migrationPath, { recursive: true, force: true });
  }

  // Write new single folder using the start migration's timestamp
  const squashedDir = join(migrationsDir, start);
  mkdirSync(squashedDir, { recursive: true });
  writeFileSync(join(squashedDir, "up.ts"), squashedUpTs);
  writeFileSync(join(squashedDir, "down.ts"), squashedDownTs);

  console.log(
    bgGreen.white.bold("[SQUASHED]") +
      " " +
      green(`${cyan(String(range.length))} migrations into ${cyan(start)}.`),
  );
  process.exit(0);
}
