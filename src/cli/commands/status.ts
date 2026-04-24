import { dirname, resolve } from "node:path";
import chalk from "chalk";
import { database, Migrations } from "durcno";

import type { Options } from "..";
import {
  ensureMigrationsDirExists,
  getMigrationFolderNames,
  migrationsTableExists,
} from "../checks";
import { DEFAULT_MIGRATIONS_DIR } from "../consts";
import { loadConfig, resolveConfigPath } from "../helpers";

const { dim, cyan, yellow, green } = chalk;

export async function status(options: Options): Promise<void> {
  const configPath = resolveConfigPath(options.config);
  const config = await loadConfig(configPath);
  const { connector } = config;
  const migrationsDir = resolve(
    dirname(configPath),
    config.out || DEFAULT_MIGRATIONS_DIR,
  );

  ensureMigrationsDirExists(migrationsDir);
  const migrationDirNames = getMigrationFolderNames(migrationsDir);

  if (migrationDirNames.length === 0) {
    console.log(chalk.yellow("No migrations found."));
    process.exit(0);
  }
  connector.pool = { ...connector.pool, max: 1 };
  connector.logger = undefined;
  const db = database({ Migrations }, config);
  const migrationsQuery = db.from(Migrations).select();
  let migrations: Awaited<typeof migrationsQuery>;
  const client = connector.getClient();
  await client.connect();

  if (await migrationsTableExists(client)) {
    migrations = await migrationsQuery;
  } else {
    migrations = [];
  }
  await db.close();

  for (const migrationDirName of migrationDirNames.sort()) {
    const migration = migrations.find(
      (migration) => migration.name === migrationDirName,
    );
    if (migration) {
      console.log(
        `${green("[✔]")} ${green(
          `Migration ${cyan(migrationDirName)} applied at ${cyan(
            migration.createdAt.toLocaleString(),
          )}${dim(".")}`,
        )}`,
      );
    } else {
      console.log(
        `${yellow("[✖] ")}${yellow(`Migration ${cyan(migrationDirName)} not applied`)}${dim(".")}`,
      );
    }
  }
  await client.close();
}
