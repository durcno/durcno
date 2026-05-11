import fs from "node:fs";
import path, { isAbsolute, resolve } from "node:path";
import type { TestContainerInfo } from "./docker-utils";
import { startPostgresContainer, stopPostgresContainer } from "./docker-utils";
import { rmSync, runDurcno } from "./helpers";
import vitestConfig from "./vitest.config";

let containerInfo: TestContainerInfo;

function isSameOrInside(target: string, parent: string): boolean {
  const relative = path.relative(parent, target);
  return (
    relative === "" || (!relative.startsWith("..") && !isAbsolute(relative))
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
  const args = process.argv.slice(2);
  if (["list"].includes(args[0])) return false;

  const files = args.filter((arg) => arg.length && arg.match(/[*/]/));
  if (files.length === 0) return true;

  const dir = vitestConfig.test?.dir ?? ".";
  const absoluteDir = resolve(__dirname, dir);
  const columnsDir = resolve(__dirname, "columns");
  const resolveBases = [absoluteDir, __dirname, process.cwd()];

  return files.some((file) => {
    const cleanedPath = file.replace(/:\d+(?::\d+)?$/, "");
    const candidates = isAbsolute(cleanedPath)
      ? [resolve(cleanedPath)]
      : resolveBases.map((base) => resolve(base, cleanedPath));

    return candidates.some((candidate) => {
      const matchesLiteralPath =
        isSameOrInside(candidate, columnsDir) ||
        isSameOrInside(columnsDir, candidate);

      if (matchesLiteralPath) return true;

      return safelyMatchesGlob(columnsDir, candidate);
    });
  });
}

const globalDbFile = resolve(__dirname, "global-db.json");

export async function setup() {
  const initializeGlobalDatabase = shouldStartGlobalDatabase();
  if (!initializeGlobalDatabase) return;

  console.log("Starting global PostgreSQL Database...");

  containerInfo = await startPostgresContainer({
    image: "postgis/postgis:18-3.6-alpine",
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
  const columnsDir = resolve(__dirname, "columns");
  const configPath = resolve(columnsDir, "durcno.config.ts");
  const migrationsDirName = "migrations.test/shared";
  const migrationsDir = resolve(columnsDir, migrationsDirName);

  // Clean previous migrations if any (optional, but good for fresh start)
  rmSync(migrationsDir);

  await new Promise((resolve) => setTimeout(resolve, 1000));

  try {
    runDurcno(["generate", "--config", configPath], {
      ...process.env,
      DB_PORT: containerInfo.port.toString(),
      DB_NAME: containerInfo.dbName,
      MIGRATIONS_DIR: `./${migrationsDirName}`,
    });

    runDurcno(["migrate", "--config", configPath], {
      ...process.env,
      DB_PORT: containerInfo.port.toString(),
      DB_NAME: containerInfo.dbName,
      MIGRATIONS_DIR: `./${migrationsDirName}`,
    });
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
