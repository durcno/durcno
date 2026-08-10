import fs from "node:fs";
import path from "node:path";
import { MIGRATION_NAME_REGEX } from "durcno/migration";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
} from "../../docker-utils";
import { rmSync, runDurcno } from "../../helpers";

describe("durcno squash command", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  let containerInfo: TestContainerInfo;
  let client: pg.Client;
  let databasePort: string;
  let databaseName: string;

  // Migration names assigned incrementally across all 6 generate calls
  let m1: string;
  let m2: string;
  let m3: string;
  let m4: string;
  let m5: string;
  let m6: string;

  function getMigrationFolders(): string[] {
    if (!fs.existsSync(migrationsDir)) return [];
    return fs
      .readdirSync(migrationsDir)
      .filter((f) => MIGRATION_NAME_REGEX.test(f))
      .sort();
  }

  function runGenerate(version: number): { success: boolean; output: string } {
    try {
      const output = runDurcno(
        ["generate", "--config", configPath],
        {
          ...process.env,
          MIGRATION_VERSION: String(version),
          DATABASE_PORT: databasePort,
          DB_NAME: databaseName,
        },
        __dirname,
      );
      return { success: true, output };
    } catch (e) {
      return {
        success: false,
        output: e instanceof Error ? e.message : String(e),
      };
    }
  }

  function runMigrate(): { success: boolean; output: string } {
    try {
      const output = runDurcno(
        ["migrate", "--config", configPath],
        {
          ...process.env,
          DATABASE_PORT: databasePort,
          DB_NAME: databaseName,
        },
        __dirname,
      );
      return { success: true, output };
    } catch (e) {
      return {
        success: false,
        output: e instanceof Error ? e.message : String(e),
      };
    }
  }

  function runSquash(
    start: string,
    end: string,
    opts?: { force?: boolean; skipDb?: boolean },
  ): { success: boolean; output: string } {
    const args = ["squash", start, end, "--config", configPath];
    if (opts?.force) args.push("--force");
    if (opts?.skipDb) args.push("--skip-db");
    try {
      const output = runDurcno(
        args,
        {
          ...process.env,
          DATABASE_PORT: databasePort,
          DB_NAME: databaseName,
        },
        __dirname,
      );
      return { success: true, output };
    } catch (e) {
      return {
        success: false,
        output: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async function getAppliedNames(): Promise<string[]> {
    const result = await client.query<{ name: string }>(
      "SELECT name FROM durcno.migrations ORDER BY created_at",
    );
    return result.rows.map((r) => r.name);
  }

  beforeAll(async () => {
    rmSync(migrationsDir);

    containerInfo = await startPostgresContainer({
      image: "postgres:16-alpine",
      containerNamePrefix: "durcno-squash-tests",
    });
    databasePort = String(containerInfo.port);
    databaseName = containerInfo.dbName;

    client = new pg.Client(containerInfo.connectionString);
    await client.connect();
  }, 120000);

  afterAll(async () => {
    await client?.end().catch(console.error);
    await stopPostgresContainer(containerInfo.container);
  });

  // ── PHASE 1: Generate all 6 migrations ─────────────────────────────────────
  // Versions 1–3 are generated and immediately applied so the DB ends up with
  // m1–m3 applied and m4–m6 unapplied — the initial state for all squash tests.

  it("[gen 1] should generate and apply initial migration (users table)", {
    timeout: 120000,
  }, () => {
    const result = runGenerate(1);
    expect(result.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(1);
    m1 = folders[0];

    expect(runMigrate().success).toBe(true);
  });

  it("[gen 2] should generate and apply migration adding bio and age to users", {
    timeout: 120000,
  }, async () => {
    const result = runGenerate(2);
    expect(result.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);
    m2 = folders[1];

    expect(runMigrate().success).toBe(true);
  });

  it("[gen 3] should generate and apply migration creating posts table", {
    timeout: 120000,
  }, async () => {
    const result = runGenerate(3);
    expect(result.success).toBe(true);

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(3);
    m3 = folders[2];

    expect(runMigrate().success).toBe(true);
  });

  it("[gen 4-6] should generate remaining migrations without applying", async () => {
    const r4 = runGenerate(4);
    expect(r4.success).toBe(true);
    m4 = getMigrationFolders()[3];

    const r5 = runGenerate(5);
    expect(r5.success).toBe(true);
    m5 = getMigrationFolders()[4];

    const r6 = runGenerate(6);
    expect(r6.success).toBe(true);
    const folders = getMigrationFolders();
    m6 = folders[5];

    // 6 folders on disk; only m1–m3 applied in DB
    expect(folders).toHaveLength(6);
    expect(await getAppliedNames()).toEqual([m1, m2, m3]);
  }, 30000);

  // ── PHASE 2: Squash validation errors ──────────────────────────────────────
  // Pure validation: none of these tests modify the filesystem or DB.

  it("[error] should fail when start migration does not exist", () => {
    const result = runSquash("1999-01-01T00-00-00.000Z", m2);
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
    expect(getMigrationFolders()).toHaveLength(6);
  });

  it("[error] should fail when end migration does not exist", () => {
    const result = runSquash(m1, "2099-01-01T00-00-00.000Z");
    expect(result.success).toBe(false);
    expect(result.output).toContain("not found");
    expect(getMigrationFolders()).toHaveLength(6);
  });

  it("[error] should fail when start comes after end", () => {
    const result = runSquash(m3, m1);
    expect(result.success).toBe(false);
    expect(result.output).toContain("must come before");
    expect(getMigrationFolders()).toHaveLength(6);
  });

  it("[error] should exit when only one migration in range", () => {
    const result = runSquash(m1, m1);
    expect(result.output).toContain("Nothing to squash");
    expect(getMigrationFolders()).toHaveLength(6);
  });

  // ── PHASE 3: Custom statements and --force ─────────────────────────────────
  // State: 6 folders [m1…m6], DB: {m1, m2, m3} applied.
  // Squashing applied migrations also updates durcno.migrations records.

  it("[custom] should inject custom statement into migration 2", () => {
    const upPath = path.join(migrationsDir, m2, "up.ts");
    const originalContent = fs.readFileSync(upPath, "utf8");
    const withCustom = originalContent.replace(
      /];(\s*)$/,
      `  ddl.custom("SELECT 1;"),\n];$1`,
    );
    fs.writeFileSync(upPath, withCustom);
    expect(fs.readFileSync(upPath, "utf8")).toContain(
      'ddl.custom("SELECT 1;")',
    );
  });

  it("[custom] should fail squash when custom statements exist without --force", () => {
    const result = runSquash(m1, m2);
    expect(result.success).toBe(false);
    expect(result.output).toContain("Custom statements");
    expect(result.output).toContain("--force");
    expect(getMigrationFolders()).toHaveLength(6);
  });

  it("[custom] should squash m1+m2 with --force, skipping custom statements", async () => {
    // Both m1 and m2 are applied; the squash removes the m2 DB record.
    const result = runSquash(m1, m2, { force: true });
    expect(result.success).toBe(true);
    expect(result.output).toContain("2");

    const folders = getMigrationFolders();
    expect(folders).toHaveLength(5);
    expect(folders[0]).toBe(m1);

    // m2 record removed; m1 and m3 remain applied
    const applied = await getAppliedNames();
    expect(applied).toHaveLength(2);
    expect(applied).toContain(m1);
    expect(applied).toContain(m3);
  });

  // State: 5 folders [m1, m3, m4, m5, m6], DB: {m1, m3} applied.

  // ── PHASE 4: DB-aware squash ───────────────────────────────────────────────

  it("[db step 1] should fail when squashing a mix of applied and unapplied migrations", async () => {
    const result = runSquash(m3, m4);
    expect(result.success).toBe(false);
    expect(result.output).toContain("mix of applied and unapplied");

    // Filesystem and DB must be unchanged
    expect(getMigrationFolders()).toHaveLength(5);
    const applied = await getAppliedNames();
    expect(applied).toHaveLength(2);
    expect(applied).toContain(m1);
    expect(applied).toContain(m3);
  });

  // State: unchanged (step 1 made no changes).

  it("[db step 2] --skip-db should bypass mixed-state validation", async () => {
    const result = runSquash(m3, m4, { skipDb: true });
    expect(result.success).toBe(true);

    // m3 + m4 merged into m3 folder; m5, m6 remain → 4 folders
    const folders = getMigrationFolders();
    expect(folders).toHaveLength(4);
    expect(folders[1]).toBe(m3);

    // DB: unchanged — --skip-db skips all DB operations
    const applied = await getAppliedNames();
    expect(applied).toContain(m1);
    expect(applied).toContain(m3);
    expect(applied).not.toContain(m4);
  });

  // State: 4 folders [m1, m3, m5, m6]; DB: {m1, m3} applied.

  it("[db step 3] should update durcno.migrations when squashing all-applied migrations", async () => {
    const result = runSquash(m1, m3);
    expect(result.success).toBe(true);

    // m1 + m3 squashed into m1 folder; m5, m6 remain → 3 folders
    const folders = getMigrationFolders();
    expect(folders).toHaveLength(3);
    expect(folders[0]).toBe(m1);

    // DB: m3 record removed; only m1 remains
    const applied = await getAppliedNames();
    expect(applied).toHaveLength(1);
    expect(applied[0]).toBe(m1);
  });

  // State: 3 folders [m1, m5, m6]; only m1 applied in DB.

  it("[db step 4] should not touch durcno.migrations when squashing all-unapplied migrations", async () => {
    const appliedBefore = await getAppliedNames();
    expect(appliedBefore).toEqual([m1]);

    const result = runSquash(m5, m6);
    expect(result.success).toBe(true);

    // m5 + m6 squashed into m5 folder; m1 remains → 2 folders
    const folders = getMigrationFolders();
    expect(folders).toHaveLength(2);
    expect(folders[1]).toBe(m5);

    // DB: unchanged
    const applied = await getAppliedNames();
    expect(applied).toEqual(appliedBefore);
  });

  // ── PHASE 5: Final verification ────────────────────────────────────────────
  // State: 2 folders [m1, m5]; snapshot in m5 reflects the full v6 schema.

  it("[final] should detect no changes when schema matches current state", () => {
    const result = runGenerate(6);
    expect(result.output).toContain("No changes detected");
    expect(getMigrationFolders()).toHaveLength(2);
  });
});
