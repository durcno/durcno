import { describe, expect, it } from "vitest";
import { camelToSnake } from "../../src/utils";

/**
 * `camelToSnake` unit tests. No database involved.
 *
 * Imported from `src` rather than `durcno` because the helper is internal and
 * not re-exported from the public entry point.
 */
describe("camelToSnake", () => {
  it("converts consecutive capitals", () => {
    expect(camelToSnake("XMLParser")).toBe("xml_parser");
    expect(camelToSnake("HTTPServer")).toBe("http_server");
    expect(camelToSnake("ID")).toBe("id");
  });

  it("converts standard camelCase", () => {
    expect(camelToSnake("camelCase")).toBe("camel_case");
    expect(camelToSnake("userName")).toBe("user_name");
    expect(camelToSnake("aB")).toBe("a_b");
  });

  it("converts PascalCase", () => {
    expect(camelToSnake("UserName")).toBe("user_name");
    expect(camelToSnake("Posts")).toBe("posts");
  });

  it("leaves single-word and snake_case input untouched", () => {
    expect(camelToSnake("id")).toBe("id");
    expect(camelToSnake("user_name")).toBe("user_name");
    expect(camelToSnake("")).toBe("");
  });

  it("returns equal values for repeated calls (guards the memoization cache)", () => {
    const first = camelToSnake("createdAt");
    const second = camelToSnake("createdAt");
    expect(second).toBe(first);
    // A different identifier sharing a prefix must not read the wrong entry.
    expect(camelToSnake("createdAtTZ")).toBe("created_at_tz");
    expect(camelToSnake("createdAt")).toBe("created_at");
  });

  it("does not confuse identifiers that lowercase to the same string", () => {
    expect(camelToSnake("userName")).toBe("user_name");
    expect(camelToSnake("UserName")).toBe("user_name");
    expect(camelToSnake("USER_NAME")).toBe("user_name");
  });
});
