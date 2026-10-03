import { array, numeric, sql } from "durcno";
import { describe, expect, it } from "vitest";

describe("numeric SQL serialization", () => {
  const col = numeric({});

  describe("toSQLScalar", () => {
    it("emits plain numeric literals unquoted", () => {
      expect(col.toSQLScalar("0")).toBe("0");
      expect(col.toSQLScalar("10.50")).toBe("10.50");
      expect(col.toSQLScalar("-0.5")).toBe("-0.5");
      expect(col.toSQLScalar("+3")).toBe("+3");
      expect(col.toSQLScalar(".5")).toBe(".5");
      expect(col.toSQLScalar("5.")).toBe("5.");
    });

    it("emits exponent notation", () => {
      expect(col.toSQLScalar("1e5")).toBe("1e5");
      expect(col.toSQLScalar("1.5E-10")).toBe("1.5E-10");
    });

    it("preserves arbitrary precision", () => {
      const value = "123456789012345678901234567890.000000000000000000001";
      expect(col.toSQLScalar(value)).toBe(value);
    });

    it("passes Sql through untouched", () => {
      expect(col.toSQLScalar(sql`10.50 * 2`)).toBe("10.50 * 2");
    });

    it("emits NULL for null", () => {
      expect(col.toSQLScalar(null)).toBe("NULL");
    });

    it.each([
      "abc",
      "0; DROP TABLE users; --",
      "1 OR 1=1",
      "10,50",
      "1_000",
      "",
      " 10.50",
      "10.50 ",
      "0x27",
      "0b101",
      "1n",
      "NaN",
      "Infinity",
      "1.2.3",
      "$1",
      "'10.50'",
    ])("rejects %j as an invalid numeric value", (value) => {
      expect(() => col.toSQLScalar(value)).toThrow(
        `Invalid numeric value: ${value}`,
      );
    });
  });

  describe("toSQL", () => {
    it("stays unquoted without a cast, so comparisons rely on the column type", () => {
      expect(col.toSQL("10.50")).toBe("10.50");
      expect(col.toSQLExpression("10.50")).toBe("10.50");
    });

    it("adds the numeric cast when one is requested", () => {
      expect(col.toSQL("10.50", { cast: true })).toBe("10.50::numeric");
    });

    it("renders array values as a numeric array literal", () => {
      const arrayCol = numeric({ dimension: array() });
      expect(arrayCol.toSQL(["1.0", "2.0"])).toBe("ARRAY[1.0, 2.0]");
      expect(arrayCol.toSQL(["1.0"], { cast: true })).toBe(
        "ARRAY[1.0::numeric]",
      );
      expect(arrayCol.toSQLExpression(["1.0", "2.0"])).toBe(
        "ARRAY[1.0, 2.0]::numeric[]",
      );
    });
  });

  describe("defaults", () => {
    it("renders the default as a numeric literal", () => {
      expect(numeric({}).default("0").getDefaultSqlStr).toBe("0");
    });

    it("rejects an invalid default", () => {
      expect(() => numeric({}).default("abc").getDefaultSqlStr).toThrow(
        "Invalid numeric value: abc",
      );
    });
  });

  describe("column type", () => {
    it("renders precision and scale", () => {
      const scaled = numeric({ precision: 10, scale: 2 });
      expect(scaled.sqlTypeScalar).toBe("numeric(10,2)");
      expect(scaled.sqlType).toBe("numeric(10,2)");
      expect(scaled.sqlCastScalar).toBe("numeric(10,2)");
    });

    it("renders precision without scale", () => {
      expect(numeric({ precision: 10 }).sqlTypeScalar).toBe("numeric(10)");
    });

    it("renders plain numeric without options", () => {
      expect(col.sqlTypeScalar).toBe("numeric");
      expect(col.sqlType).toBe("numeric");
      expect(col.sqlCastScalar).toBe("numeric");
    });
  });

  describe("zod", () => {
    it("accepts numeric literals", () => {
      expect(col.zodType.safeParse("10.50").success).toBe(true);
      expect(col.zodType.safeParse("-1.5e-10").success).toBe(true);
    });

    it("rejects the same values the SQL serializer rejects", () => {
      for (const value of ["abc", "", "0x27", " 10.50", "10.50 ", "NaN"]) {
        const result = col.zodType.safeParse(value);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toBe("Invalid numeric value");
        }
      }
    });

    it("rejects non-string values", () => {
      expect(col.zodType.safeParse(42).success).toBe(false);
      expect(col.zodType.safeParse(42n).success).toBe(false);
    });
  });
});
