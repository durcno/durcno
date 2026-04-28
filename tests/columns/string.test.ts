import { eq } from "durcno";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyTestContext, getDb, initTestContext, schema } from "./setup";

describe("String Column Types", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  afterAll(async () => {
    await destroyTestContext();
  });

  // ==========================================================================
  // VARCHAR
  // ==========================================================================

  describe("varchar", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.VarcharTests)
        .values({ name: "alice" })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.VarcharTests)
        .select()
        .where(eq(schema.VarcharTests.id, insertedId));
      expect(row.name).toBe("alice");
      expect(row.nameWithDefault).toBe("default_value");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.VarcharTests)
        .set({ name: "bob" })
        .where(eq(schema.VarcharTests.id, insertedId));
      const [row] = await db
        .from(schema.VarcharTests)
        .select()
        .where(eq(schema.VarcharTests.id, insertedId));
      expect(row.name).toBe("bob");
    });
  });

  // ==========================================================================
  // TEXT
  // ==========================================================================

  describe("text", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.TextTests)
        .values({ content: "hello world" })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.TextTests)
        .select()
        .where(eq(schema.TextTests.id, insertedId));
      expect(row.content).toBe("hello world");
      expect(row.contentWithDefault).toBe("default text");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.TextTests)
        .set({ content: "updated content" })
        .where(eq(schema.TextTests.id, insertedId));
      const [row] = await db
        .from(schema.TextTests)
        .select()
        .where(eq(schema.TextTests.id, insertedId));
      expect(row.content).toBe("updated content");
    });
  });

  // ==========================================================================
  // CHAR
  // ==========================================================================

  describe("char", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.CharTests)
        .values({ code: "HELLO" })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.CharTests)
        .select()
        .where(eq(schema.CharTests.id, insertedId));
      expect(row.code).toBe("HELLO");
      expect(row.codeWithDefault).toBe("XX");
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.CharTests)
        .set({ code: "WORLD" })
        .where(eq(schema.CharTests.id, insertedId));
      const [row] = await db
        .from(schema.CharTests)
        .select()
        .where(eq(schema.CharTests.id, insertedId));
      expect(row.code).toBe("WORLD");
    });
  });
});
