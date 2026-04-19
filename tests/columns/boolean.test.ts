import { eq, isNotNull, isNull, ne } from "durcno";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanTestData,
  destroyTestContext,
  getDb,
  initTestContext,
  schema,
} from "./setup";

describe("Boolean Column Type", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([schema.BooleanTests]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  describe("notNull constraint", () => {
    it("should insert and read required boolean true", async () => {
      const db = getDb();
      await db.insert(schema.BooleanTests).values({
        requiredFlag: true,
      });

      const [row] = await db.from(schema.BooleanTests).select();
      expect(row.requiredFlag).toBe(true);
    });

    it("should insert and read required boolean false", async () => {
      const db = getDb();
      await db.insert(schema.BooleanTests).values({
        requiredFlag: false,
      });

      const [row] = await db.from(schema.BooleanTests).select();
      expect(row.requiredFlag).toBe(false);
    });

    it("should allow null for optional boolean", async () => {
      const db = getDb();
      await db.insert(schema.BooleanTests).values({
        requiredFlag: true,
        // optionalFlag not provided - should be null
      });

      const [row] = await db.from(schema.BooleanTests).select();
      expect(row.optionalFlag).toBeNull();
    });
  });

  describe("default value", () => {
    it("should use default value true when not provided", async () => {
      const db = getDb();
      await db.insert(schema.BooleanTests).values({
        requiredFlag: false,
      });

      const [row] = await db.from(schema.BooleanTests).select();
      expect(row.defaultTrue).toBe(true);
    });

    it("should use default value false when not provided", async () => {
      const db = getDb();
      await db.insert(schema.BooleanTests).values({
        requiredFlag: true,
      });

      const [row] = await db.from(schema.BooleanTests).select();
      expect(row.defaultFalse).toBe(false);
    });

    it("should override default true with false", async () => {
      const db = getDb();
      await db.insert(schema.BooleanTests).values({
        requiredFlag: true,
        defaultTrue: false,
      });

      const [row] = await db.from(schema.BooleanTests).select();
      expect(row.defaultTrue).toBe(false);
    });

    it("should override default false with true", async () => {
      const db = getDb();
      await db.insert(schema.BooleanTests).values({
        requiredFlag: false,
        defaultFalse: true,
      });

      const [row] = await db.from(schema.BooleanTests).select();
      expect(row.defaultFalse).toBe(true);
    });
  });

  describe("create and read", () => {
    it("should correctly round-trip true value", async () => {
      const db = getDb();
      await db.insert(schema.BooleanTests).values({
        requiredFlag: true,
        optionalFlag: true,
      });

      const [row] = await db.from(schema.BooleanTests).select();
      expect(row.requiredFlag).toBe(true);
      expect(row.optionalFlag).toBe(true);
      expect(typeof row.requiredFlag).toBe("boolean");
      expect(typeof row.optionalFlag).toBe("boolean");
    });

    it("should correctly round-trip false value", async () => {
      const db = getDb();
      await db.insert(schema.BooleanTests).values({
        requiredFlag: false,
        optionalFlag: false,
      });

      const [row] = await db.from(schema.BooleanTests).select();
      expect(row.requiredFlag).toBe(false);
      expect(row.optionalFlag).toBe(false);
      expect(typeof row.requiredFlag).toBe("boolean");
      expect(typeof row.optionalFlag).toBe("boolean");
    });

    it("should handle multiple rows with different boolean values", async () => {
      const db = getDb();
      await db.insert(schema.BooleanTests).values([
        { requiredFlag: true, optionalFlag: true },
        { requiredFlag: false, optionalFlag: false },
        { requiredFlag: true, optionalFlag: null },
      ]);

      const rows = await db.from(schema.BooleanTests).select();
      expect(rows).toHaveLength(3);
      expect(rows[0].requiredFlag).toBe(true);
      expect(rows[0].optionalFlag).toBe(true);
      expect(rows[1].requiredFlag).toBe(false);
      expect(rows[1].optionalFlag).toBe(false);
      expect(rows[2].requiredFlag).toBe(true);
      expect(rows[2].optionalFlag).toBeNull();
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      const db = getDb();
      await db.insert(schema.BooleanTests).values([
        { requiredFlag: true, optionalFlag: true },
        { requiredFlag: true, optionalFlag: false },
        { requiredFlag: false, optionalFlag: null },
        { requiredFlag: false, optionalFlag: true },
      ]);
    });

    it("should filter with eq true", async () => {
      const db = getDb();
      const result = await db
        .from(schema.BooleanTests)
        .select()
        .where(eq(schema.BooleanTests.requiredFlag, true));

      expect(result).toHaveLength(2);
      for (const row of result) {
        expect(row.requiredFlag).toBe(true);
      }
    });

    it("should filter with eq false", async () => {
      const db = getDb();
      const result = await db
        .from(schema.BooleanTests)
        .select()
        .where(eq(schema.BooleanTests.requiredFlag, false));

      expect(result).toHaveLength(2);
      for (const row of result) {
        expect(row.requiredFlag).toBe(false);
      }
    });

    it("should filter with ne operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.BooleanTests)
        .select()
        .where(ne(schema.BooleanTests.requiredFlag, true));

      expect(result).toHaveLength(2);
      for (const row of result) {
        expect(row.requiredFlag).toBe(false);
      }
    });

    it("should filter optional boolean with isNull", async () => {
      const db = getDb();
      const result = await db
        .from(schema.BooleanTests)
        .select()
        .where(isNull(schema.BooleanTests.optionalFlag));

      expect(result).toHaveLength(1);
      expect(result[0].optionalFlag).toBeNull();
    });

    it("should filter optional boolean with isNotNull", async () => {
      const db = getDb();
      const result = await db
        .from(schema.BooleanTests)
        .select()
        .where(isNotNull(schema.BooleanTests.optionalFlag));

      expect(result).toHaveLength(3);
    });

    it("should filter optional boolean with eq true", async () => {
      const db = getDb();
      const result = await db
        .from(schema.BooleanTests)
        .select()
        .where(eq(schema.BooleanTests.optionalFlag, true));

      expect(result).toHaveLength(2);
    });
  });
});
