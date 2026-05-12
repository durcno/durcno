import { eq } from "durcno";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyTestContext, getDb, initTestContext, schema } from "./setup";

describe("JSON/JSONB Column Types", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  afterAll(async () => {
    await destroyTestContext();
  });

  // ==========================================================================
  // JSON
  // ==========================================================================

  describe("json", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.JsonTests)
        .values({ data: { key: "value", count: 1 } })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.JsonTests)
        .select()
        .where(eq(schema.JsonTests.id, insertedId));
      expect(row.data).toEqual({ key: "value", count: 1 });
      expect(row.dataWithDefault).toEqual({ status: "default" });
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.JsonTests)
        .set({ data: { key: "updated" } })
        .where(eq(schema.JsonTests.id, insertedId));
      const [row] = await db
        .from(schema.JsonTests)
        .select()
        .where(eq(schema.JsonTests.id, insertedId));
      expect(row.data).toEqual({ key: "updated" });
    });
  });

  // ==========================================================================
  // JSONB
  // ==========================================================================

  describe("jsonb", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.JsonbTests)
        .values({ data: { key: "value", count: 1 } })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.JsonbTests)
        .select()
        .where(eq(schema.JsonbTests.id, insertedId));
      expect(row.data).toEqual({ key: "value", count: 1 });
      expect(row.dataWithDefault).toEqual({ status: "default" });
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.JsonbTests)
        .set({ data: { key: "updated" } })
        .where(eq(schema.JsonbTests.id, insertedId));
      const [row] = await db
        .from(schema.JsonbTests)
        .select()
        .where(eq(schema.JsonbTests.id, insertedId));
      expect(row.data).toEqual({ key: "updated" });
    });
  });
});
