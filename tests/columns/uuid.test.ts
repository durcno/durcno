import { eq } from "durcno";
import { createInsertSchema } from "durcno/validators/zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyTestContext, getDb, initTestContext, schema } from "./setup";

describe("UUID Column Type", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  afterAll(async () => {
    await destroyTestContext();
  });

  describe("uuid", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.UuidTests);
    const uuid1 = "01902b6d-f540-7c60-8000-000000000001";
    const uuid2 = "01902b6d-f540-7c60-9123-000000000002";

    it("zod insert schema", () => {
      expect(() => zodSchema.parse({ uuid: "not-a-uuid" })).toThrow();
      expect(() => zodSchema.parse({ uuid: 123 })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.UuidTests)
        .values(zodSchema.parse({ uuid: uuid1 }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.UuidTests)
        .select()
        .where(eq(schema.UuidTests.id, insertedId));
      expect(row.uuid).toBe(uuid1);
      expect(row.uuidWithDefault).toBe("00000000-0000-0000-8000-000000000000");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.UuidTests)
        .set({ uuid: uuid2 })
        .where(eq(schema.UuidTests.id, insertedId));
      const [row] = await db
        .from(schema.UuidTests)
        .select()
        .where(eq(schema.UuidTests.id, insertedId));
      expect(row.uuid).toBe(uuid2);
    });
  });
});
