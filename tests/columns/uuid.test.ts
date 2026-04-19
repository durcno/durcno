import { eq, isNotNull, isNull, ne, uuid, notNull } from "durcno";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanTestData,
  destroyTestContext,
  getDb,
  initTestContext,
  schema,
} from "./setup";

describe("UUID Column Type", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([schema.UuidTests]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // Standard UUID test values
  const uuid1 = "550e8400-e29b-41d4-a716-446655440000";
  const uuid2 = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
  const uuid3 = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

  describe("notNull constraint", () => {
    it("should insert and read required uuid", async () => {
      const db = getDb();
      await db.insert(schema.UuidTests).values({
        requiredUuid: uuid1,
      });

      const [row] = await db.from(schema.UuidTests).select();
      expect(row.requiredUuid).toBe(uuid1);
    });

    it("should allow null for optional uuid", async () => {
      const db = getDb();
      await db.insert(schema.UuidTests).values({
        requiredUuid: uuid1,
        // optionalUuid not provided - should be null
      });

      const [row] = await db.from(schema.UuidTests).select();
      expect(row.optionalUuid).toBeNull();
    });
  });

  describe("create and read", () => {
    it("should handle standard UUID format", async () => {
      const db = getDb();
      await db.insert(schema.UuidTests).values({
        requiredUuid: uuid1,
        optionalUuid: uuid2,
      });

      const [row] = await db.from(schema.UuidTests).select();
      expect(row.requiredUuid).toBe(uuid1);
      expect(row.optionalUuid).toBe(uuid2);
    });

    it("should handle lowercase UUIDs", async () => {
      const db = getDb();
      const lowercase = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d";
      await db.insert(schema.UuidTests).values({
        requiredUuid: lowercase,
      });

      const [row] = await db.from(schema.UuidTests).select();
      expect(row.requiredUuid.toLowerCase()).toBe(lowercase);
    });

    it("should handle uppercase UUIDs", async () => {
      const db = getDb();
      const uppercase = "A1B2C3D4-E5F6-4A5B-8C9D-0E1F2A3B4C5D";
      await db.insert(schema.UuidTests).values({
        requiredUuid: uppercase,
      });

      const [row] = await db.from(schema.UuidTests).select();
      // PostgreSQL normalizes to lowercase
      expect(row.requiredUuid.toLowerCase()).toBe(uppercase.toLowerCase());
    });

    it("should handle multiple rows with different UUIDs", async () => {
      const db = getDb();
      await db
        .insert(schema.UuidTests)
        .values([
          { requiredUuid: uuid1 },
          { requiredUuid: uuid2 },
          { requiredUuid: uuid3 },
        ]);

      const rows = await db.from(schema.UuidTests).select();
      expect(rows).toHaveLength(3);
      const uuids = rows.map((r) => r.requiredUuid);
      expect(uuids).toContain(uuid1);
      expect(uuids).toContain(uuid2);
      expect(uuids).toContain(uuid3);
    });

    it("should return string type for uuid", async () => {
      const db = getDb();
      await db.insert(schema.UuidTests).values({
        requiredUuid: uuid1,
      });

      const [row] = await db.from(schema.UuidTests).select();
      expect(typeof row.requiredUuid).toBe("string");
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      const db = getDb();
      await db.insert(schema.UuidTests).values([
        { requiredUuid: uuid1, optionalUuid: null },
        { requiredUuid: uuid2, optionalUuid: uuid1 },
        { requiredUuid: uuid3, optionalUuid: uuid2 },
      ]);
    });

    it("should filter with eq operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.UuidTests)
        .select()
        .where(eq(schema.UuidTests.requiredUuid, uuid2));

      expect(result).toHaveLength(1);
      expect(result[0].requiredUuid).toBe(uuid2);
    });

    it("should filter with ne operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.UuidTests)
        .select()
        .where(ne(schema.UuidTests.requiredUuid, uuid1));

      expect(result).toHaveLength(2);
    });

    it("should filter with isNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.UuidTests)
        .select()
        .where(isNull(schema.UuidTests.optionalUuid));

      expect(result).toHaveLength(1);
      expect(result[0].requiredUuid).toBe(uuid1);
    });

    it("should filter with isNotNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.UuidTests)
        .select()
        .where(isNotNull(schema.UuidTests.optionalUuid));

      expect(result).toHaveLength(2);
    });

    it("should filter optional uuid with eq operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.UuidTests)
        .select()
        .where(eq(schema.UuidTests.optionalUuid, uuid1));

      expect(result).toHaveLength(1);
      expect(result[0].requiredUuid).toBe(uuid2);
    });
  });

  describe("unique constraint", () => {
    it("should allow unique uuid values", async () => {
      const db = getDb();
      await db.insert(schema.UuidTests).values([
        { requiredUuid: uuid1, uniqueUuid: uuid1 },
        { requiredUuid: uuid2, uniqueUuid: uuid2 },
      ]);

      const rows = await db.from(schema.UuidTests).select();
      expect(rows).toHaveLength(2);
    });

    it("should reject duplicate unique uuid values", async () => {
      const db = getDb();
      await db.insert(schema.UuidTests).values({
        requiredUuid: uuid1,
        uniqueUuid: uuid1,
      });

      await expect(
        db.insert(schema.UuidTests).values({
          requiredUuid: uuid2,
          uniqueUuid: uuid1, // duplicate
        }),
      ).rejects.toThrow();
    });

    it("should allow null for unique uuid (multiple nulls allowed)", async () => {
      const db = getDb();
      await db.insert(schema.UuidTests).values([
        { requiredUuid: uuid1, uniqueUuid: null },
        { requiredUuid: uuid2, uniqueUuid: null },
      ]);

      const rows = await db.from(schema.UuidTests).select();
      expect(rows).toHaveLength(2);
    });
  });

  describe("version option (zod schema)", () => {
    // v4 UUID: version nibble = 4
    const v4Uuid = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    // v1 UUID: version nibble = 1
    const v1Uuid = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";
    // v7 UUID: version nibble = 7
    const v7Uuid = "01903f5a-7a00-7000-8000-000000000000";

    it("should default to v7 validation without version option", () => {
      const col = uuid({ notNull });
      const schema = col.zodTypeScaler;
      expect(schema.safeParse(v7Uuid).success).toBe(true);
      expect(schema.safeParse(v4Uuid).success).toBe(false);
      expect(schema.safeParse(v1Uuid).success).toBe(false);
    });

    it("should only accept v4 UUIDs when version is v4", () => {
      const col = uuid({ notNull, version: "v4" });
      const schema = col.zodTypeScaler;
      expect(schema.safeParse(v4Uuid).success).toBe(true);
      expect(schema.safeParse(v1Uuid).success).toBe(false);
    });

    it("should only accept v1 UUIDs when version is v1", () => {
      const col = uuid({ notNull, version: "v1" });
      const schema = col.zodTypeScaler;
      expect(schema.safeParse(v1Uuid).success).toBe(true);
      expect(schema.safeParse(v4Uuid).success).toBe(false);
    });

    it("should only accept v7 UUIDs when version is v7", () => {
      const col = uuid({ notNull, version: "v7" });
      const schema = col.zodTypeScaler;
      expect(schema.safeParse(v7Uuid).success).toBe(true);
      expect(schema.safeParse(v4Uuid).success).toBe(false);
    });

    it("should reject non-uuid strings regardless of version", () => {
      const col = uuid({ notNull, version: "v4" });
      const schema = col.zodTypeScaler;
      expect(schema.safeParse("not-a-uuid").success).toBe(false);
      expect(schema.safeParse("").success).toBe(false);
    });
  });
});
