import { eq } from "durcno";
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
    let insertedId: number;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.BooleanTests)
        .values({ flag: true })
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
