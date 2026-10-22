import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runDurcnoRaw } from "../../helpers";

describe("durcno exec command", () => {
  const configPath = path.resolve(__dirname, "durcno.config.ts");

  let dbPath: string;
  let env: Record<string, string>;

  const runExec = (args: string[], input?: string) =>
    runDurcnoRaw(
      ["exec", "--config", configPath, ...args],
      env,
      __dirname,
      input,
    );

  beforeAll(() => {
    dbPath = fs.mkdtempSync(path.join(os.tmpdir(), "durcno-exec-"));
    env = { ...process.env, PGLITE_DB_PATH: dbPath } as Record<string, string>;
  });

  afterAll(() => {
    if (dbPath && fs.existsSync(dbPath)) {
      fs.rmSync(dbPath, { recursive: true, force: true });
    }
  });

  it("returns rows as JSON", () => {
    const result = runExec(["-c", "select 1 as value", "--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([{ value: 1 }]);
  }, 30000);

  it("runs multiple statements in order", () => {
    const result = runExec([
      "-c",
      `
          create table exec_multi (id serial primary key, name text not null);
          insert into exec_multi (name) values ('alpha'), ('beta');
          select id, name from exec_multi order by id;
        `,
      "--json",
    ]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([
      { id: 1, name: "alpha" },
      { id: 2, name: "beta" },
    ]);
  }, 30000);

  it("merges rows from multiple result statements", () => {
    const result = runExec(["-c", "select 1 as n; select 2 as n;", "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([{ n: 1 }, { n: 2 }]);
  }, 30000);

  it("runs a SQL file", () => {
    const file = path.join(dbPath, "query.sql");
    fs.writeFileSync(file, "select 42 as answer;");

    const result = runExec(["-f", file, "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([{ answer: 42 }]);
  }, 30000);

  it("reads SQL from stdin", () => {
    const result = runExec(["--json"], "select 7 as value;");

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([{ value: 7 }]);
  }, 30000);

  it("supports meta commands", () => {
    expect(runExec(["-c", "create table meta_check (id int);"]).status).toBe(0);

    const result = runExec(["-c", "\\dt", "--json"]);

    expect(result.status).toBe(0);
    const rows = JSON.parse(result.stdout) as { table_name: string }[];
    expect(rows.map((row) => row.table_name)).toContain("meta_check");
  }, 30000);

  it("prints a table by default", () => {
    const result = runExec(["-c", "select 1 as value"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("value");
    expect(result.stdout).toContain("1");
    expect(() => JSON.parse(result.stdout)).toThrow();
  }, 30000);

  it("serializes bigint values", () => {
    const result = runExec([
      "-c",
      "select 9007199254740993::bigint as value",
      "--json",
    ]);

    expect(result.status).toBe(0);
    const rows = JSON.parse(result.stdout) as { value: unknown }[];
    expect(String(rows[0].value)).toBe("9007199254740993");
  }, 30000);

  it("prints an empty array for DDL-only JSON", () => {
    const result = runExec(["-c", "create table json_ddl (id int);", "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual([]);
  }, 30000);

  it("suppresses summaries with --quiet", () => {
    const result = runExec(["-c", "create table quiet_check (id int);", "-q"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe("");
  }, 30000);

  it("reports a missing config", () => {
    const result = runDurcnoRaw(
      [
        "exec",
        "-c",
        "select 1",
        "--config",
        path.join(__dirname, "missing.config.ts"),
      ],
      env,
      __dirname,
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Cannot load config");
  }, 30000);

  it("stops on the first error and exits 1", () => {
    const result = runExec(["-c", "select * from missing_table", "--json"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("missing_table");
  }, 30000);

  it("rejects using --command and --file together", () => {
    const result = runExec(["-c", "select 1", "-f", "query.sql"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("either --command or --file");
  }, 30000);

  it("rejects empty input", () => {
    const result = runExec([], "");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("No SQL provided");
  }, 30000);
});
