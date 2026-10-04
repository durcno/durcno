import { describe, expect, it } from "vitest";
import { escIdentifier, escLiteral } from "../../src/sql";

/**
 * `escIdentifier` / `escLiteral` unit tests. No database involved.
 *
 * Both helpers short-circuit when the escape character is absent, so the
 * escape and no-escape paths are both covered explicitly.
 *
 * Imported from `src` rather than `durcno` because the helpers are internal and
 * not re-exported from the public entry point.
 */
describe("escIdentifier", () => {
  it("doubles embedded double quotes", () => {
    expect(escIdentifier('foo"bar')).toBe('foo""bar');
    expect(escIdentifier('"')).toBe('""');
    expect(escIdentifier('a"b"c')).toBe('a""b""c');
  });

  it("returns the input unchanged when there is nothing to escape", () => {
    expect(escIdentifier("users")).toBe("users");
    expect(escIdentifier("user_name")).toBe("user_name");
    expect(escIdentifier("it's fine")).toBe("it's fine");
    expect(escIdentifier("")).toBe("");
  });

  it("escapes only the double quote", () => {
    expect(escIdentifier("it's")).toBe("it's");
    expect(escIdentifier("a\\b")).toBe("a\\b");
    expect(escIdentifier("it's fine")).toBe("it's fine");
  });
});

describe("escLiteral", () => {
  it("doubles embedded single quotes", () => {
    expect(escLiteral("it's")).toBe("it''s");
    expect(escLiteral("'")).toBe("''");
    expect(escLiteral("O'Brien")).toBe("O''Brien");
  });

  it("returns the input unchanged when there is nothing to escape", () => {
    expect(escLiteral("hello")).toBe("hello");
    expect(escLiteral('say "hi"')).toBe('say "hi"');
    expect(escLiteral("a\\b")).toBe("a\\b");
    expect(escLiteral("")).toBe("");
  });

  it("escapes only the single quote", () => {
    expect(escLiteral('a"b')).toBe('a"b');
    expect(escLiteral("a\\b")).toBe("a\\b");
  });
});
