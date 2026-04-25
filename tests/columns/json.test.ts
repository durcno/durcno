import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyTestContext, getDb, initTestContext, schema } from "./setup";
import { eq } from "durcno";

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
    let insertedId: number;

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
    let insertedId: number;

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

  // ==========================================================================
  // TYPED JSON
  // ==========================================================================

  describe("typed json", () => {
    let insertedId: number;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.TypedJsonTests)
        .values({
          settings: { theme: "dark", notifications: true, language: "en" },
        })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.TypedJsonTests)
        .select()
        .where(eq(schema.TypedJsonTests.id, insertedId));
      expect(row.settings).toEqual({
        theme: "dark",
        notifications: true,
        language: "en",
      });
      expect(row.settingsWithDefault).toEqual({
        theme: "light",
        notifications: false,
        language: "en",
      });
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.TypedJsonTests)
        .set({
          settings: { theme: "light", notifications: false, language: "fr" },
        })
        .where(eq(schema.TypedJsonTests.id, insertedId));
      const [row] = await db
        .from(schema.TypedJsonTests)
        .select()
        .where(eq(schema.TypedJsonTests.id, insertedId));
      expect(row.settings).toEqual({
        theme: "light",
        notifications: false,
        language: "fr",
      });
    });
  });

  // ==========================================================================
  // TYPED JSONB
  // ==========================================================================

  describe("typed jsonb", () => {
    let insertedId: number;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.TypedJsonbTests)
        .values({
          settings: { theme: "dark", notifications: true, language: "en" },
        })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.TypedJsonbTests)
        .select()
        .where(eq(schema.TypedJsonbTests.id, insertedId));
      expect(row.settings).toEqual({
        theme: "dark",
        notifications: true,
        language: "en",
      });
      expect(row.settingsWithDefault).toEqual({
        theme: "light",
        notifications: false,
        language: "en",
      });
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.TypedJsonbTests)
        .set({
          settings: { theme: "light", notifications: false, language: "de" },
        })
        .where(eq(schema.TypedJsonbTests.id, insertedId));
      const [row] = await db
        .from(schema.TypedJsonbTests)
        .select()
        .where(eq(schema.TypedJsonbTests.id, insertedId));
      expect(row.settings).toEqual({
        theme: "light",
        notifications: false,
        language: "de",
      });
    });
  });
});
