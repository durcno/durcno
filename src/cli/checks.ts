import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { $, Migrations } from "durcno";
import { MIGRATION_NAME_REGEX } from "durcno/migration";
import type { $Client } from "../connectors/common";

const { bgRed, red, yellow, gray, cyan } = chalk;

/**
 * Ensures that exported tables/enums/sequences do not resolve to the same "schema.name" in the database.
 *
 * Exits the process with an error if a collision is found.
 * @param exports - Module exports to validate.
 */
export function ensureNoEntityCollisions(exports: Record<string, unknown>) {
  const seen = new Map<
    string,
    { type: "Table" | "Enum" | "Sequence"; exportName: string }
  >();

  for (const [exportName, entity] of Object.entries(exports)) {
    let name: string;
    let type: "Table" | "Enum" | "Sequence";

    if ($.isTable(entity)) {
      name = `"${entity._.schema}"."${entity._.name}"`;
      type = "Table";
    } else if ($.isEnum(entity)) {
      name = `"${entity.schema}"."${entity.name}"`;
      type = "Enum";
    } else if ($.isSequence(entity)) {
      name = `"${entity.schema}"."${entity.name}"`;
      type = "Sequence";
    } else {
      continue;
    }

    const existing = seen.get(name);
    if (existing) {
      console.error(
        red(
          `[Error] Name collision: ${type} "${exportName}" conflicts with ${existing.type} "${existing.exportName}" (both resolve to ${name}).`,
        ),
      );
      process.exit(1);
    }
    seen.set(name, { type, exportName });
  }
}

/**
 * Checks if the `durcno.migrations` table exists in the database.
 * @param client - The database client instance.
 * @returns `true` if the migrations table exists, `false` otherwise.
 */
export async function migrationsTableExists(client: $Client) {
  const checkTableQuery = `SELECT EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = '${Migrations._.schema}' AND table_name = '${Migrations._.name}'
    ) AS exists`;
  const res = await client.query(checkTableQuery);
  const rows = client.getRows(res);
  if (rows[0]?.exists) return true;
  return false;
}

/**
 * Ensures the migrations directory exists. Exits the process with an error if not found.
 * @param migrationsDir - The absolute path to the migrations directory.
 */
export function ensureMigrationsDirExists(migrationsDir: string) {
  if (!existsSync(migrationsDir)) {
    console.log(
      bgRed.white("[ERROR]") +
        " " +
        red("Migrations directory not found in:") +
        "\n  " +
        yellow(process.cwd()) +
        "\n" +
        gray(`Run ${cyan("durcno generate")} to generate migration.`),
    );
    process.exit(1);
  }
}

/**
 * Retrieves and validates migration folders from the migrations directory.
 * Exits the process if no valid migration folders are found.
 * @param migrationsDir - The absolute path to the migrations directory.
 * @returns An array of migration folder names (ISO timestamp format).
 */
export function getMigrationFolderNames(migrationsDir: string) {
  const migrationFolderNames = readdirSync(migrationsDir).filter((name) => {
    const fullPath = join(migrationsDir, name);
    return statSync(fullPath).isDirectory() && MIGRATION_NAME_REGEX.test(name);
  });
  return migrationFolderNames;
}

/**
 * Validates that each migration folder contains the required files.
 * Exits the process if any migration folder is missing `up.ts` or `down.ts`.
 * @param migrationsDirPath - The absolute path to the migrations directory.
 * @returns An array of validated migration folder names.
 */
export function validateMigrations(migrationsDirPath: string) {
  const migrationDirNames = readdirSync(migrationsDirPath).filter((name) => {
    const fullPath = join(migrationsDirPath, name);
    return statSync(fullPath).isDirectory() && MIGRATION_NAME_REGEX.test(name);
  });
  migrationDirNames.forEach((migrationDirName) => {
    const migrationDir = join(migrationsDirPath, migrationDirName);
    const upPath = join(migrationDir, `up.ts`);
    const downPath = join(migrationDir, `down.ts`);
    if (!existsSync(upPath) || !existsSync(downPath)) {
      console.log(
        bgRed.white("[ERROR]") +
          " " +
          red(
            `Migration folder (${yellow(migrationDirName)}) is missing required files.`,
          ) +
          "\n  " +
          cyan(`Expected: up.ts and down.ts`) +
          "\n  " +
          gray(`Location: ${migrationDir}`),
      );
      process.exit(1);
    }
  });
  return migrationDirNames;
}
