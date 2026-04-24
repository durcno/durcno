import fs from "node:fs";
import path from "node:path";
import { database, defineConfig } from "durcno";
import { pg } from "durcno/connectors/pg";
import { createDurcnoLogger } from "durcno/logger";
import { Client } from "pg";
import * as schema from "./schema";

type TestDb = ReturnType<typeof database<typeof schema>>;

export interface TestContext {
  db: TestDb;
}

let _context: TestContext | null = null;
let _env: any = null;

function getEnv() {
  if (_env) return _env;
  const globalDbPath = path.resolve(__dirname, "../global-db.json");
  if (!fs.existsSync(globalDbPath)) {
    throw new Error("global-db.json missing. Did global setup run?");
  }
  _env = JSON.parse(fs.readFileSync(globalDbPath, "utf-8"));
  return _env;
}

/**
 * Initialize the shared test context for column tests.
 */
export async function initTestContext(): Promise<TestContext> {
  if (_context) {
    return _context;
  }

  const env = getEnv();

  const db = database(
    schema,
    defineConfig({
      schema: "./schema.ts",
      connector: pg({
        pool: { max: 2 },
        dbCredentials: {
          host: env.TEST_DB_HOST,
          port: parseInt(env.TEST_DB_PORT, 10),
          user: env.TEST_DB_USER,
          password: env.TEST_DB_PASSWORD,
          database: env.TEST_DB_NAME,
        },
        logger: createDurcnoLogger(),
      }),
    }),
  );

  _context = { db };
  return _context;
}

/**
 * Clean specific tables from the database.
 * Call this in beforeEach with the tables used in the test.
 */
export async function cleanTestData(tables: any[] = []): Promise<void> {
  if (!_context) {
    throw new Error(
      "Test context not initialized. Call initTestContext first.",
    );
  }

  const env = getEnv();
  const connectionString = `postgres://${env.TEST_DB_USER}:${env.TEST_DB_PASSWORD}@${env.TEST_DB_HOST}:${env.TEST_DB_PORT}/${env.TEST_DB_NAME}`;

  const client = new Client({ connectionString });
  await client.connect();

  try {
    if (tables.length > 0) {
      for (const table of tables) {
        // Access internal table name
        const tableName = (table as any)._?.name;

        if (typeof tableName === "string") {
          await client.query(
            `TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`,
          );
        } else {
          console.warn("Could not determine table name for cleanup:", table);
        }
      }
    }
  } finally {
    await client.end();
  }
}

/**
 * Cleanup and close the test context.
 * Call this in afterAll of test files.
 */
export async function destroyTestContext(): Promise<void> {
  if (_context) {
    await _context.db.close();
    _context = null;
  }
}

/**
 * Get the current test db instance from the _context.
 */
export function getDb(): TestDb {
  if (!_context) {
    throw new Error(
      "Test context not initialized. Call initTestContext first.",
    );
  }
  return _context.db;
}

// Re-export schema for convenience
export { schema };
