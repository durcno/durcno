import { isNotNull, isNull } from "durcno";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanTestData,
  destroyTestContext,
  getDb,
  initTestContext,
  schema,
} from "./setup";

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
    beforeEach(async () => {
      await cleanTestData([schema.JsonTests]);
    });

    describe("notNull constraint", () => {
      it("should insert and read required json object", async () => {
        const db = getDb();
        const data = { key: "value", count: 42 };
        await db.insert(schema.JsonTests).values({
          requiredData: data,
        });

        const [row] = await db.from(schema.JsonTests).select();
        expect(row.requiredData).toEqual(data);
      });

      it("should allow null for optional json", async () => {
        const db = getDb();
        await db.insert(schema.JsonTests).values({
          requiredData: { test: true },
          // optionalData not provided - should be null
        });

        const [row] = await db.from(schema.JsonTests).select();
        expect(row.optionalData).toBeNull();
      });
    });

    describe("default value", () => {
      it("should use default value when not provided", async () => {
        const db = getDb();
        await db.insert(schema.JsonTests).values({
          requiredData: { test: true },
        });

        const [row] = await db.from(schema.JsonTests).select();
        expect(row.withDefault).toEqual({ status: "default" });
      });

      it("should override default when value provided", async () => {
        const db = getDb();
        await db.insert(schema.JsonTests).values({
          requiredData: { test: true },
          withDefault: { status: "custom" },
        });

        const [row] = await db.from(schema.JsonTests).select();
        expect(row.withDefault).toEqual({ status: "custom" });
      });
    });

    describe("create and read", () => {
      it("should handle various JSON values", async () => {
        const db = getDb();
        const testCases = [
          // Object
          { requiredData: { nested: { deep: true }, array: [1, 2, 3] } },
          // Array at root
          { requiredData: [1, "two", { three: 3 }] },
          // String
          { requiredData: "just a string" },
          // Number
          { requiredData: 42.5 },
          // Boolean
          { requiredData: true },
          // Empty object
          { requiredData: {} },
          // Empty array
          { requiredData: [] },
        ];

        for (const tc of testCases) {
          await cleanTestData([schema.JsonTests]);
          await db.insert(schema.JsonTests).values(tc);
          const [row] = await db.from(schema.JsonTests).select();
          expect(row.requiredData).toEqual(tc.requiredData);
        }
      });

      it("should handle complex nested structures", async () => {
        const db = getDb();
        const complexData = {
          users: [
            { id: 1, name: "Alice", roles: ["admin", "user"] },
            { id: 2, name: "Bob", roles: ["user"] },
          ],
          metadata: {
            version: "1.0.0",
            created: "2024-01-01",
            config: {
              enabled: true,
              limits: { max: 100, min: 0 },
            },
          },
        };

        await db.insert(schema.JsonTests).values({
          requiredData: complexData,
        });

        const [row] = await db.from(schema.JsonTests).select();
        expect(row.requiredData).toEqual(complexData);
      });

      it("should handle special characters in JSON strings", async () => {
        const db = getDb();
        const data = {
          message: "Hello 'world' with \"quotes\"",
          path: "C:\\Users\\test",
          unicode: "émoji 🎉 中文",
          newlines: "line1\nline2\ttabbed",
        };

        await db.insert(schema.JsonTests).values({
          requiredData: data,
        });

        const [row] = await db.from(schema.JsonTests).select();
        expect(row.requiredData).toEqual(data);
      });

      it("should handle large numbers", async () => {
        const db = getDb();
        const data = {
          bigInt: 9007199254740991, // Number.MAX_SAFE_INTEGER
          decimal: 3.141592653589793,
          negative: -999999999,
        };

        await db.insert(schema.JsonTests).values({
          requiredData: data,
        });

        const [row] = await db.from(schema.JsonTests).select();
        expect(row.requiredData).toEqual(data);
      });
    });

    describe("null handling", () => {
      it("should distinguish between null and undefined", async () => {
        const db = getDb();

        // Insert with explicit null in optional field
        await db.insert(schema.JsonTests).values({
          requiredData: { key: "value" },
          optionalData: null,
        });

        const [row] = await db.from(schema.JsonTests).select();
        expect(row.optionalData).toBeNull();
      });

      it("should handle null values inside JSON", async () => {
        const db = getDb();
        const data = {
          nullField: null,
          validField: "value",
        };

        await db.insert(schema.JsonTests).values({
          requiredData: data,
        });

        const [row] = await db.from(schema.JsonTests).select();
        expect(row.requiredData).toEqual(data);
      });
    });

    describe("filtering", () => {
      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.JsonTests).values([
          { requiredData: { type: "a" }, optionalData: { enabled: true } },
          { requiredData: { type: "b" }, optionalData: null },
          { requiredData: { type: "c" }, optionalData: { enabled: false } },
        ]);
      });

      it("should filter with isNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.JsonTests)
          .select()
          .where(isNull(schema.JsonTests.optionalData));

        expect(result).toHaveLength(1);
        expect(result[0].requiredData).toEqual({ type: "b" });
      });

      it("should filter with isNotNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.JsonTests)
          .select()
          .where(isNotNull(schema.JsonTests.optionalData));

        expect(result).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // JSONB
  // ==========================================================================

  describe("jsonb", () => {
    beforeEach(async () => {
      await cleanTestData([schema.JsonbTests]);
    });

    describe("notNull constraint", () => {
      it("should insert and read required jsonb object", async () => {
        const db = getDb();
        const data = { key: "value", count: 42 };
        await db.insert(schema.JsonbTests).values({
          requiredData: data,
        });

        const [row] = await db.from(schema.JsonbTests).select();
        expect(row.requiredData).toEqual(data);
      });

      it("should allow null for optional jsonb", async () => {
        const db = getDb();
        await db.insert(schema.JsonbTests).values({
          requiredData: { test: true },
          // optionalData not provided - should be null
        });

        const [row] = await db.from(schema.JsonbTests).select();
        expect(row.optionalData).toBeNull();
      });
    });

    describe("default value", () => {
      it("should use default value when not provided", async () => {
        const db = getDb();
        await db.insert(schema.JsonbTests).values({
          requiredData: { test: true },
        });

        const [row] = await db.from(schema.JsonbTests).select();
        expect(row.withDefault).toEqual({ status: "default" });
      });

      it("should override default when value provided", async () => {
        const db = getDb();
        await db.insert(schema.JsonbTests).values({
          requiredData: { test: true },
          withDefault: { status: "custom" },
        });

        const [row] = await db.from(schema.JsonbTests).select();
        expect(row.withDefault).toEqual({ status: "custom" });
      });
    });

    describe("create and read", () => {
      it("should handle various JSON values", async () => {
        const db = getDb();
        const testCases = [
          // Object
          { requiredData: { nested: { deep: true }, array: [1, 2, 3] } },
          // Array at root
          { requiredData: [1, "two", { three: 3 }] },
          // String
          { requiredData: "just a string" },
          // Number
          { requiredData: 42.5 },
          // Boolean
          { requiredData: true },
          // Empty object
          { requiredData: {} },
          // Empty array
          { requiredData: [] },
        ];

        for (const tc of testCases) {
          await cleanTestData([schema.JsonbTests]);
          await db.insert(schema.JsonbTests).values(tc);
          const [row] = await db.from(schema.JsonbTests).select();
          expect(row.requiredData).toEqual(tc.requiredData);
        }
      });

      it("should handle complex nested structures", async () => {
        const db = getDb();
        const complexData = {
          users: [
            { id: 1, name: "Alice", roles: ["admin", "user"] },
            { id: 2, name: "Bob", roles: ["user"] },
          ],
          metadata: {
            version: "1.0.0",
            created: "2024-01-01",
            config: {
              enabled: true,
              limits: { max: 100, min: 0 },
            },
          },
        };

        await db.insert(schema.JsonbTests).values({
          requiredData: complexData,
        });

        const [row] = await db.from(schema.JsonbTests).select();
        expect(row.requiredData).toEqual(complexData);
      });

      it("should handle special characters in JSONB strings", async () => {
        const db = getDb();
        const data = {
          message: "Hello 'world' with \"quotes\"",
          path: "C:\\Users\\test",
          unicode: "émoji 🎉 中文",
          newlines: "line1\nline2\ttabbed",
        };

        await db.insert(schema.JsonbTests).values({
          requiredData: data,
        });

        const [row] = await db.from(schema.JsonbTests).select();
        expect(row.requiredData).toEqual(data);
      });
    });

    describe("null handling", () => {
      it("should distinguish between null and undefined", async () => {
        const db = getDb();

        // Insert with explicit null in optional field
        await db.insert(schema.JsonbTests).values({
          requiredData: { key: "value" },
          optionalData: null,
        });

        const [row] = await db.from(schema.JsonbTests).select();
        expect(row.optionalData).toBeNull();
      });

      it("should handle null values inside JSONB", async () => {
        const db = getDb();
        const data = {
          nullField: null,
          validField: "value",
        };

        await db.insert(schema.JsonbTests).values({
          requiredData: data,
        });

        const [row] = await db.from(schema.JsonbTests).select();
        expect(row.requiredData).toEqual(data);
      });
    });

    describe("filtering", () => {
      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.JsonbTests).values([
          { requiredData: { type: "a" }, optionalData: { enabled: true } },
          { requiredData: { type: "b" }, optionalData: null },
          { requiredData: { type: "c" }, optionalData: { enabled: false } },
        ]);
      });

      it("should filter with isNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.JsonbTests)
          .select()
          .where(isNull(schema.JsonbTests.optionalData));

        expect(result).toHaveLength(1);
        expect(result[0].requiredData).toEqual({ type: "b" });
      });

      it("should filter with isNotNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.JsonbTests)
          .select()
          .where(isNotNull(schema.JsonbTests.optionalData));

        expect(result).toHaveLength(2);
      });
    });
  });

  // ==========================================================================
  // TYPED JSON
  // ==========================================================================

  describe("typed json", () => {
    beforeEach(async () => {
      await cleanTestData([schema.TypedJsonTests]);
    });

    it("should insert and read typed json values", async () => {
      const db = getDb();
      const settings: schema.UserSettings = {
        theme: "dark",
        notifications: true,
        language: "en",
      };

      await db.insert(schema.TypedJsonTests).values({
        requiredSettings: settings,
      });

      const [row] = await db.from(schema.TypedJsonTests).select();
      expect(row.requiredSettings).toEqual(settings);
    });

    it("should handle optional typed json as null", async () => {
      const db = getDb();
      await db.insert(schema.TypedJsonTests).values({
        requiredSettings: {
          theme: "light",
          notifications: false,
          language: "fr",
        },
      });

      const [row] = await db.from(schema.TypedJsonTests).select();
      expect(row.optionalSettings).toBeNull();
    });

    it("should override optional typed json", async () => {
      const db = getDb();
      const settings: schema.UserSettings = {
        theme: "dark",
        notifications: true,
        language: "de",
      };

      await db.insert(schema.TypedJsonTests).values({
        requiredSettings: {
          theme: "light",
          notifications: false,
          language: "en",
        },
        optionalSettings: settings,
      });

      const [row] = await db.from(schema.TypedJsonTests).select();
      expect(row.optionalSettings).toEqual(settings);
    });
  });

  // ==========================================================================
  // TYPED JSONB
  // ==========================================================================

  describe("typed jsonb", () => {
    beforeEach(async () => {
      await cleanTestData([schema.TypedJsonbTests]);
    });

    it("should insert and read typed jsonb values", async () => {
      const db = getDb();
      const settings: schema.UserSettings = {
        theme: "dark",
        notifications: true,
        language: "en",
      };

      await db.insert(schema.TypedJsonbTests).values({
        requiredSettings: settings,
      });

      const [row] = await db.from(schema.TypedJsonbTests).select();
      expect(row.requiredSettings).toEqual(settings);
    });

    it("should handle optional typed jsonb as null", async () => {
      const db = getDb();
      await db.insert(schema.TypedJsonbTests).values({
        requiredSettings: {
          theme: "light",
          notifications: false,
          language: "fr",
        },
      });

      const [row] = await db.from(schema.TypedJsonbTests).select();
      expect(row.optionalSettings).toBeNull();
    });

    it("should override optional typed jsonb", async () => {
      const db = getDb();
      const settings: schema.UserSettings = {
        theme: "dark",
        notifications: true,
        language: "de",
      };

      await db.insert(schema.TypedJsonbTests).values({
        requiredSettings: {
          theme: "light",
          notifications: false,
          language: "en",
        },
        optionalSettings: settings,
      });

      const [row] = await db.from(schema.TypedJsonbTests).select();
      expect(row.optionalSettings).toEqual(settings);
    });
  });
});
