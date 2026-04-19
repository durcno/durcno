import {
  char,
  cidr,
  enumtype,
  inet,
  macaddr,
  numeric,
  text,
  time,
  uuid,
  varchar,
} from "durcno";
import { describe, expect, it } from "vitest";

describe("SQL Injection Protection (String JS Type Columns)", () => {
  function runCases<T>(
    name: string,
    column: { toSQL: (v: T) => string; toDriver?: (v: any) => any },
    cases: Array<{
      name: string;
      input: any;
      expectEq?: string;
      match?: RegExp;
      expectFn?: (res: string) => void;
      throws?: string;
    }>,
  ) {
    describe(name, () => {
      const col = column;
      cases.forEach(
        ({ name: caseName, input, expectEq, match, expectFn, throws }) => {
          it(caseName, () => {
            if (throws) return expect(() => col.toSQL(input)).toThrow(throws);
            const res = col.toSQL(input);
            if (expectEq !== undefined) expect(res).toBe(expectEq);
            if (match) expect(res).toMatch(match);
            if (expectFn) expectFn(res);
          });
        },
      );
    });
  }

  runCases("varchar column", varchar({ length: 255 }), [
    {
      name: "should escape single quotes",
      input: "O'Brien",
      expectEq: "'O''Brien'",
    },
    {
      name: "should escape multiple single quotes",
      input: "It's John's book",
      expectEq: "'It''s John''s book'",
    },
    {
      name: "should handle SQL injection attempts with quotes",
      input: "'; DROP TABLE users; --",
      expectEq: "'''; DROP TABLE users; --'",
      expectFn: (r) => expect(r.startsWith("'''")).toBe(true),
    },
    {
      name: "should handle SQL injection with UNION",
      input: "' UNION SELECT * FROM passwords --",
      expectEq: "''' UNION SELECT * FROM passwords --'",
    },
    {
      name: "should handle nested quotes attack",
      input: "test'' OR ''1''=''1",
      expectEq: "'test'''' OR ''''1''''=''''1'",
    },
    { name: "should handle null values", input: null, expectEq: "NULL" },
    { name: "should handle empty string", input: "", expectEq: "''" },
    {
      name: "should handle unicode characters",
      input: "日本語'test",
      expectEq: "'日本語''test'",
    },
    {
      name: "should handle backslash escapes (PostgreSQL style)",
      input: "test\\'; DROP TABLE users; --",
      expectEq: "'test\\''; DROP TABLE users; --'",
    },
  ]);

  runCases("text column", text({}), [
    {
      name: "should escape single quotes",
      input: "O'Brien",
      expectEq: "'O''Brien'",
    },
    {
      name: "should handle SQL injection attempts",
      input: "'; DELETE FROM users WHERE '1'='1",
      expectEq: "'''; DELETE FROM users WHERE ''1''=''1'",
    },
    { name: "should handle null values", input: null, expectEq: "NULL" },
    {
      name: "should handle multi-line SQL injection",
      input: `test'\n      ; DROP TABLE users; --`,
      expectFn: (r) => {
        expect(r).toContain("''");
        expect(r).not.toContain("'; DROP");
      },
    },
  ]);

  runCases("char column", char({ length: 10 }), [
    { name: "should escape single quotes", input: "O'B", expectEq: "'O''B'" },
    {
      name: "should handle SQL injection attempts",
      input: "'; --",
      expectEq: "'''; --'",
    },
    { name: "should handle null values", input: null, expectEq: "NULL" },
  ]);

  describe("enum column", () => {
    const TestEnum = enumtype("public", "test_enum", [
      "value1",
      "value2",
      "value3",
    ]);
    const col = TestEnum.enumed({});
    it("should escape single quotes in enum values", () => {
      const result = col.toSQL("value1" as "value1");
      expect(result).toBe("'value1'");
    });

    it("should handle null values", () => {
      const result = col.toSQL(null);
      expect(result).toBe("NULL");
    });
  });

  runCases("inet column", inet({}), [
    {
      name: "should escape single quotes",
      input: "127.0.0.1'; DROP TABLE users; --",
      expectEq: "'127.0.0.1''; DROP TABLE users; --'",
    },
    { name: "should handle null values", input: null, expectEq: "NULL" },
  ]);

  runCases("cidr column", cidr({}), [
    {
      name: "should escape single quotes",
      input: "10.0.0.0/8'; SELECT pg_sleep(1); --",
      expectEq: "'10.0.0.0/8''; SELECT pg_sleep(1); --'",
    },
    { name: "should handle null values", input: null, expectEq: "NULL" },
  ]);

  runCases("macaddr column", macaddr({}), [
    {
      name: "should escape single quotes",
      input: "08:00:2b:01:02:03'; DROP TABLE users; --",
      expectEq: "'08:00:2b:01:02:03''; DROP TABLE users; --'",
    },
    { name: "should handle null values", input: null, expectEq: "NULL" },
  ]);

  runCases("time column", time({}), [
    {
      name: "should keep semicolon and comments inside string literal",
      input: "12:34:56; DROP TABLE users; --",
      expectEq: "'12:34:56; DROP TABLE users; --'",
    },
    { name: "should handle null values", input: null, expectEq: "NULL" },
  ]);

  runCases("uuid column", uuid({}), [
    {
      name: "should serialize valid uuid",
      input: "550e8400-e29b-41d4-a716-446655440000",
      expectEq: "'550e8400-e29b-41d4-a716-446655440000'",
    },
    {
      name: "should reject SQL injection payload as invalid uuid",
      input: "550e8400-e29b-41d4-a716-446655440000'; DROP TABLE users; --",
      throws: "Invalid UUID value",
    },
    { name: "should handle null values", input: null, expectEq: "NULL" },
  ]);

  runCases("numeric column", numeric({}), [
    {
      name: "should serialize valid numeric value",
      input: "12345.67",
      expectEq: "12345.67",
    },
    {
      name: "should keep SQL-like payload visible for dedicated validation",
      input: "0; DROP TABLE users; --",
      expectEq: "0; DROP TABLE users; --",
    },
    { name: "should handle null values", input: null, expectEq: "NULL" },
  ]);

  runCases("Common SQL injection patterns", varchar({ length: 1000 }), [
    {
      name: "should handle classic OR 1=1 attack",
      input: "' OR '1'='1",
      expectEq: "''' OR ''1''=''1'",
    },
    {
      name: "should handle comment-based attack",
      input: "admin'--",
      expectEq: "'admin''--'",
    },
    {
      name: "should handle batch query attack",
      input: "'; INSERT INTO users VALUES ('hacked'); --",
      expectEq: "'''; INSERT INTO users VALUES (''hacked''); --'",
    },
    {
      name: "should handle LIKE pattern injection",
      input: "test%' OR '1'='1",
      expectEq: "'test%'' OR ''1''=''1'",
    },
    {
      name: "should handle hex encoding bypass attempt",
      input: "0x27; DROP TABLE users; --",
      expectEq: "'0x27; DROP TABLE users; --'",
    },
    {
      name: "should handle char encoding bypass attempt",
      input: "CHAR(39); DROP TABLE users; --",
      expectEq: "'CHAR(39); DROP TABLE users; --'",
    },
    {
      name: "should handle time-based blind injection",
      input: "' AND SLEEP(5) --",
      expectEq: "''' AND SLEEP(5) --'",
    },
    {
      name: "should handle stacked queries",
      input: "1; UPDATE users SET password='hacked' WHERE id=1; --",
      expectEq: "'1; UPDATE users SET password=''hacked'' WHERE id=1; --'",
    },
  ]);
});
