import { eq } from "durcno";
import { createInsertSchema } from "durcno/validators/zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyTestContext, getDb, initTestContext, schema } from "./setup";

describe("Boolean Column Type", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  afterAll(async () => {
    await destroyTestContext();
  });

  describe("boolean", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.BooleanTests);

    it("zod insert schema", () => {
      expect(() => zodSchema.parse({ flag: "true" })).toThrow();
      expect(() => zodSchema.parse({ flag: 1 })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.BooleanTests)
        .values(zodSchema.parse({ flag: true }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.BooleanTests)
        .select()
        .where(eq(schema.BooleanTests.id, insertedId));
      expect(row.flag).toBe(true);
      expect(row.flagWithDefault).toBe(false);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.BooleanTests)
        .set({ flag: false })
        .where(eq(schema.BooleanTests.id, insertedId));
      const [row] = await db
        .from(schema.BooleanTests)
        .select()
        .where(eq(schema.BooleanTests.id, insertedId));
      expect(row.flag).toBe(false);
    });
  });
});
