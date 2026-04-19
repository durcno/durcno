import { eq, gte, isNotNull, isNull, lte, ne } from "durcno";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanTestData,
  destroyTestContext,
  getDb,
  initTestContext,
  schema,
} from "./setup";

describe("Numeric Column Types", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([
      schema.IntegerTests,
      schema.SmallintTests,
      schema.BigintTests,
      schema.SerialTests,
      schema.SmallserialTests,
      schema.BigserialTests,
      schema.NumericTests,
    ]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // ==========================================================================
  // INTEGER
  // ==========================================================================

  describe("integer", () => {
    describe("notNull constraint", () => {
      it("should insert and read required integer", async () => {
        const db = getDb();
        await db.insert(schema.IntegerTests).values({
          requiredCount: 42,
        });

        const [row] = await db.from(schema.IntegerTests).select();
        expect(row.requiredCount).toBe(42);
      });

      it("should allow null for optional integer", async () => {
        const db = getDb();
        await db.insert(schema.IntegerTests).values({
          requiredCount: 1,
        });

        const [row] = await db.from(schema.IntegerTests).select();
        expect(row.optionalCount).toBeNull();
      });
    });

    describe("default value", () => {
      it("should use default value when not provided", async () => {
        const db = getDb();
        await db.insert(schema.IntegerTests).values({
          requiredCount: 100,
        });

        const [row] = await db.from(schema.IntegerTests).select();
        expect(row.withDefault).toBe(0);
      });

      it("should override default when value provided", async () => {
        const db = getDb();
        await db.insert(schema.IntegerTests).values({
          requiredCount: 100,
          withDefault: 999,
        });

        const [row] = await db.from(schema.IntegerTests).select();
        expect(row.withDefault).toBe(999);
      });
    });

    describe("create and read", () => {
      it("should handle positive integers", async () => {
        const db = getDb();
        await db.insert(schema.IntegerTests).values({
          requiredCount: 2147483647, // Max int32
        });

        const [row] = await db.from(schema.IntegerTests).select();
        expect(row.requiredCount).toBe(2147483647);
      });

      it("should handle negative integers", async () => {
        const db = getDb();
        await db.insert(schema.IntegerTests).values({
          requiredCount: -2147483648, // Min int32
        });

        const [row] = await db.from(schema.IntegerTests).select();
        expect(row.requiredCount).toBe(-2147483648);
      });

      it("should handle zero", async () => {
        const db = getDb();
        await db.insert(schema.IntegerTests).values({
          requiredCount: 0,
        });

        const [row] = await db.from(schema.IntegerTests).select();
        expect(row.requiredCount).toBe(0);
      });
    });

    describe("filtering", () => {
      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.IntegerTests).values([
          { requiredCount: 10, optionalCount: null },
          { requiredCount: 20, optionalCount: 5 },
          { requiredCount: 30, optionalCount: 15 },
        ]);
      });

      it("should filter with eq operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.IntegerTests)
          .select()
          .where(eq(schema.IntegerTests.requiredCount, 20));

        expect(result).toHaveLength(1);
        expect(result[0].requiredCount).toBe(20);
      });

      it("should filter with ne operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.IntegerTests)
          .select()
          .where(ne(schema.IntegerTests.requiredCount, 20));

        expect(result).toHaveLength(2);
      });

      it("should filter with gte operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.IntegerTests)
          .select()
          .where(gte(schema.IntegerTests.requiredCount, 20));

        expect(result).toHaveLength(2);
      });

      it("should filter with lte operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.IntegerTests)
          .select()
          .where(lte(schema.IntegerTests.requiredCount, 20));

        expect(result).toHaveLength(2);
      });

      it("should filter with isNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.IntegerTests)
          .select()
          .where(isNull(schema.IntegerTests.optionalCount));

        expect(result).toHaveLength(1);
        expect(result[0].requiredCount).toBe(10);
      });

      it("should filter with isNotNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.IntegerTests)
          .select()
          .where(isNotNull(schema.IntegerTests.optionalCount));

        expect(result).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // SMALLINT
  // ==========================================================================

  describe("smallint", () => {
    describe("notNull constraint", () => {
      it("should insert and read required smallint", async () => {
        const db = getDb();
        await db.insert(schema.SmallintTests).values({
          requiredValue: 100,
        });

        const [row] = await db.from(schema.SmallintTests).select();
        expect(row.requiredValue).toBe(100);
      });

      it("should allow null for optional smallint", async () => {
        const db = getDb();
        await db.insert(schema.SmallintTests).values({
          requiredValue: 1,
        });

        const [row] = await db.from(schema.SmallintTests).select();
        expect(row.optionalValue).toBeNull();
      });
    });

    describe("default value", () => {
      it("should use default value when not provided", async () => {
        const db = getDb();
        await db.insert(schema.SmallintTests).values({
          requiredValue: 1,
        });

        const [row] = await db.from(schema.SmallintTests).select();
        expect(row.withDefault).toBe(10);
      });
    });

    describe("create and read", () => {
      it("should handle smallint range", async () => {
        const db = getDb();
        // Test max smallint
        await db.insert(schema.SmallintTests).values({
          requiredValue: 32767, // Max int16
        });

        const [row] = await db.from(schema.SmallintTests).select();
        expect(row.requiredValue).toBe(32767);
      });

      it("should handle negative smallint", async () => {
        const db = getDb();
        await db.insert(schema.SmallintTests).values({
          requiredValue: -32768, // Min int16
        });

        const [row] = await db.from(schema.SmallintTests).select();
        expect(row.requiredValue).toBe(-32768);
      });
    });

    describe("filtering", () => {
      it("should filter smallint with comparison operators", async () => {
        const db = getDb();
        await db
          .insert(schema.SmallintTests)
          .values([
            { requiredValue: 5 },
            { requiredValue: 10 },
            { requiredValue: 15 },
          ]);

        const result = await db
          .from(schema.SmallintTests)
          .select()
          .where(gte(schema.SmallintTests.requiredValue, 10));

        expect(result).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // BIGINT
  // ==========================================================================

  describe("bigint", () => {
    describe("notNull constraint", () => {
      it("should insert and read required bigint", async () => {
        const db = getDb();
        await db.insert(schema.BigintTests).values({
          requiredAmount: 9007199254740991, // Max safe integer in JS
        });

        const [row] = await db.from(schema.BigintTests).select();
        expect(row.requiredAmount).toBe(9007199254740991);
      });

      it("should allow null for optional bigint", async () => {
        const db = getDb();
        await db.insert(schema.BigintTests).values({
          requiredAmount: 1,
        });

        const [row] = await db.from(schema.BigintTests).select();
        expect(row.optionalAmount).toBeNull();
      });
    });

    describe("default value", () => {
      it("should use default value when not provided", async () => {
        const db = getDb();
        await db.insert(schema.BigintTests).values({
          requiredAmount: 1,
        });

        const [row] = await db.from(schema.BigintTests).select();
        expect(row.withDefault).toBe(1000);
      });
    });

    describe("create and read", () => {
      it("should handle large positive numbers", async () => {
        const db = getDb();
        const largeNum = 1000000000000;
        await db.insert(schema.BigintTests).values({
          requiredAmount: largeNum,
        });

        const [row] = await db.from(schema.BigintTests).select();
        expect(row.requiredAmount).toBe(largeNum);
      });

      it("should handle large negative numbers", async () => {
        const db = getDb();
        const largeNegative = -1000000000000;
        await db.insert(schema.BigintTests).values({
          requiredAmount: largeNegative,
        });

        const [row] = await db.from(schema.BigintTests).select();
        expect(row.requiredAmount).toBe(largeNegative);
      });
    });

    describe("filtering", () => {
      it("should filter bigint with comparison operators", async () => {
        const db = getDb();
        await db
          .insert(schema.BigintTests)
          .values([
            { requiredAmount: 1000000 },
            { requiredAmount: 2000000 },
            { requiredAmount: 3000000 },
          ]);

        const result = await db
          .from(schema.BigintTests)
          .select()
          .where(gte(schema.BigintTests.requiredAmount, 2000000));

        expect(result).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // SERIAL (auto-increment)
  // ==========================================================================

  describe("serial", () => {
    describe("auto-increment behavior", () => {
      it("should auto-generate id on insert", async () => {
        const db = getDb();
        await db.insert(schema.SerialTests).values({
          name: "First",
        });

        const [row] = await db.from(schema.SerialTests).select();
        expect(row.id).toBe(1);
        expect(typeof row.id).toBe("number");
      });

      it("should increment id for each insert", async () => {
        const db = getDb();
        await db
          .insert(schema.SerialTests)
          .values([{ name: "First" }, { name: "Second" }, { name: "Third" }]);

        const rows = await db.from(schema.SerialTests).select();
        expect(rows).toHaveLength(3);
        expect(rows[0].id).toBe(1);
        expect(rows[1].id).toBe(2);
        expect(rows[2].id).toBe(3);
      });
    });

    describe("filtering", () => {
      it("should filter by auto-generated id", async () => {
        const db = getDb();
        await db
          .insert(schema.SerialTests)
          .values([{ name: "First" }, { name: "Second" }]);

        const result = await db
          .from(schema.SerialTests)
          .select()
          .where(eq(schema.SerialTests.id, 2));

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe("Second");
      });
    });
  });

  // ==========================================================================
  // SMALLSERIAL
  // ==========================================================================

  describe("smallserial", () => {
    describe("auto-increment behavior", () => {
      it("should auto-generate id on insert", async () => {
        const db = getDb();
        await db.insert(schema.SmallserialTests).values({
          name: "Test",
        });

        const [row] = await db.from(schema.SmallserialTests).select();
        expect(row.id).toBe(1);
      });

      it("should increment id for each insert", async () => {
        const db = getDb();
        await db
          .insert(schema.SmallserialTests)
          .values([{ name: "A" }, { name: "B" }]);

        const rows = await db.from(schema.SmallserialTests).select();
        expect(rows[0].id).toBe(1);
        expect(rows[1].id).toBe(2);
      });
    });
  });

  // ==========================================================================
  // BIGSERIAL
  // ==========================================================================

  describe("bigserial", () => {
    describe("auto-increment behavior", () => {
      it("should auto-generate id on insert", async () => {
        const db = getDb();
        await db.insert(schema.BigserialTests).values({
          name: "Test",
        });

        const [row] = await db.from(schema.BigserialTests).select();
        expect(row.id).toBe(1);
      });

      it("should increment id for each insert", async () => {
        const db = getDb();
        await db
          .insert(schema.BigserialTests)
          .values([{ name: "First" }, { name: "Second" }, { name: "Third" }]);

        const rows = await db.from(schema.BigserialTests).select();
        expect(rows[0].id).toBe(1);
        expect(rows[1].id).toBe(2);
        expect(rows[2].id).toBe(3);
      });
    });

    describe("filtering", () => {
      it("should filter by bigserial id", async () => {
        const db = getDb();
        await db
          .insert(schema.BigserialTests)
          .values([{ name: "A" }, { name: "B" }, { name: "C" }]);

        const result = await db
          .from(schema.BigserialTests)
          .select()
          .where(gte(schema.BigserialTests.id, 2));

        expect(result).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // NUMERIC
  // ==========================================================================

  describe("numeric", () => {
    beforeEach(async () => {
      await cleanTestData([schema.NumericTests]);
    });

    describe("notNull constraint", () => {
      it("should insert and read required numeric", async () => {
        const db = getDb();
        await db.insert(schema.NumericTests).values({
          requiredValue: "123.456",
          withPrecision: "1234567890",
          withScale: "12345678.90",
        });

        const [row] = await db.from(schema.NumericTests).select();
        expect(row.requiredValue).toBe("123.456");
      });

      it("should allow null for optional numeric", async () => {
        const db = getDb();
        await db.insert(schema.NumericTests).values({
          requiredValue: "1",
          withPrecision: "1",
          withScale: "1.00",
        });

        const [row] = await db.from(schema.NumericTests).select();
        expect(row.optionalValue).toBeNull();
      });
    });

    describe("default value", () => {
      it("should use default value when not provided", async () => {
        const db = getDb();
        await db.insert(schema.NumericTests).values({
          requiredValue: "100",
          withPrecision: "1",
          withScale: "1.00",
        });

        const [row] = await db.from(schema.NumericTests).select();
        expect(row.withDefault).toBe("0");
      });

      it("should override default when value provided", async () => {
        const db = getDb();
        await db.insert(schema.NumericTests).values({
          requiredValue: "100",
          withPrecision: "1",
          withScale: "1.00",
          withDefault: "999.99",
        });

        const [row] = await db.from(schema.NumericTests).select();
        expect(row.withDefault).toBe("999.99");
      });
    });

    describe("create and read", () => {
      it("should handle very large numbers", async () => {
        const db = getDb();
        const largeNum = "9999999999999999999999999999.9999999999";
        await db.insert(schema.NumericTests).values({
          requiredValue: largeNum,
          withPrecision: "1234567890",
          withScale: "12345678.90",
        });

        const [row] = await db.from(schema.NumericTests).select();
        expect(row.requiredValue).toBe(largeNum);
      });

      it("should handle negative numbers", async () => {
        const db = getDb();
        await db.insert(schema.NumericTests).values({
          requiredValue: "-123.456",
          withPrecision: "-1234567890",
          withScale: "-12345678.90",
        });

        const [row] = await db.from(schema.NumericTests).select();
        expect(row.requiredValue).toBe("-123.456");
        expect(row.withPrecision).toBe("-1234567890");
        expect(row.withScale).toBe("-12345678.90");
      });

      it("should handle zero", async () => {
        const db = getDb();
        await db.insert(schema.NumericTests).values({
          requiredValue: "0",
          withPrecision: "0",
          withScale: "0.00",
        });

        const [row] = await db.from(schema.NumericTests).select();
        expect(row.requiredValue).toBe("0");
      });

      it("should respect precision and scale constraints", async () => {
        const db = getDb();
        // withScale has precision 10, scale 2
        await db.insert(schema.NumericTests).values({
          requiredValue: "1",
          withPrecision: "1",
          withScale: "99999999.99", // exactly max for precision 10, scale 2
        });

        const [row] = await db.from(schema.NumericTests).select();
        expect(row.withScale).toBe("99999999.99");
      });

      it("should handle decimal values with many digits", async () => {
        const db = getDb();
        await db.insert(schema.NumericTests).values({
          requiredValue: "0.123456789012345678901234567890",
          withPrecision: "1",
          withScale: "1.00",
        });

        const [row] = await db.from(schema.NumericTests).select();
        expect(row.requiredValue).toBe("0.123456789012345678901234567890");
      });
    });

    describe("update", () => {
      it("should update numeric values", async () => {
        const db = getDb();
        await db.insert(schema.NumericTests).values({
          requiredValue: "100.50",
          withPrecision: "1",
          withScale: "1.00",
        });

        await db
          .update(schema.NumericTests)
          .set({ requiredValue: "200.75" })
          .where(eq(schema.NumericTests.requiredValue, "100.50"));

        const [row] = await db.from(schema.NumericTests).select();
        expect(row.requiredValue).toBe("200.75");
      });

      it("should update optional numeric to null", async () => {
        const db = getDb();
        await db.insert(schema.NumericTests).values({
          requiredValue: "1",
          withPrecision: "1",
          withScale: "1.00",
          optionalValue: "50.25",
        });

        await db.update(schema.NumericTests).set({ optionalValue: null });

        const [row] = await db.from(schema.NumericTests).select();
        expect(row.optionalValue).toBeNull();
      });
    });

    describe("filtering", () => {
      it("should filter by exact numeric value", async () => {
        const db = getDb();
        await db.insert(schema.NumericTests).values([
          { requiredValue: "100.50", withPrecision: "1", withScale: "1.00" },
          { requiredValue: "200.75", withPrecision: "2", withScale: "2.00" },
        ]);

        const result = await db
          .from(schema.NumericTests)
          .select()
          .where(eq(schema.NumericTests.requiredValue, "100.50"));

        expect(result).toHaveLength(1);
        expect(result[0].requiredValue).toBe("100.50");
      });

      it("should filter by not equal", async () => {
        const db = getDb();
        await db.insert(schema.NumericTests).values([
          { requiredValue: "100.50", withPrecision: "1", withScale: "1.00" },
          { requiredValue: "200.75", withPrecision: "2", withScale: "2.00" },
        ]);

        const result = await db
          .from(schema.NumericTests)
          .select()
          .where(ne(schema.NumericTests.requiredValue, "100.50"));

        expect(result).toHaveLength(1);
        expect(result[0].requiredValue).toBe("200.75");
      });

      it("should filter by null/not null", async () => {
        const db = getDb();
        await db.insert(schema.NumericTests).values([
          {
            requiredValue: "1",
            withPrecision: "1",
            withScale: "1.00",
            optionalValue: "50",
          },
          { requiredValue: "2", withPrecision: "2", withScale: "2.00" },
        ]);

        const withValue = await db
          .from(schema.NumericTests)
          .select()
          .where(isNotNull(schema.NumericTests.optionalValue));

        const withoutValue = await db
          .from(schema.NumericTests)
          .select()
          .where(isNull(schema.NumericTests.optionalValue));

        expect(withValue).toHaveLength(1);
        expect(withoutValue).toHaveLength(1);
      });
    });
  });
});
