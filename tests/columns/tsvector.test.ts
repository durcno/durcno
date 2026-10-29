import { eq } from "durcno";
import { createInsertSchema } from "durcno/validators/zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyTestContext, getDb, initTestContext, schema } from "./setup";

describe("tsvector Column Type", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  afterAll(async () => {
    await destroyTestContext();
  });

  describe("tsvector", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.TsvectorTests);
    const search = "'fat':2 'rat':3";

    it("zod insert schema", () => {
      expect(() =>
        zodSchema.parse({ search: 123, requiredSearch: search }),
      ).toThrow();
      expect(() => zodSchema.parse({ search })).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insertInto(schema.TsvectorTests)
        .values(zodSchema.parse({ search, requiredSearch: search }))
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.TsvectorTests)
        .select("*")
        .where(() => eq(schema.TsvectorTests.id, insertedId));
      expect(row.search).toBe(search);
      expect(row.requiredSearch).toBe(search);
    });

    it("update with null", async () => {
      const db = getDb();
      await db
        .update(schema.TsvectorTests)
        .set({ search: null })
        .where(eq(schema.TsvectorTests.id, insertedId));
      const [row] = await db
        .from(schema.TsvectorTests)
        .select("*")
        .where(() => eq(schema.TsvectorTests.id, insertedId));
      expect(row.search).toBeNull();
      expect(row.requiredSearch).toBe(search);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.TsvectorTests)
        .set({ search: "'cat':1" })
        .where(eq(schema.TsvectorTests.id, insertedId));
      const [row] = await db
        .from(schema.TsvectorTests)
        .select("*")
        .where(() => eq(schema.TsvectorTests.id, insertedId));
      expect(row.search).toBe("'cat':1");
    });
  });
});
