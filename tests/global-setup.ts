import fs from "node:fs";
import path from "node:path";
import type { TestContainerInfo } from "./docker-utils";
import { startPostgresContainer, stopPostgresContainer } from "./docker-utils";
import { rmSync, runDurcnoCommand } from "./helpers";
import vitestConfig from "./vitest.config";

let containerInfo: TestContainerInfo;

function isSameOrInside(target: string, parent: string): boolean {
  const relative = path.relative(parent, target);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function safelyMatchesGlob(target: string, pattern: string): boolean {
  try {
    return path.matchesGlob(target, pattern);
  } catch {
    return false;
  }
}

function shouldStartGlobalDatabase(): boolean {
  const files = process.argv
    .slice(2)
    .filter((arg) => arg.length > 0 && !arg.startsWith("-"));

  if (files.length === 0) return true;

  const dir = vitestConfig.test?.dir ?? ".";
  const absoluteDir = path.resolve(__dirname, dir);
  const columnsDir = path.resolve(__dirname, "columns");
  const resolveBases = [absoluteDir, __dirname, process.cwd()];

  return files.some((file) => {
    const cleanedPath = file.replace(/:\d+(?::\d+)?$/, "");
    const candidates = path.isAbsolute(cleanedPath)
      ? [path.resolve(cleanedPath)]
      : resolveBases.map((base) => path.resolve(base, cleanedPath));

    return candidates.some((candidate) => {
      const matchesLiteralPath =
        isSameOrInside(candidate, columnsDir) ||
        isSameOrInside(columnsDir, candidate);

      if (matchesLiteralPath) return true;

      return safelyMatchesGlob(columnsDir, candidate);
    });
  });
}

const globalDbFile = path.resolve(__dirname, "global-db.json");

export async function setup() {
  const initializeGlobalDatabase = shouldStartGlobalDatabase();
  if (!initializeGlobalDatabase) return;

  console.log("Starting global PostgreSQL Database...");

  containerInfo = await startPostgresContainer({
    maxRetries: 30,
    containerNamePrefix: "durcno-global-test",
  });

  // Write connection info to file for workers
  fs.writeFileSync(
    globalDbFile,
    JSON.stringify({
      TEST_DB_HOST: "localhost",
      TEST_DB_PORT: containerInfo.port.toString(),
      TEST_DB_USER: "testuser",
      TEST_DB_PASSWORD: "testpassword",
      TEST_DB_NAME: containerInfo.dbName,
    }),
  );

  // Run migrations for tests/columns
  // We need to generate and migrate using the global DB
  const columnsDir = path.resolve(__dirname, "columns");
  const configPath = path.resolve(columnsDir, "durcno.config.ts");
  const migrationsDirName = "migrations.test/shared";
  const migrationsDir = path.resolve(columnsDir, migrationsDirName);

  // Clean previous migrations if any (optional, but good for fresh start)
  rmSync(migrationsDir);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  try {
    runDurcnoCommand(
      ["generate", "--config", configPath],
      {
        ...process.env,
        DB_PORT: containerInfo.port.toString(),
        DB_NAME: containerInfo.dbName,
        MIGRATIONS_DIR: `./${migrationsDirName}`,
      },
      columnsDir,
    );

    runDurcnoCommand(
      ["migrate", "--config", configPath],
      {
        ...process.env,
        DB_PORT: containerInfo.port.toString(),
        DB_NAME: containerInfo.dbName,
        MIGRATIONS_DIR: `./${migrationsDirName}`,
      },
      columnsDir,
    );
  } catch (e) {
    console.error("Migration failed:", e);
    await stopPostgresContainer(containerInfo.container);
    throw e;
  }
}

export async function teardown() {
  if (containerInfo) {
    await stopPostgresContainer(containerInfo.container);

    if (fs.existsSync(globalDbFile)) {
      fs.unlinkSync(globalDbFile);
    }
  }
}
