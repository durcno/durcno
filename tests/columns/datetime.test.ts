import { eq } from "durcno";
import { createInsertSchema } from "durcno/validators/zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyTestContext, getDb, initTestContext, schema } from "./setup";

describe("Date/Time Column Types", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  afterAll(async () => {
    await destroyTestContext();
  });

  // ==========================================================================
  // TIMESTAMP
  // ==========================================================================

  describe("timestamp", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.TimestampTests);

    it("zod insert schema", () => {
      expect(() => zodSchema.parse({ at: new Date("2021-01-01") })).toThrow();
      expect(() => zodSchema.parse({ at: 0 })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.TimestampTests)
        .values({ at: new Date("2024-06-15T10:30:45.000Z") })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.TimestampTests)
        .select()
        .where(eq(schema.TimestampTests.id, insertedId));
      expect(row.at?.getTime()).toBe(
        new Date("2024-06-15T10:30:45.000Z").getTime(),
      );
      expect(row.atWithDefault?.getTime()).toBe(0);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.TimestampTests)
        .set({ at: new Date("2025-01-01T00:00:00.000Z") })
        .where(eq(schema.TimestampTests.id, insertedId));
      const [row] = await db
        .from(schema.TimestampTests)
        .select()
        .where(eq(schema.TimestampTests.id, insertedId));
      expect(row.at?.getTime()).toBe(
        new Date("2025-01-01T00:00:00.000Z").getTime(),
      );
    });
  });

  // ==========================================================================
  // DATE
  // ==========================================================================

  describe("date", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.DateTests);

    it("zod insert schema", () => {
      expect(() => zodSchema.parse({ date: "2021-01-01" })).toThrow();
      expect(() => zodSchema.parse({ date: 0 })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.DateTests)
        .values(zodSchema.parse({ date: new Date("2024-06-15T00:00:00.000Z") }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.DateTests)
        .select()
        .where(eq(schema.DateTests.id, insertedId));
      expect(row.date?.getUTCFullYear()).toBe(2024);
      expect(row.date?.getUTCMonth()).toBe(5); // June (0-indexed)
      expect(row.date?.getUTCDate()).toBe(15);
      expect(row.dateWithDefault?.getUTCFullYear()).toBe(2000);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.DateTests)
        .set({ date: new Date("2025-12-25T00:00:00.000Z") })
        .where(eq(schema.DateTests.id, insertedId));
      const [row] = await db
        .from(schema.DateTests)
        .select()
        .where(eq(schema.DateTests.id, insertedId));
      expect(row.date?.getUTCFullYear()).toBe(2025);
      expect(row.date?.getUTCMonth()).toBe(11); // December (0-indexed)
      expect(row.date?.getUTCDate()).toBe(25);
    });
  });

  // ==========================================================================
  // TIME
  // ==========================================================================

  describe("time", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.TimeTests);

    it("zod insert schema", () => {
      expect(() => zodSchema.parse({ time: 123 })).toThrow();
      expect(() => zodSchema.parse({ time: false })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.TimeTests)
        .values(zodSchema.parse({ time: "10:30:00" }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.TimeTests)
        .select()
        .where(eq(schema.TimeTests.id, insertedId));
      expect(row.time).toBe("10:30:00");
      expect(row.timeWithDefault).toBe("00:00:00");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.TimeTests)
        .set({ time: "14:00:00" })
        .where(eq(schema.TimeTests.id, insertedId));
      const [row] = await db
        .from(schema.TimeTests)
        .select()
        .where(eq(schema.TimeTests.id, insertedId));
      expect(row.time).toBe("14:00:00");
    });
  });
});
