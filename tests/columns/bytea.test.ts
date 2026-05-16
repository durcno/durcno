import { eq } from "durcno";
import { createInsertSchema } from "durcno/validators/zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyTestContext, getDb, initTestContext, schema } from "./setup";

describe("Bytea Column Type", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  afterAll(async () => {
    await destroyTestContext();
  });

  describe("bytea", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.ByteaTests);
    const initialData = Buffer.from("hello");
    const updatedData = Buffer.from("world");

    it("zod insert schema", () => {
      expect(() => zodSchema.parse({ data: "hello" })).toThrow();
      expect(() => zodSchema.parse({ data: new Uint8Array([1, 2]) })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.ByteaTests)
        .values(zodSchema.parse({ data: Buffer.from("hello") }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.ByteaTests)
        .select()
        .where(eq(schema.ByteaTests.id, insertedId));
      expect(Buffer.isBuffer(row.data)).toBe(true);
      expect((row.data as Buffer).equals(initialData)).toBe(true);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.ByteaTests)
        .set({ data: updatedData })
        .where(eq(schema.ByteaTests.id, insertedId));
      const [row] = await db
        .from(schema.ByteaTests)
        .select()
        .where(eq(schema.ByteaTests.id, insertedId));
      expect((row.data as Buffer).equals(updatedData)).toBe(true);
    });
  });
});
