import { eq, isIn, isNotNull, isNull, ne } from "durcno";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanTestData,
  destroyTestContext,
  getDb,
  initTestContext,
  schema,
} from "./setup";

describe("Enum Column Type", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([schema.EnumTests]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  describe("notNull constraint", () => {
    it("should insert and read required enum value", async () => {
      const db = getDb();
      await db.insert(schema.EnumTests).values({
        requiredStatus: "active",
      });

      const [row] = await db.from(schema.EnumTests).select();
      expect(row.requiredStatus).toBe("active");
    });

    it("should handle all enum values", async () => {
      const db = getDb();
      const statuses = ["active", "inactive", "pending"] as const;

      for (const status of statuses) {
        await cleanTestData([schema.EnumTests]);
        await db.insert(schema.EnumTests).values({
          requiredStatus: status,
        });

        const [row] = await db.from(schema.EnumTests).select();
        expect(row.requiredStatus).toBe(status);
      }
    });

    it("should allow null for optional enum", async () => {
      const db = getDb();
      await db.insert(schema.EnumTests).values({
        requiredStatus: "active",
        // optionalStatus not provided - should be null
      });

      const [row] = await db.from(schema.EnumTests).select();
      expect(row.optionalStatus).toBeNull();
    });
  });

  describe("default value", () => {
    it("should use default enum value when not provided", async () => {
      const db = getDb();
      await db.insert(schema.EnumTests).values({
        requiredStatus: "active",
      });

      const [row] = await db.from(schema.EnumTests).select();
      expect(row.withDefault).toBe("medium");
    });

    it("should override default when value provided", async () => {
      const db = getDb();
      await db.insert(schema.EnumTests).values({
        requiredStatus: "active",
        withDefault: "high",
      });

      const [row] = await db.from(schema.EnumTests).select();
      expect(row.withDefault).toBe("high");
    });

    it("should allow all enum values for default column", async () => {
      const db = getDb();
      const priorities = ["low", "medium", "high"] as const;

      for (const priority of priorities) {
        await cleanTestData([schema.EnumTests]);
        await db.insert(schema.EnumTests).values({
          requiredStatus: "active",
          withDefault: priority,
        });

        const [row] = await db.from(schema.EnumTests).select();
        expect(row.withDefault).toBe(priority);
      }
    });
  });

  describe("create and read", () => {
    it("should handle multiple rows with different enum values", async () => {
      const db = getDb();
      await db.insert(schema.EnumTests).values([
        { requiredStatus: "active", optionalStatus: "inactive" },
        { requiredStatus: "inactive", optionalStatus: "pending" },
        { requiredStatus: "pending", optionalStatus: null },
      ]);

      const rows = await db.from(schema.EnumTests).select();
      expect(rows).toHaveLength(3);
      expect(rows[0].requiredStatus).toBe("active");
      expect(rows[0].optionalStatus).toBe("inactive");
      expect(rows[1].requiredStatus).toBe("inactive");
      expect(rows[1].optionalStatus).toBe("pending");
      expect(rows[2].requiredStatus).toBe("pending");
      expect(rows[2].optionalStatus).toBeNull();
    });

    it("should return string type for enum values", async () => {
      const db = getDb();
      await db.insert(schema.EnumTests).values({
        requiredStatus: "active",
      });

      const [row] = await db.from(schema.EnumTests).select();
      expect(typeof row.requiredStatus).toBe("string");
    });

    it("should handle multiple enum types in same table", async () => {
      const db = getDb();
      await db.insert(schema.EnumTests).values({
        requiredStatus: "active", // StatusEnum
        withDefault: "high", // PriorityEnum
      });

      const [row] = await db.from(schema.EnumTests).select();
      expect(row.requiredStatus).toBe("active");
      expect(row.withDefault).toBe("high");
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      const db = getDb();
      await db.insert(schema.EnumTests).values([
        { requiredStatus: "active", optionalStatus: null, withDefault: "low" },
        {
          requiredStatus: "active",
          optionalStatus: "active",
          withDefault: "medium",
        },
        {
          requiredStatus: "inactive",
          optionalStatus: "pending",
          withDefault: "high",
        },
        {
          requiredStatus: "pending",
          optionalStatus: "inactive",
          withDefault: "low",
        },
      ]);
    });

    it("should filter with eq operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.EnumTests)
        .select()
        .where(eq(schema.EnumTests.requiredStatus, "active"));

      expect(result).toHaveLength(2);
      for (const row of result) {
        expect(row.requiredStatus).toBe("active");
      }
    });

    it("should filter with ne operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.EnumTests)
        .select()
        .where(ne(schema.EnumTests.requiredStatus, "active"));

      expect(result).toHaveLength(2);
      for (const row of result) {
        expect(row.requiredStatus).not.toBe("active");
      }
    });

    it("should filter with isNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.EnumTests)
        .select()
        .where(isNull(schema.EnumTests.optionalStatus));

      expect(result).toHaveLength(1);
      expect(result[0].optionalStatus).toBeNull();
    });

    it("should filter with isNotNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.EnumTests)
        .select()
        .where(isNotNull(schema.EnumTests.optionalStatus));

      expect(result).toHaveLength(3);
    });

    it("should filter with isIn operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.EnumTests)
        .select()
        .where(isIn(schema.EnumTests.requiredStatus, ["active", "pending"]));

      expect(result).toHaveLength(3);
    });

    it("should filter optional enum with eq operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.EnumTests)
        .select()
        .where(eq(schema.EnumTests.optionalStatus, "pending"));

      expect(result).toHaveLength(1);
      expect(result[0].requiredStatus).toBe("inactive");
    });

    it("should filter different enum type in same table", async () => {
      const db = getDb();
      const result = await db
        .from(schema.EnumTests)
        .select()
        .where(eq(schema.EnumTests.withDefault, "low"));

      expect(result).toHaveLength(2);
    });
  });

  describe("enum value case sensitivity", () => {
    it("should preserve enum value case", async () => {
      const db = getDb();
      // Our enum values are lowercase
      await db.insert(schema.EnumTests).values({
        requiredStatus: "active",
      });

      const [row] = await db.from(schema.EnumTests).select();
      expect(row.requiredStatus).toBe("active");
      expect(row.requiredStatus).not.toBe("Active");
      expect(row.requiredStatus).not.toBe("ACTIVE");
    });
  });
});
