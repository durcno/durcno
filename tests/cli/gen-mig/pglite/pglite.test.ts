import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { rmSync, runDurcno } from "../../../helpers";

describe("durcno generate/migrate - pglite connector", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  let dbPath: string;
  let db: PGlite;

  beforeAll(async () => {
    rmSync(migrationsDir);

    // Create a temp directory as the PGlite persistent data store
    dbPath = fs.mkdtempSync(path.join(os.tmpdir(), "durcno-pglite-"));

    // Generate migrations from the schema
    runDurcno(["generate", "--config", configPath], {
      ...process.env,
    } as Record<string, string>);

    // Run migrations using the PGlite connector pointed at the temp dir
    runDurcno(
      ["migrate", "--config", configPath],
      {
        ...process.env,
        PGLITE_DB_PATH: dbPath,
      } as Record<string, string>,
      __dirname,
    );

    // Open a new PGlite connection to the same data dir for verification
    db = new PGlite(dbPath);
    await db.waitReady;
  }, 60000);

  afterAll(async () => {
    await db?.close();
    if (dbPath && fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { recursive: true, force: true });
    }
  });

  it("should generate migration files", () => {
    expect(fs.existsSync(migrationsDir)).toBe(true);
    const migrations = fs.readdirSync(migrationsDir);
    expect(migrations.length).toBeGreaterThan(0);
  });

  it("should create the users table", async () => {
    const result = await db.query<{ table_name: string }>(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    `);
    const tableNames = result.rows.map((row) => row.table_name);
    expect(tableNames).toContain("users");
  });

  it("should create the status enum with correct values", async () => {
    const result = await db.query<{ enum_name: string; enum_value: string }>(`
      SELECT t.typname AS enum_name, e.enumlabel AS enum_value
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON t.typnamespace = n.oid
      WHERE n.nspname = 'public'
      ORDER BY t.typname, e.enumsortorder;
    `);
    const enums = result.rows.reduce(
      (acc, row) => {
        if (!acc[row.enum_name]) acc[row.enum_name] = [];
        acc[row.enum_name].push(row.enum_value);
        return acc;
      },
      {} as Record<string, string[]>,
    );
    expect(enums.status).toEqual(["active", "inactive"]);
  });

  it("should create users table with correct columns", async () => {
    const result = await db.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      character_maximum_length: number | null;
    }>(`
      SELECT column_name, data_type, is_nullable, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    const columns = Object.fromEntries(
      result.rows.map((row) => [row.column_name, row]),
    );
    expect(columns.id.data_type).toBe("bigint");
    expect(columns.id.is_nullable).toBe("NO");
    expect(columns.name.data_type).toBe("character varying");
    expect(columns.name.character_maximum_length).toBe(100);
    expect(columns.email.data_type).toBe("character varying");
    expect(columns.email.character_maximum_length).toBe(255);
    expect(columns.status.data_type).toBe("USER-DEFINED");
  });
});
