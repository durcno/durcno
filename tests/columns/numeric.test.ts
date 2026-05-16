import { eq } from "durcno";
import { createInsertSchema } from "durcno/validators/zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyTestContext, getDb, initTestContext, schema } from "./setup";

describe("Numeric Column Types", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  afterAll(async () => {
    await destroyTestContext();
  });

  // ==========================================================================
  // INTEGER
  // ==========================================================================

  describe("integer", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.IntegerTests);

    it("zod insert schema", () => {
      expect(zodSchema.parse({ count: 42 })).toMatchObject({ count: 42 });
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.IntegerTests)
        .values(zodSchema.parse({ count: 42 }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.IntegerTests)
        .select()
        .where(eq(schema.IntegerTests.id, insertedId));
      expect(row.count).toBe(42);
      expect(row.countWithDefault).toBe(0);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.IntegerTests)
        .set({ count: 99 })
        .where(eq(schema.IntegerTests.id, insertedId));
      const [row] = await db
        .from(schema.IntegerTests)
        .select()
        .where(eq(schema.IntegerTests.id, insertedId));
      expect(row.count).toBe(99);
    });
  });

  // ==========================================================================
  // SMALLINT
  // ==========================================================================

  describe("smallint", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.SmallintTests);

    it("zod insert schema", () => {
      expect(zodSchema.parse({ value: 100 })).toMatchObject({ value: 100 });
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.SmallintTests)
        .values(zodSchema.parse({ value: 100 }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.SmallintTests)
        .select()
        .where(eq(schema.SmallintTests.id, insertedId));
      expect(row.value).toBe(100);
      expect(row.valueWithDefault).toBe(10);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.SmallintTests)
        .set({ value: 200 })
        .where(eq(schema.SmallintTests.id, insertedId));
      const [row] = await db
        .from(schema.SmallintTests)
        .select()
        .where(eq(schema.SmallintTests.id, insertedId));
      expect(row.value).toBe(200);
    });
  });

  // ==========================================================================
  // BIGINT
  // ==========================================================================

  describe("bigint", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.BigintTests);

    it("zod insert schema", () => {
      expect(() => zodSchema.parse({ amount: 3.14 })).toThrow();
      expect(() => zodSchema.parse({ amount: "abc" })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.BigintTests)
        .values(zodSchema.parse({ amount: 1000000000n }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.BigintTests)
        .select()
        .where(eq(schema.BigintTests.id, insertedId));
      expect(row.amount).toBe(1000000000n);
      expect(row.amountWithDefault).toBe(1000n);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.BigintTests)
        .set({ amount: 2000000000n })
        .where(eq(schema.BigintTests.id, insertedId));
      const [row] = await db
        .from(schema.BigintTests)
        .select()
        .where(eq(schema.BigintTests.id, insertedId));
      expect(row.amount).toBe(2000000000n);
    });
  });

  // ==========================================================================
  // SERIAL (auto-increment)
  // ==========================================================================

  describe("serial", () => {
    let insertedId: number;
    const zodSchema = createInsertSchema(schema.SerialTests);

    it("zod insert schema", () => {
      expect(() => zodSchema.parse({ name: 123 })).toThrow();
      expect(() => zodSchema.parse({ name: false })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.SerialTests)
        .values(zodSchema.parse({ name: "test" }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeGreaterThan(0);
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.SerialTests)
        .select()
        .where(eq(schema.SerialTests.id, insertedId));
      expect(row.name).toBe("test");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.SerialTests)
        .set({ name: "updated" })
        .where(eq(schema.SerialTests.id, insertedId));
      const [row] = await db
        .from(schema.SerialTests)
        .select()
        .where(eq(schema.SerialTests.id, insertedId));
      expect(row.name).toBe("updated");
    });
  });

  // ==========================================================================
  // SMALLSERIAL
  // ==========================================================================

  describe("smallserial", () => {
    let insertedId: number;
    const zodSchema = createInsertSchema(schema.SmallserialTests);

    it("zod insert schema", () => {
      expect(() => zodSchema.parse({ name: 123 })).toThrow();
      expect(() => zodSchema.parse({ name: false })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.SmallserialTests)
        .values(zodSchema.parse({ name: "test" }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeGreaterThan(0);
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.SmallserialTests)
        .select()
        .where(eq(schema.SmallserialTests.id, insertedId));
      expect(row.name).toBe("test");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.SmallserialTests)
        .set({ name: "updated" })
        .where(eq(schema.SmallserialTests.id, insertedId));
      const [row] = await db
        .from(schema.SmallserialTests)
        .select()
        .where(eq(schema.SmallserialTests.id, insertedId));
      expect(row.name).toBe("updated");
    });
  });

  // ==========================================================================
  // BIGSERIAL
  // ==========================================================================

  describe("bigserial", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.BigserialTests);

    it("zod insert schema", () => {
      expect(() => zodSchema.parse({ name: 123 })).toThrow();
      expect(() => zodSchema.parse({ name: false })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.BigserialTests)
        .values(zodSchema.parse({ name: "test" }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeGreaterThan(0);
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.BigserialTests)
        .select()
        .where(eq(schema.BigserialTests.id, insertedId));
      expect(row.name).toBe("test");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.BigserialTests)
        .set({ name: "updated" })
        .where(eq(schema.BigserialTests.id, insertedId));
      const [row] = await db
        .from(schema.BigserialTests)
        .select()
        .where(eq(schema.BigserialTests.id, insertedId));
      expect(row.name).toBe("updated");
    });
  });

  // ==========================================================================
  // NUMERIC
  // ==========================================================================

  describe("numeric", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.NumericTests);

    it("zod insert schema", () => {
      expect(() => zodSchema.parse({ value: 42 })).toThrow();
      expect(() => zodSchema.parse({ value: "abc" })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.NumericTests)
        .values(zodSchema.parse({ value: "3.14" }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.NumericTests)
        .select()
        .where(eq(schema.NumericTests.id, insertedId));
      expect(row.value).toBe("3.14");
      expect(row.valueWithDefault).toBe("0");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.NumericTests)
        .set({ value: "999.99" })
        .where(eq(schema.NumericTests.id, insertedId));
      const [row] = await db
        .from(schema.NumericTests)
        .select()
        .where(eq(schema.NumericTests.id, insertedId));
      expect(row.value).toBe("999.99");
    });
  });
});
