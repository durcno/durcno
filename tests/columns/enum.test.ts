import { eq } from "durcno";
import { createInsertSchema } from "durcno/validators/zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyTestContext, getDb, initTestContext, schema } from "./setup";

describe("Enum Column Type", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  afterAll(async () => {
    await destroyTestContext();
  });

  describe("enum", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.EnumTests);

    it("zod insert schema", () => {
      expect(() => zodSchema.parse({ status: "unknown" })).toThrow();
      expect(() => zodSchema.parse({ status: 123 })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.EnumTests)
        .values(zodSchema.parse({ status: "active" }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.EnumTests)
        .select()
        .where(eq(schema.EnumTests.id, insertedId));
      expect(row.status).toBe("active");
      expect(row.statusWithDefault).toBe("medium");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.EnumTests)
        .set({ status: "inactive" })
        .where(eq(schema.EnumTests.id, insertedId));
      const [row] = await db
        .from(schema.EnumTests)
        .select()
        .where(eq(schema.EnumTests.id, insertedId));
      expect(row.status).toBe("inactive");
    });
  });
});
