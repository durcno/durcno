import path, { basename, dirname, join, resolve } from "node:path";
import chalk from "chalk";
import { type DurcnoSetup, database, eq, Migrations } from "durcno";
import type { DDLStatement, MigrationOptions } from "durcno/migration";

import type { $Client } from "../../connectors/common";
import type { Options } from "..";
import {
  ensureMigrationsDirExists,
  getMigrationFolderNames,
  migrationsTableExists,
} from "../checks";
import { DEFAULT_MIGRATIONS_DIR } from "../consts";
import { getSetup, resolveConfigPath } from "../helpers";

const { bgGreen, dim, cyan, yellow, red } = chalk;

export async function down(m: string, options: Options): Promise<void> {
  const configPath = resolveConfigPath(options.config);
  const { connector, config } = getSetup(configPath);
  config.pool = { ...config.pool, max: 1 };
  const migrationsDir = resolve(
    dirname(configPath),
    config.out || DEFAULT_MIGRATIONS_DIR,
  );

  ensureMigrationsDirExists(migrationsDir);
  const migrationDirNames = getMigrationFolderNames(migrationsDir);

  const client = connector.getClient();
  await client.connect();

  if (await migrationsTableExists(client)) {
    const db = database({ Migrations }, { connector, config });
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
          { connector, config },
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
  setup: DurcnoSetup,
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

    if (useTransaction) {
      await client.query("BEGIN;");
    }

    try {
      if (statements.length > 0) {
        if (execution === "sequential") {
          for (const st of statements) {
            await client.query(st.toSQL());
          }
        } else {
          const sql = `${statements.map((st) => st.toSQL()).join("\n")}`;
          await client.query(sql);
        }
      }

      if (useTransaction) {
        await client.query("COMMIT;");
      }
    } catch (e) {
      if (useTransaction) {
        await client.query("ROLLBACK;");
      }
      throw e;
    }

    if (!isFirstMigration) {
      const db = database({ Migrations }, setup);
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
