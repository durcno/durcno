import fs from "node:fs";
import path from "node:path";
import { MIGRATION_NAME_REGEX } from "durcno/migration";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  startPostgresContainer,
  stopPostgresContainer,
  type TestContainerInfo,
} from "../../../docker-utils";
import { rmSync, runDurcno, runDurcnoRaw } from "../../../helpers";

describe("durcno generate - renames (non-interactive)", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");
  const migrationsDir = path.resolve(__dirname, "migrations.test");

  let containerInfo: TestContainerInfo;
  let client: pg.Client;

  function env(stage: number): Record<string, string> {
    return {
      ...process.env,
      STAGE: String(stage),
      DATABASE_PORT: String(containerInfo.port),
    } as Record<string, string>;
  }

  function generate(stage: number, args: string[] = []): string {
    return runDurcno(
      ["generate", "--config", configPath, ...args],
      env(stage),
      process.cwd(),
    );
  }

  function migrate(stage: number): void {
    runDurcno(["migrate", "--config", configPath], env(stage), __dirname);
  }

  function getMigrationFolders(): string[] {
    if (!fs.existsSync(migrationsDir)) return [];
    return fs
      .readdirSync(migrationsDir)
      .filter((f) => MIGRATION_NAME_REGEX.test(f))
      .sort();
  }

  function getLatestMigrationSource(): { up: string; down: string } {
    const folders = getMigrationFolders();
    const latest = folders.at(-1);
    if (!latest) throw new Error("No migration folders found");

    return {
      up: fs.readFileSync(path.join(migrationsDir, latest, "up.ts"), "utf8"),
      down: fs.readFileSync(
        path.join(migrationsDir, latest, "down.ts"),
        "utf8",
      ),
    };
  }

  beforeAll(async () => {
    rmSync(migrationsDir);
    delete process.env.STAGE;

    containerInfo = await startPostgresContainer({
      user: "testuser",
      password: "testpass",
      dbName: "testdb",
    });
    client = new pg.Client(containerInfo.connectionString);
    await client.connect();
  }, 120000);

  afterAll(async () => {
    await client?.end().catch(console.error);
    await stopPostgresContainer(containerInfo.container);
  });

  it("[stage 1] should create the initial users table", () => {
    generate(1);
    expect(getMigrationFolders()).toHaveLength(1);
    migrate(1);
  });

  it("[stage 2] should fail and suggest rename flags without a TTY", () => {
    const foldersBefore = getMigrationFolders().length;

    const result = runDurcnoRaw(
      ["generate", "--config", configPath],
      env(2),
      process.cwd(),
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "Potential table/column renames need confirmation.",
    );
    expect(result.stderr).toContain(
      "--rename-table public.users=public.members",
    );
    expect(getMigrationFolders()).toHaveLength(foldersBefore);
  });

  it("[stage 2] should rename a table and a column with explicit flags", async () => {
    await client.query(
      `INSERT INTO users (username, email) VALUES ('alice', 'alice@example.com')`,
    );

    const foldersBefore = getMigrationFolders().length;
    generate(2, [
      "--rename-table",
      "users=members",
      "--rename-column",
      "members.username=handle",
    ]);

    expect(getMigrationFolders()).toHaveLength(foldersBefore + 1);

    const { up, down } = getLatestMigrationSource();
    expect(up).toContain('ddl.renameTable("public", "users", "members")');
    expect(up).toContain('.renameColumn("username", "handle")');
    expect(up).not.toContain('ddl.dropTable("public", "users")');
    expect(down).toContain('ddl.renameTable("public", "members", "users")');
    expect(down).toContain('.renameColumn("handle", "username")');

    migrate(2);

    const rows = await client.query(`SELECT handle, email FROM members`);
    expect(rows.rows).toEqual([
      { handle: "alice", email: "alice@example.com" },
    ]);
  });

  it("[stage 3] should treat unresolved renames as drop + create with --yes", async () => {
    const foldersBefore = getMigrationFolders().length;
    const output = generate(3, ["--yes"]);

    expect(output).toContain("Treating 1 potential rename as drop + create.");
    expect(getMigrationFolders()).toHaveLength(foldersBefore + 1);

    const { up } = getLatestMigrationSource();
    expect(up).toContain('ddl.dropTable("public", "members")');
    expect(up).toContain('ddl.createTable("public", "accounts")');
    expect(up).not.toContain("renameTable");

    migrate(3);

    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    `);
    const tableNames = tables.rows.map((row) => row.table_name);
    expect(tableNames).toContain("accounts");
    expect(tableNames).not.toContain("members");
  });

  it("[stage 4] should rename a column using an unqualified table name", async () => {
    await client.query(
      `INSERT INTO accounts (handle, email) VALUES ('bob', 'bob@example.com')`,
    );

    const foldersBefore = getMigrationFolders().length;
    generate(4, ["--rename-column", "accounts.handle=username"]);

    expect(getMigrationFolders()).toHaveLength(foldersBefore + 1);

    const { up, down } = getLatestMigrationSource();
    expect(up).toContain('.renameColumn("handle", "username")');
    expect(down).toContain('.renameColumn("username", "handle")');

    migrate(4);

    const rows = await client.query(`SELECT username, email FROM accounts`);
    expect(rows.rows).toEqual([{ username: "bob", email: "bob@example.com" }]);
  });
});
