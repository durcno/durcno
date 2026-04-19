import { eq, isNotNull, isNull, ne } from "durcno";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanTestData,
  destroyTestContext,
  getDb,
  initTestContext,
  schema,
} from "./setup";

describe("String Column Types", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([
      schema.VarcharTests,
      schema.TextTests,
      schema.CharTests,
    ]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // ==========================================================================
  // VARCHAR
  // ==========================================================================

  describe("varchar", () => {
    describe("notNull constraint", () => {
      it("should insert and read required varchar", async () => {
        const db = getDb();
        await db.insert(schema.VarcharTests).values({
          requiredName: "test_name",
        });

        const [row] = await db.from(schema.VarcharTests).select();
        expect(row.requiredName).toBe("test_name");
      });

      it("should allow null for optional varchar", async () => {
        const db = getDb();
        await db.insert(schema.VarcharTests).values({
          requiredName: "test",
          // optionalName not provided - should be null
        });

        const [row] = await db.from(schema.VarcharTests).select();
        expect(row.optionalName).toBeNull();
      });
    });

    describe("default value", () => {
      it("should use default value when not provided", async () => {
        const db = getDb();
        await db.insert(schema.VarcharTests).values({
          requiredName: "test",
        });

        const [row] = await db.from(schema.VarcharTests).select();
        expect(row.withDefault).toBe("default_value");
      });

      it("should override default when value provided", async () => {
        const db = getDb();
        await db.insert(schema.VarcharTests).values({
          requiredName: "test",
          withDefault: "custom_value",
        });

        const [row] = await db.from(schema.VarcharTests).select();
        expect(row.withDefault).toBe("custom_value");
      });
    });

    describe("create and read", () => {
      it("should handle various string values", async () => {
        const db = getDb();
        const testCases = [
          { requiredName: "simple" },
          { requiredName: "with spaces" },
          { requiredName: "special!@#$%^&*()" },
          { requiredName: "unicode_émoji_🎉" },
          { requiredName: "" }, // empty string
        ];

        for (const tc of testCases) {
          await cleanTestData([schema.VarcharTests]);
          await db.insert(schema.VarcharTests).values(tc);
          const [row] = await db.from(schema.VarcharTests).select();
          expect(row.requiredName).toBe(tc.requiredName);
        }
      });

      it("should handle SQL special characters safely", async () => {
        const db = getDb();
        const malicious = "'; DROP TABLE users; --";
        await db.insert(schema.VarcharTests).values({
          requiredName: malicious,
        });

        const [row] = await db.from(schema.VarcharTests).select();
        expect(row.requiredName).toBe(malicious);
      });
    });

    describe("filtering", () => {
      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.VarcharTests).values([
          { requiredName: "alice", optionalName: "A" },
          { requiredName: "bob", optionalName: null },
          { requiredName: "charlie", optionalName: "C" },
        ]);
      });

      it("should filter with eq operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.VarcharTests)
          .select()
          .where(eq(schema.VarcharTests.requiredName, "bob"));

        expect(result).toHaveLength(1);
        expect(result[0].requiredName).toBe("bob");
      });

      it("should filter with ne operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.VarcharTests)
          .select()
          .where(ne(schema.VarcharTests.requiredName, "bob"));

        expect(result).toHaveLength(2);
      });

      it("should filter with isNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.VarcharTests)
          .select()
          .where(isNull(schema.VarcharTests.optionalName));

        expect(result).toHaveLength(1);
        expect(result[0].requiredName).toBe("bob");
      });

      it("should filter with isNotNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.VarcharTests)
          .select()
          .where(isNotNull(schema.VarcharTests.optionalName));

        expect(result).toHaveLength(2);
      });
    });

    describe("unique constraint", () => {
      it("should allow unique values", async () => {
        const db = getDb();
        await db.insert(schema.VarcharTests).values([
          { requiredName: "a", uniqueCode: "CODE1" },
          { requiredName: "b", uniqueCode: "CODE2" },
        ]);

        const rows = await db.from(schema.VarcharTests).select();
        expect(rows).toHaveLength(2);
      });

      it("should reject duplicate unique values", async () => {
        const db = getDb();
        await db.insert(schema.VarcharTests).values({
          requiredName: "first",
          uniqueCode: "SAME",
        });

        await expect(
          db.insert(schema.VarcharTests).values({
            requiredName: "second",
            uniqueCode: "SAME",
          }),
        ).rejects.toThrow();
      });
    });
  });

  // ==========================================================================
  // TEXT
  // ==========================================================================

  describe("text", () => {
    describe("notNull constraint", () => {
      it("should insert and read required text", async () => {
        const db = getDb();
        await db.insert(schema.TextTests).values({
          requiredContent: "Hello, world!",
        });

        const [row] = await db.from(schema.TextTests).select();
        expect(row.requiredContent).toBe("Hello, world!");
      });

      it("should allow null for optional text", async () => {
        const db = getDb();
        await db.insert(schema.TextTests).values({
          requiredContent: "test",
        });

        const [row] = await db.from(schema.TextTests).select();
        expect(row.optionalContent).toBeNull();
      });
    });

    describe("default value", () => {
      it("should use default value when not provided", async () => {
        const db = getDb();
        await db.insert(schema.TextTests).values({
          requiredContent: "test",
        });

        const [row] = await db.from(schema.TextTests).select();
        expect(row.withDefault).toBe("default text");
      });
    });

    describe("create and read", () => {
      it("should handle large text content", async () => {
        const db = getDb();
        const largeText = "x".repeat(10000);
        await db.insert(schema.TextTests).values({
          requiredContent: largeText,
        });

        const [row] = await db.from(schema.TextTests).select();
        expect(row.requiredContent).toBe(largeText);
        expect(row.requiredContent.length).toBe(10000);
      });

      it("should handle multi-line text", async () => {
        const db = getDb();
        const multiLine = "Line 1\nLine 2\nLine 3";
        await db.insert(schema.TextTests).values({
          requiredContent: multiLine,
        });

        const [row] = await db.from(schema.TextTests).select();
        expect(row.requiredContent).toBe(multiLine);
      });
    });

    describe("filtering", () => {
      it("should filter text with eq operator", async () => {
        const db = getDb();
        await db
          .insert(schema.TextTests)
          .values([
            { requiredContent: "content_a" },
            { requiredContent: "content_b" },
          ]);

        const result = await db
          .from(schema.TextTests)
          .select()
          .where(eq(schema.TextTests.requiredContent, "content_a"));

        expect(result).toHaveLength(1);
        expect(result[0].requiredContent).toBe("content_a");
      });
    });
  });

  // ==========================================================================
  // CHAR
  // ==========================================================================

  describe("char", () => {
    describe("notNull constraint", () => {
      it("should insert and read required char", async () => {
        const db = getDb();
        await db.insert(schema.CharTests).values({
          requiredCode: "ABCDE",
        });

        const [row] = await db.from(schema.CharTests).select();
        expect(row.requiredCode).toBe("ABCDE");
      });

      it("should allow null for optional char", async () => {
        const db = getDb();
        await db.insert(schema.CharTests).values({
          requiredCode: "TEST1",
        });

        const [row] = await db.from(schema.CharTests).select();
        expect(row.optionalCode).toBeNull();
      });
    });

    describe("default value", () => {
      it("should use default value when not provided", async () => {
        const db = getDb();
        await db.insert(schema.CharTests).values({
          requiredCode: "AAAAA",
        });

        const [row] = await db.from(schema.CharTests).select();
        expect(row.withDefault).toBe("XX");
      });
    });

    describe("create and read", () => {
      it("should handle exact length char", async () => {
        const db = getDb();
        await db.insert(schema.CharTests).values({
          requiredCode: "12345",
        });

        const [row] = await db.from(schema.CharTests).select();
        expect(row.requiredCode).toBe("12345");
      });

      it("should pad shorter values with spaces (PostgreSQL behavior)", async () => {
        const db = getDb();
        await db.insert(schema.CharTests).values({
          requiredCode: "AB", // shorter than 5
        });

        const [row] = await db.from(schema.CharTests).select();
        // fromDriver trims the padding
        expect(row.requiredCode).toBe("AB");
      });
    });

    describe("filtering", () => {
      it("should filter char with eq operator", async () => {
        const db = getDb();
        await db
          .insert(schema.CharTests)
          .values([{ requiredCode: "CODE1" }, { requiredCode: "CODE2" }]);

        const result = await db
          .from(schema.CharTests)
          .select()
          .where(eq(schema.CharTests.requiredCode, "CODE1"));

        expect(result).toHaveLength(1);
        expect(result[0].requiredCode).toBe("CODE1");
      });
    });
  });
});
