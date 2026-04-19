import { dirname, join, resolve } from "node:path";
import chalk from "chalk";
import { type DurcnoSetup, database, Migrations } from "durcno";

import type { $Client } from "../../connectors/common";
import type { DDLStatement, MigrationOptions } from "../../migration";
import type { Options } from "..";
import {
  ensureMigrationsDirExists as checkMigrationsDirExists,
  getMigrationFolderNames,
  migrationsTableExists,
} from "../checks";
import { DEFAULT_MIGRATIONS_DIR } from "../consts";
import { getSetup, resolveConfigPath } from "../helpers";
import { runDownMigration } from "./down";

const { bgGreen, bgYellow, dim, gray, yellow, green, cyan } = chalk;

export async function migrate(options: Options): Promise<void> {
  // normalize configuration file path so we can reuse it multiple times
  const configPath = resolveConfigPath(options.config);
  const { connector, config } = getSetup(configPath);
  config.pool = { ...config.pool, max: 1 };
  const migrationsDir = resolve(
    dirname(configPath),
    config.out || DEFAULT_MIGRATIONS_DIR,
  );

  checkMigrationsDirExists(migrationsDir);
  const migrationDirNames = getMigrationFolderNames(migrationsDir);

  const client = connector.getClient();
  await client.connect();

  const appliedMigrations: string[] = [];

  try {
    let previouslyApplied: string[] = [];
    if (await migrationsTableExists(client)) {
      const db = database({ Migrations }, { connector, config });
      const records = await db.from(Migrations).select();
      previouslyApplied = records.map((r) => r.name);
    }

    for (const migrationDirName of migrationDirNames.sort()) {
      if (!previouslyApplied.includes(migrationDirName)) {
        await runUpMigration(migrationDirName, migrationsDir, client, {
          connector,
          config,
        });
        appliedMigrations.push(migrationDirName);
      }
    }
  } catch (e) {
    console.error(e);
    if (appliedMigrations.length > 0) {
      console.log(
        "\n" +
          bgYellow.black.bold("[ROLLBACK]") +
          " " +
          yellow("Migration failed. Reverting applied migrations...") +
          "\n",
      );
      for (const migrationFolder of appliedMigrations.reverse()) {
        const isFirstMigration = migrationFolder === migrationDirNames[0];
        await runDownMigration(
          migrationFolder,
          isFirstMigration,
          migrationsDir,
          { connector, config },
          client,
        );
      }
    }
    await client.close();
    process.exit(1);
  }
  if (appliedMigrations.length === 0) {
    console.log(gray("No pending migrations. Database is up to date."));
  }
  await client.close();
  process.exit(0);
}

export async function runUpMigration(
  migrationDirName: string,
  migrationsDir: string,
  client: $Client,
  setup: DurcnoSetup,
) {
  const upPath = join(migrationsDir, migrationDirName, "up.ts");
  const migrationModule = await import(upPath);
  const statements: DDLStatement[] = migrationModule.statements;
  const options: MigrationOptions = migrationModule.options ?? {};

  // Determine if transaction should be used
  const useTransaction = options.transaction ?? true;

  if (useTransaction) {
    await client.query("BEGIN;");
  }

  try {
    if (statements.length > 0) {
      const sql = `${statements.map((st) => st.toSQL()).join(";\n")};`;
      await client.query(sql);
    }

    if (useTransaction) {
      await client.query("COMMIT;");
    }

    console.log(
      bgGreen.white.bold("[APPLIED]") +
        " " +
        green(`Migration ${cyan(migrationDirName)}`) +
        dim("."),
    );

    const db = database({ Migrations }, setup);
    await db.insert(Migrations).values({
      name: migrationDirName,
      createdAt: new Date(),
    });
    await db.close();
  } catch (e) {
    if (useTransaction) {
      await client.query("ROLLBACK;");
    }
    throw e;
  }
}
