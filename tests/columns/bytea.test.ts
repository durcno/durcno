import { eq, isNotNull, isNull, ne } from "durcno";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanTestData,
  destroyTestContext,
  getDb,
  initTestContext,
  schema,
} from "./setup";

describe("Bytea Column Type", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([schema.ByteaTests]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // Test binary data
  const data1 = Buffer.from("Hello, World!");
  const data2 = Buffer.from([0x00, 0x01, 0x02, 0xfe, 0xff]);
  const data3 = Buffer.from("Binary data with special chars: \x00\x01\x02");
  const emptyBuffer = Buffer.alloc(0);
  const largeBuffer = Buffer.alloc(1024, 0xab); // 1KB of 0xAB bytes

  describe("notNull constraint", () => {
    it("should insert and read required bytea", async () => {
      const db = getDb();
      await db.insert(schema.ByteaTests).values({
        requiredData: data1,
      });

      const [row] = await db.from(schema.ByteaTests).select();
      expect(Buffer.isBuffer(row.requiredData)).toBe(true);
      expect(row.requiredData.equals(data1)).toBe(true);
    });

    it("should allow null for optional bytea", async () => {
      const db = getDb();
      await db.insert(schema.ByteaTests).values({
        requiredData: data1,
        // optionalData not provided - should be null
      });

      const [row] = await db.from(schema.ByteaTests).select();
      expect(row.optionalData).toBeNull();
    });
  });

  describe("create and read", () => {
    it("should handle text-based binary data", async () => {
      const db = getDb();
      const textData = Buffer.from("Simple text content");
      await db.insert(schema.ByteaTests).values({
        requiredData: textData,
      });

      const [row] = await db.from(schema.ByteaTests).select();
      expect(row.requiredData.toString()).toBe("Simple text content");
    });

    it("should handle binary data with null bytes", async () => {
      const db = getDb();
      await db.insert(schema.ByteaTests).values({
        requiredData: data2,
      });

      const [row] = await db.from(schema.ByteaTests).select();
      expect(row.requiredData.equals(data2)).toBe(true);
      expect(row.requiredData[0]).toBe(0x00);
      expect(row.requiredData[4]).toBe(0xff);
    });

    it("should handle empty buffer", async () => {
      const db = getDb();
      await db.insert(schema.ByteaTests).values({
        requiredData: emptyBuffer,
      });

      const [row] = await db.from(schema.ByteaTests).select();
      expect(Buffer.isBuffer(row.requiredData)).toBe(true);
      expect(row.requiredData.length).toBe(0);
    });

    it("should handle large binary data", async () => {
      const db = getDb();
      await db.insert(schema.ByteaTests).values({
        requiredData: largeBuffer,
      });

      const [row] = await db.from(schema.ByteaTests).select();
      expect(row.requiredData.equals(largeBuffer)).toBe(true);
      expect(row.requiredData.length).toBe(1024);
    });

    it("should handle special characters in binary data", async () => {
      const db = getDb();
      await db.insert(schema.ByteaTests).values({
        requiredData: data3,
      });

      const [row] = await db.from(schema.ByteaTests).select();
      expect(row.requiredData.equals(data3)).toBe(true);
    });

    it("should handle multiple rows with different binary data", async () => {
      const db = getDb();
      await db
        .insert(schema.ByteaTests)
        .values([
          { requiredData: data1 },
          { requiredData: data2 },
          { requiredData: data3 },
        ]);

      const rows = await db.from(schema.ByteaTests).select();
      expect(rows).toHaveLength(3);
      expect(rows[0].requiredData.equals(data1)).toBe(true);
      expect(rows[1].requiredData.equals(data2)).toBe(true);
      expect(rows[2].requiredData.equals(data3)).toBe(true);
    });

    it("should return Buffer type", async () => {
      const db = getDb();
      await db.insert(schema.ByteaTests).values({
        requiredData: data1,
      });

      const [row] = await db.from(schema.ByteaTests).select();
      expect(row.requiredData).toBeInstanceOf(Buffer);
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      const db = getDb();
      await db.insert(schema.ByteaTests).values([
        { requiredData: data1, optionalData: null },
        { requiredData: data2, optionalData: data1 },
        { requiredData: data3, optionalData: data2 },
      ]);
    });

    it("should filter with eq operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.ByteaTests)
        .select()
        .where(eq(schema.ByteaTests.requiredData, data2));

      expect(result).toHaveLength(1);
      expect(result[0].requiredData.equals(data2)).toBe(true);
    });

    it("should filter with ne operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.ByteaTests)
        .select()
        .where(ne(schema.ByteaTests.requiredData, data1));

      expect(result).toHaveLength(2);
    });

    it("should filter with isNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.ByteaTests)
        .select()
        .where(isNull(schema.ByteaTests.optionalData));

      expect(result).toHaveLength(1);
      expect(result[0].requiredData.equals(data1)).toBe(true);
    });

    it("should filter with isNotNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.ByteaTests)
        .select()
        .where(isNotNull(schema.ByteaTests.optionalData));

      expect(result).toHaveLength(2);
    });
  });

  describe("unique constraint", () => {
    it("should allow unique bytea values", async () => {
      const db = getDb();
      await db.insert(schema.ByteaTests).values([
        { requiredData: data1, uniqueHash: data1 },
        { requiredData: data2, uniqueHash: data2 },
      ]);

      const rows = await db.from(schema.ByteaTests).select();
      expect(rows).toHaveLength(2);
    });

    it("should reject duplicate unique bytea values", async () => {
      const db = getDb();
      await db.insert(schema.ByteaTests).values({
        requiredData: data1,
        uniqueHash: data1,
      });

      await expect(
        db.insert(schema.ByteaTests).values({
          requiredData: data2,
          uniqueHash: data1, // duplicate
        }),
      ).rejects.toThrow();
    });

    it("should allow null for unique bytea (multiple nulls allowed)", async () => {
      const db = getDb();
      await db.insert(schema.ByteaTests).values([
        { requiredData: data1, uniqueHash: null },
        { requiredData: data2, uniqueHash: null },
      ]);

      const rows = await db.from(schema.ByteaTests).select();
      expect(rows).toHaveLength(2);
    });
  });

  describe("binary data integrity", () => {
    it("should preserve exact binary content on round-trip", async () => {
      const db = getDb();
      // Create a buffer with all possible byte values (0-255)
      const allBytes = Buffer.alloc(256);
      for (let i = 0; i < 256; i++) {
        allBytes[i] = i;
      }

      await db.insert(schema.ByteaTests).values({
        requiredData: allBytes,
      });

      const [row] = await db.from(schema.ByteaTests).select();
      expect(row.requiredData.equals(allBytes)).toBe(true);
      for (let i = 0; i < 256; i++) {
        expect(row.requiredData[i]).toBe(i);
      }
    });

    it("should handle binary data that looks like SQL", async () => {
      const db = getDb();
      const sqlLike = Buffer.from("'; DROP TABLE users; --");
      await db.insert(schema.ByteaTests).values({
        requiredData: sqlLike,
      });

      const [row] = await db.from(schema.ByteaTests).select();
      expect(row.requiredData.toString()).toBe("'; DROP TABLE users; --");
    });
  });
});
