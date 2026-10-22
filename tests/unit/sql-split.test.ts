import { describe, expect, it } from "vitest";
import { splitSqlScript } from "../../src/cli/sql-split";

describe("splitSqlScript", () => {
  it("splits on top-level semicolons", () => {
    expect(splitSqlScript("select 1; select 2;")).toEqual([
      { type: "sql", sql: "select 1" },
      { type: "sql", sql: "select 2" },
    ]);
  });

  it("keeps semicolons inside strings and quoted identifiers", () => {
    expect(splitSqlScript(`select 'a;b', "c;d";`)).toEqual([
      { type: "sql", sql: `select 'a;b', "c;d"` },
    ]);
  });

  it("handles escaped quotes", () => {
    expect(splitSqlScript("select 'it''s; fine';")).toEqual([
      { type: "sql", sql: "select 'it''s; fine'" },
    ]);
    expect(splitSqlScript(`select "a""b;c";`)).toEqual([
      { type: "sql", sql: `select "a""b;c"` },
    ]);
  });

  it("treats backslashes as escapes only in E-strings", () => {
    expect(splitSqlScript("select E'it\\'s; fine'; select 2;")).toEqual([
      { type: "sql", sql: "select E'it\\'s; fine'" },
      { type: "sql", sql: "select 2" },
    ]);
    expect(splitSqlScript("select 'a\\'; select 2;")).toEqual([
      { type: "sql", sql: "select 'a\\'" },
      { type: "sql", sql: "select 2" },
    ]);
  });

  it("keeps dollar-quoted bodies intact", () => {
    const sql =
      "create function f() returns void as $body$ begin; perform 1; end; $body$ language plpgsql";
    expect(splitSqlScript(`${sql};`)).toEqual([{ type: "sql", sql }]);
  });

  it("ignores semicolons in comments", () => {
    expect(splitSqlScript("select 1 -- ; comment\n; select 2;")).toEqual([
      { type: "sql", sql: "select 1 -- ; comment" },
      { type: "sql", sql: "select 2" },
    ]);
    expect(splitSqlScript("select 1 /* ; /* nested ; */ ; */;")).toEqual([
      { type: "sql", sql: "select 1 /* ; /* nested ; */ ; */" },
    ]);
  });

  it("drops comment-only statements", () => {
    expect(splitSqlScript("-- nothing here;\n/* or here; */")).toEqual([]);
  });

  it("supports scripts made only of meta commands", () => {
    expect(splitSqlScript("\\dt\n\\dn\n")).toEqual([
      { type: "meta", command: "\\dt" },
      { type: "meta", command: "\\dn" },
    ]);
  });
});
