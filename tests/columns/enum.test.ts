import { eq } from "durcno";
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

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.EnumTests)
        .values({ status: "active" })
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
