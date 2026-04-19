import { eq, gte, isNotNull, isNull, lte } from "durcno";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanTestData,
  destroyTestContext,
  getDb,
  initTestContext,
  schema,
} from "./setup";

describe("Date/Time Column Types", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([
      schema.TimestampTests,
      schema.DateTests,
      schema.TimeTests,
    ]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // ==========================================================================
  // TIMESTAMP
  // ==========================================================================

  describe("timestamp", () => {
    describe("notNull constraint", () => {
      it("should insert and read required timestamp", async () => {
        const db = getDb();
        const now = new Date();
        await db.insert(schema.TimestampTests).values({
          requiredAt: now,
          withoutTz: now,
        });

        const [row] = await db.from(schema.TimestampTests).select();
        expect(row.requiredAt).toBeInstanceOf(Date);
        expect(row.requiredAt.getTime()).toBe(now.getTime());
      });

      it("should allow null for optional timestamp", async () => {
        const db = getDb();
        const now = new Date();
        await db.insert(schema.TimestampTests).values({
          requiredAt: now,
          withoutTz: now,
        });

        const [row] = await db.from(schema.TimestampTests).select();
        expect(row.optionalAt).toBeNull();
      });
    });

    describe("create and read", () => {
      it("should preserve timestamp precision", async () => {
        const db = getDb();
        const precise = new Date("2024-06-15T10:30:45.123Z");
        await db.insert(schema.TimestampTests).values({
          requiredAt: precise,
          withoutTz: precise,
        });

        const [row] = await db.from(schema.TimestampTests).select();
        expect(row.requiredAt.toISOString()).toBe(precise.toISOString());
      });

      it("should handle epoch timestamp", async () => {
        const db = getDb();
        const epoch = new Date(0);
        await db.insert(schema.TimestampTests).values({
          requiredAt: epoch,
          withoutTz: epoch,
        });

        const [row] = await db.from(schema.TimestampTests).select();
        expect(row.requiredAt.getTime()).toBe(0);
      });

      it("should handle future dates", async () => {
        const db = getDb();
        const future = new Date("2100-12-31T23:59:59.999Z");
        await db.insert(schema.TimestampTests).values({
          requiredAt: future,
          withoutTz: future,
        });

        const [row] = await db.from(schema.TimestampTests).select();
        expect(row.requiredAt.getUTCFullYear()).toBe(2100);
      });

      it("should handle timestamp without timezone", async () => {
        const db = getDb();
        const ts = new Date("2024-06-15T12:00:00Z");
        await db.insert(schema.TimestampTests).values({
          requiredAt: ts,
          withoutTz: ts,
        });

        const [row] = await db.from(schema.TimestampTests).select();
        expect(row.withoutTz).toBeInstanceOf(Date);
      });

      it("should handle timestamp with precision", async () => {
        const db = getDb();
        const ts = new Date("2024-06-15T12:30:45.123456Z");
        await db.insert(schema.TimestampTests).values({
          requiredAt: ts,
          withoutTz: ts,
          withPrecision: ts,
        });

        const [row] = await db.from(schema.TimestampTests).select();
        expect(row.withPrecision).toBeInstanceOf(Date);
      });
    });

    describe("filtering", () => {
      const date1 = new Date("2024-01-01T00:00:00Z");
      const date2 = new Date("2024-06-15T12:00:00Z");
      const date3 = new Date("2024-12-31T23:59:59Z");

      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.TimestampTests).values([
          { requiredAt: date1, optionalAt: null, withoutTz: date1 },
          { requiredAt: date2, optionalAt: date1, withoutTz: date2 },
          { requiredAt: date3, optionalAt: date2, withoutTz: date3 },
        ]);
      });

      it("should filter with eq operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.TimestampTests)
          .select()
          .where(eq(schema.TimestampTests.requiredAt, date2));

        expect(result).toHaveLength(1);
        expect(result[0].requiredAt.getTime()).toBe(date2.getTime());
      });

      it("should filter with gte operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.TimestampTests)
          .select()
          .where(gte(schema.TimestampTests.requiredAt, date2));

        expect(result).toHaveLength(2);
      });

      it("should filter with lte operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.TimestampTests)
          .select()
          .where(lte(schema.TimestampTests.requiredAt, date2));

        expect(result).toHaveLength(2);
      });

      it("should filter with isNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.TimestampTests)
          .select()
          .where(isNull(schema.TimestampTests.optionalAt));

        expect(result).toHaveLength(1);
        expect(result[0].requiredAt.getTime()).toBe(date1.getTime());
      });

      it("should filter with isNotNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.TimestampTests)
          .select()
          .where(isNotNull(schema.TimestampTests.optionalAt));

        expect(result).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // DATE
  // ==========================================================================

  describe("date", () => {
    describe("notNull constraint", () => {
      it("should insert and read required date", async () => {
        const db = getDb();
        const today = new Date("2024-06-15");
        await db.insert(schema.DateTests).values({
          requiredDate: today,
        });

        const [row] = await db.from(schema.DateTests).select();
        expect(row.requiredDate).toBeInstanceOf(Date);
        // Compare date parts (ignoring time)
        expect(row.requiredDate.getUTCFullYear()).toBe(2024);
        expect(row.requiredDate.getUTCMonth()).toBe(5); // June is month 5 (0-indexed)
        expect(row.requiredDate.getUTCDate()).toBe(15);
      });

      it("should allow null for optional date", async () => {
        const db = getDb();
        await db.insert(schema.DateTests).values({
          requiredDate: new Date("2024-01-01"),
        });

        const [row] = await db.from(schema.DateTests).select();
        expect(row.optionalDate).toBeNull();
      });
    });

    describe("create and read", () => {
      it("should handle date without time component", async () => {
        const db = getDb();
        const dateOnly = new Date("2024-12-25T00:00:00Z");
        await db.insert(schema.DateTests).values({
          requiredDate: dateOnly,
        });

        const [row] = await db.from(schema.DateTests).select();
        expect(row.requiredDate.getUTCMonth()).toBe(11); // December
        expect(row.requiredDate.getUTCDate()).toBe(25);
      });

      it("should handle leap year date", async () => {
        const db = getDb();
        const leapDay = new Date("2024-02-29T00:00:00Z");
        await db.insert(schema.DateTests).values({
          requiredDate: leapDay,
        });

        const [row] = await db.from(schema.DateTests).select();
        expect(row.requiredDate.getUTCMonth()).toBe(1); // February
        expect(row.requiredDate.getUTCDate()).toBe(29);
      });
    });

    describe("filtering", () => {
      const date1 = new Date("2024-01-15");
      const date2 = new Date("2024-06-15");
      const date3 = new Date("2024-12-15");

      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.DateTests).values([
          { requiredDate: date1, optionalDate: null },
          { requiredDate: date2, optionalDate: date1 },
          { requiredDate: date3, optionalDate: date2 },
        ]);
      });

      it("should filter date with eq operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.DateTests)
          .select()
          .where(eq(schema.DateTests.requiredDate, date2));

        expect(result).toHaveLength(1);
      });

      it("should filter date with gte operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.DateTests)
          .select()
          .where(gte(schema.DateTests.requiredDate, date2));

        expect(result).toHaveLength(2);
      });

      it("should filter date with isNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.DateTests)
          .select()
          .where(isNull(schema.DateTests.optionalDate));

        expect(result).toHaveLength(1);
      });
    });
  });

  // ==========================================================================
  // TIME
  // ==========================================================================

  describe("time", () => {
    describe("notNull constraint", () => {
      it("should insert and read required time", async () => {
        const db = getDb();
        await db.insert(schema.TimeTests).values({
          requiredTime: "14:30:00",
        });

        const [row] = await db.from(schema.TimeTests).select();
        expect(row.requiredTime).toBe("14:30:00");
      });

      it("should allow null for optional time", async () => {
        const db = getDb();
        await db.insert(schema.TimeTests).values({
          requiredTime: "12:00:00",
        });

        const [row] = await db.from(schema.TimeTests).select();
        expect(row.optionalTime).toBeNull();
      });
    });

    describe("create and read", () => {
      it("should handle various time formats", async () => {
        const db = getDb();
        const times = ["00:00:00", "12:30:45", "23:59:59"];

        for (const t of times) {
          await cleanTestData([schema.TimeTests]);
          await db.insert(schema.TimeTests).values({
            requiredTime: t,
          });

          const [row] = await db.from(schema.TimeTests).select();
          expect(row.requiredTime).toBe(t);
        }
      });

      it("should handle time with precision", async () => {
        const db = getDb();
        await db.insert(schema.TimeTests).values({
          requiredTime: "12:30:45",
          withPrecision: "12:30:45.123",
          withTimezone: "12:30:45+02:00",
        });

        const [row] = await db.from(schema.TimeTests).select();
        expect(row.withPrecision).toContain("12:30:45");
        expect(row.withTimezone).toContain(":");
      });
    });

    describe("filtering", () => {
      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.TimeTests).values([
          { requiredTime: "08:00:00", optionalTime: null },
          { requiredTime: "12:00:00", optionalTime: "09:00:00" },
          { requiredTime: "18:00:00", optionalTime: "15:00:00" },
        ]);
      });

      it("should filter time with eq operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.TimeTests)
          .select()
          .where(eq(schema.TimeTests.requiredTime, "12:00:00"));

        expect(result).toHaveLength(1);
        expect(result[0].requiredTime).toBe("12:00:00");
      });

      it("should filter time with gte operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.TimeTests)
          .select()
          .where(gte(schema.TimeTests.requiredTime, "12:00:00"));

        expect(result).toHaveLength(2);
      });

      it("should filter time with isNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.TimeTests)
          .select()
          .where(isNull(schema.TimeTests.optionalTime));

        expect(result).toHaveLength(1);
        expect(result[0].requiredTime).toBe("08:00:00");
      });
    });
  });
});
