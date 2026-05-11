import path, { basename, dirname, join, resolve } from "node:path";
import chalk from "chalk";
import { type Config, database, eq, Migrations } from "durcno";
import type { DDLStatement, MigrationOptions } from "durcno/migration";

import type { $Client } from "../../connectors/common";
import type { Options } from "..";
import {
  ensureMigrationsDirExists,
  getMigrationFolderNames,
  migrationsTableExists,
} from "../checks";
import { DEFAULT_MIGRATIONS_DIR } from "../consts";
import { loadConfig, resolveConfigPath } from "../helpers";

const { bgGreen, dim, cyan, yellow, red } = chalk;

export async function down(m: string, options: Options): Promise<void> {
  const configPath = resolveConfigPath(options.config);
  const config = await loadConfig(configPath);
  const { connector } = config;
  const migrationsDir = resolve(
    dirname(configPath),
    config.out || DEFAULT_MIGRATIONS_DIR,
  );

  ensureMigrationsDirExists(migrationsDir);
  const migrationDirNames = getMigrationFolderNames(migrationsDir);

  const client = connector.getClient();
  await client.connect();

  if (await migrationsTableExists(client)) {
    const db = database({ Migrations }, config);
    const migrations = await db.from(Migrations).select();
    const migrationDirsReversed = migrationDirNames.sort().reverse();
    for (let i = 0; i < migrationDirsReversed.length; i++) {
      const migrationDirName = migrationDirsReversed[i];
      const migration = migrations.find(
        (migration) => migration.name === path.basename(migrationDirName),
      );
      if (migration) {
        const isFirstMigration = i === migrationDirsReversed.length - 1;
        await runDownMigration(
          migrationDirName,
          isFirstMigration,
          migrationsDir,
          config,
          client,
        );
        if (migration.name === m) {
          await client.close();
          await db.close();
          process.exit(0);
        }
      }
    }
    await db.close();
  }
  await client.close();
  process.exit(0);
}

export async function runDownMigration(
  migrationDirName: string,
  isFirstMigration: boolean,
  migrationsDirPath: string,
  config: Config,
  client: $Client,
) {
  const migrationName = basename(migrationDirName);
  const downPath = join(migrationsDirPath, migrationName, "down.ts");

  try {
    const migrationModule = await import(downPath);
    const statements: DDLStatement[] = migrationModule.statements;
    const options: MigrationOptions = migrationModule.options ?? {};

    // Determine if transaction should be used
    const useTransaction = options.transaction ?? true;
    const execution = options.execution ?? "joined";

    try {
      if (statements.length > 0) {
        if (execution === "sequential") {
          if (useTransaction) await client.query("BEGIN;");
          for (const st of statements) {
            await client.query(st.toSQL());
          }
          if (useTransaction) await client.query("COMMIT;");
        } else {
          let sql = "";
          if (useTransaction) sql += "BEGIN;\n";
          sql += statements.map((st) => st.toSQL()).join("\n");
          if (useTransaction) sql += "\nCOMMIT;";
          await client.query(sql);
        }
      }
    } catch (e) {
      if (useTransaction && execution === "sequential") {
        await client.query("ROLLBACK;");
      }
      throw e;
    }

    if (!isFirstMigration) {
      config.connector.options.pool = {
        ...config.connector.options.pool,
        max: 1,
      };
      config.connector.options.logger = undefined;
      const db = database({ Migrations }, config);
      await db.delete(Migrations).where(eq(Migrations.name, migrationName));
      await db.close();
    }
    console.log(
      bgGreen.white.bold("[REVERTED]") +
        " " +
        yellow(`Migration ${cyan(migrationName)}`) +
        dim("."),
    );
  } catch (e) {
    console.error(
      red(`Failed to rollback migration ${yellow(migrationName)}:`),
      e,
    );
  }
}
