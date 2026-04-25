import { eq } from "durcno";
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
    let insertedId: number;
    const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
    const uuid2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.UuidTests)
        .values({ uuid: uuid1 })
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
