import {
  arrayAll,
  arrayContainedBy,
  arrayContains,
  arrayHas,
  arrayOverlaps,
  eq,
  isNotNull,
  isNull,
} from "durcno";
import { createInsertSchema } from "durcno/validators/zod";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanTestData,
  destroyTestContext,
  getDb,
  initTestContext,
  schema,
} from "./setup";

describe("Array Column Types", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  afterAll(async () => {
    await destroyTestContext();
  });

  // ==========================================================================
  // varchar[] — 1D variable-length string array
  // ==========================================================================

  describe("varchar[]", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.SimpleArrayTests);

    it("zod insert schema", () => {
      expect(() =>
        zodSchema.parse({
          requiredTags: "not-an-array",
          requiredScores: [1, 2],
        }),
      ).toThrow();
      expect(() =>
        zodSchema.parse({ requiredTags: [1, 2], requiredScores: [1, 2] }),
      ).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.SimpleArrayTests)
        .values(
          zodSchema.parse({
            requiredTags: ["a", "b", "c"],
            requiredScores: [1],
          }),
        )
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(eq(schema.SimpleArrayTests.id, insertedId));
      expect(row.requiredTags).toEqual(["a", "b", "c"]);
      expect(row.optionalTags).toBeNull();
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.SimpleArrayTests)
        .set({ requiredTags: ["x", "y"] })
        .where(eq(schema.SimpleArrayTests.id, insertedId));
      const [row] = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(eq(schema.SimpleArrayTests.id, insertedId));
      expect(row.requiredTags).toEqual(["x", "y"]);
    });

    it("update to empty array", async () => {
      const db = getDb();
      await db
        .update(schema.SimpleArrayTests)
        .set({ requiredTags: [] })
        .where(eq(schema.SimpleArrayTests.id, insertedId));
      const [row] = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(eq(schema.SimpleArrayTests.id, insertedId));
      expect(row.requiredTags).toEqual([]);
    });

    it("optional column accepts values", async () => {
      const db = getDb();
      await db
        .update(schema.SimpleArrayTests)
        .set({ optionalTags: ["opt1", "opt2"] })
        .where(eq(schema.SimpleArrayTests.id, insertedId));
      const [row] = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(eq(schema.SimpleArrayTests.id, insertedId));
      expect(row.optionalTags).toEqual(["opt1", "opt2"]);
    });

    it("optional column updated to null", async () => {
      const db = getDb();
      await db
        .update(schema.SimpleArrayTests)
        .set({ optionalTags: null })
        .where(eq(schema.SimpleArrayTests.id, insertedId));
      const [row] = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(eq(schema.SimpleArrayTests.id, insertedId));
      expect(row.optionalTags).toBeNull();
    });
  });

  // ==========================================================================
  // integer[] — 1D variable-length integer array
  // ==========================================================================

  describe("integer[]", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.SimpleArrayTests)
        .values({ requiredTags: ["t"], requiredScores: [10, -20, 0, 100] })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(eq(schema.SimpleArrayTests.id, insertedId));
      expect(row.requiredScores).toEqual([10, -20, 0, 100]);
      expect(row.optionalScores).toBeNull();
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.SimpleArrayTests)
        .set({ requiredScores: [99, 100] })
        .where(eq(schema.SimpleArrayTests.id, insertedId));
      const [row] = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(eq(schema.SimpleArrayTests.id, insertedId));
      expect(row.requiredScores).toEqual([99, 100]);
    });
  });

  // ==========================================================================
  // integer[3] — 1D fixed-length integer tuple
  // ==========================================================================

  describe("integer[3]", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.FixedArrayTests);

    it("zod insert schema", () => {
      expect(() =>
        zodSchema.parse({ requiredCoords: [1, 2], requiredPair: ["a", "b"] }),
      ).toThrow();
      expect(() =>
        zodSchema.parse({
          requiredCoords: "not-array",
          requiredPair: ["a", "b"],
        }),
      ).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.FixedArrayTests)
        .values(
          zodSchema.parse({
            requiredCoords: [10, 20, 30],
            requiredPair: ["a", "b"],
          }),
        )
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.FixedArrayTests)
        .select()
        .where(eq(schema.FixedArrayTests.id, insertedId));
      expect(row.requiredCoords).toEqual([10, 20, 30]);
      expect(row.optionalCoords).toBeNull();
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.FixedArrayTests)
        .set({ requiredCoords: [-1, 0, 1] })
        .where(eq(schema.FixedArrayTests.id, insertedId));
      const [row] = await db
        .from(schema.FixedArrayTests)
        .select()
        .where(eq(schema.FixedArrayTests.id, insertedId));
      expect(row.requiredCoords).toEqual([-1, 0, 1]);
    });
  });

  // ==========================================================================
  // varchar[2] — 1D fixed-length string tuple
  // ==========================================================================

  describe("varchar[2]", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.FixedArrayTests)
        .values({
          requiredCoords: [1, 2, 3],
          requiredPair: ["hello", "world"],
        })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.FixedArrayTests)
        .select()
        .where(eq(schema.FixedArrayTests.id, insertedId));
      expect(row.requiredPair).toEqual(["hello", "world"]);
      expect(row.optionalPair).toBeNull();
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.FixedArrayTests)
        .set({ requiredPair: ["updated", "pair"] })
        .where(eq(schema.FixedArrayTests.id, insertedId));
      const [row] = await db
        .from(schema.FixedArrayTests)
        .select()
        .where(eq(schema.FixedArrayTests.id, insertedId));
      expect(row.requiredPair).toEqual(["updated", "pair"]);
    });
  });

  // ==========================================================================
  // integer[][] — 2D variable-length integer array
  // ==========================================================================

  describe("integer[][]", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.MultidimensionalArrayTests);

    it("zod insert schema", () => {
      expect(() =>
        zodSchema.parse({
          requiredMatrix: "not-array",
          requiredVectors: [[1, 2]],
        }),
      ).toThrow();
      expect(() =>
        zodSchema.parse({
          requiredMatrix: [[1, 2]],
          requiredVectors: "not-array",
        }),
      ).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.MultidimensionalArrayTests)
        .values(
          zodSchema.parse({
            requiredMatrix: [
              [1, 2, 3],
              [4, 5, 6],
            ],
            requiredVectors: [
              [1, 2],
              [3, 4],
            ],
          }),
        )
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.MultidimensionalArrayTests)
        .select()
        .where(eq(schema.MultidimensionalArrayTests.id, insertedId));
      expect(row.requiredMatrix).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
      expect(row.optionalMatrix).toBeNull();
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.MultidimensionalArrayTests)
        .set({
          requiredMatrix: [
            [10, 20],
            [30, 40],
          ],
        })
        .where(eq(schema.MultidimensionalArrayTests.id, insertedId));
      const [row] = await db
        .from(schema.MultidimensionalArrayTests)
        .select()
        .where(eq(schema.MultidimensionalArrayTests.id, insertedId));
      expect(row.requiredMatrix).toEqual([
        [10, 20],
        [30, 40],
      ]);
    });

    it("update to empty outer array", async () => {
      const db = getDb();
      await db
        .update(schema.MultidimensionalArrayTests)
        .set({ requiredMatrix: [] })
        .where(eq(schema.MultidimensionalArrayTests.id, insertedId));
      const [row] = await db
        .from(schema.MultidimensionalArrayTests)
        .select()
        .where(eq(schema.MultidimensionalArrayTests.id, insertedId));
      expect(row.requiredMatrix).toEqual([]);
    });
  });

  // ==========================================================================
  // [number, number][] — 2D fixed-inner integer array
  // ==========================================================================

  describe("[number, number][]", () => {
    let insertedId: bigint;

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.MultidimensionalArrayTests)
        .values({
          requiredMatrix: [[0]],
          requiredVectors: [
            [10, 20],
            [30, 40],
            [50, 60],
          ],
        })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.MultidimensionalArrayTests)
        .select()
        .where(eq(schema.MultidimensionalArrayTests.id, insertedId));
      expect(row.requiredVectors).toEqual([
        [10, 20],
        [30, 40],
        [50, 60],
      ]);
      expect(row.optionalVectors).toBeNull();
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.MultidimensionalArrayTests)
        .set({ requiredVectors: [[-1, -2]] })
        .where(eq(schema.MultidimensionalArrayTests.id, insertedId));
      const [row] = await db
        .from(schema.MultidimensionalArrayTests)
        .select()
        .where(eq(schema.MultidimensionalArrayTests.id, insertedId));
      expect(row.requiredVectors).toEqual([[-1, -2]]);
    });
  });

  // ==========================================================================
  // StatusEnum[] — 1D enum array
  // ==========================================================================

  describe("StatusEnum[]", () => {
    let insertedId: bigint;
    const zodSchema = createInsertSchema(schema.EnumArrayTests);

    it("zod insert schema", () => {
      expect(() =>
        zodSchema.parse({
          requiredStatuses: ["unknown"],
          requiredPriorities: ["low"],
        }),
      ).toThrow();
      expect(() =>
        zodSchema.parse({ requiredStatuses: 123, requiredPriorities: ["low"] }),
      ).toThrow();
    });

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.EnumArrayTests)
        .values(
          zodSchema.parse({
            requiredStatuses: ["active", "pending"],
            requiredPriorities: ["high"],
          }),
        )
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.EnumArrayTests)
        .select()
        .where(eq(schema.EnumArrayTests.id, insertedId));
      expect(row.requiredStatuses).toEqual(["active", "pending"]);
      expect(row.optionalStatuses).toBeNull();
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.EnumArrayTests)
        .set({ requiredStatuses: ["inactive"] })
        .where(eq(schema.EnumArrayTests.id, insertedId));
      const [row] = await db
        .from(schema.EnumArrayTests)
        .select()
        .where(eq(schema.EnumArrayTests.id, insertedId));
      expect(row.requiredStatuses).toEqual(["inactive"]);
    });

    it("empty enum array", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.EnumArrayTests)
        .values({ requiredStatuses: [], requiredPriorities: [] })
        .returning({ id: true });
      const [fetched] = await db
        .from(schema.EnumArrayTests)
        .select()
        .where(eq(schema.EnumArrayTests.id, row.id));
      expect(fetched.requiredStatuses).toEqual([]);
    });
  });

  // ==========================================================================
  // Array filters on varchar[]: arrayContains, arrayContainedBy, arrayOverlaps
  // ==========================================================================

  describe("array filters on varchar[]", () => {
    beforeEach(async () => {
      await cleanTestData([schema.SimpleArrayTests]);
      const db = getDb();
      await db.insert(schema.SimpleArrayTests).values([
        { requiredTags: ["a", "b"], requiredScores: [1, 2] },
        { requiredTags: ["b", "c"], requiredScores: [2, 3] },
        { requiredTags: ["d", "e"], requiredScores: [4, 5] },
      ]);
    });

    it("arrayContains: col @> values — all specified elements must be present", async () => {
      const db = getDb();
      const result = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(arrayContains(schema.SimpleArrayTests.requiredTags, ["a", "b"]));
      expect(result).toHaveLength(1);
      expect(result[0].requiredTags).toEqual(["a", "b"]);
    });

    it("arrayContainedBy: col <@ values — col must be a subset", async () => {
      const db = getDb();
      const result = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(
          arrayContainedBy(schema.SimpleArrayTests.requiredTags, [
            "a",
            "b",
            "c",
          ]),
        );
      // ["a","b"] ⊆ ["a","b","c"] ✓ and ["b","c"] ⊆ ["a","b","c"] ✓
      expect(result).toHaveLength(2);
    });

    it("arrayOverlaps: col && values — at least one element in common", async () => {
      const db = getDb();
      const result = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(arrayOverlaps(schema.SimpleArrayTests.requiredTags, ["a", "d"]));
      // ["a","b"] shares "a" ✓ and ["d","e"] shares "d" ✓
      expect(result).toHaveLength(2);
    });

    it("isNull on optional column", async () => {
      const db = getDb();
      const result = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(isNull(schema.SimpleArrayTests.optionalTags));
      expect(result).toHaveLength(3);
    });

    it("isNotNull on optional column", async () => {
      const db = getDb();
      await getDb()
        .update(schema.SimpleArrayTests)
        .set({ optionalTags: ["x"] })
        .where(arrayContains(schema.SimpleArrayTests.requiredTags, ["a"]));
      const result = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(isNotNull(schema.SimpleArrayTests.optionalTags));
      expect(result).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Array filters on integer[]: arrayHas, arrayAll
  // ==========================================================================

  describe("array filters on integer[]", () => {
    beforeEach(async () => {
      await cleanTestData([schema.SimpleArrayTests]);
      const db = getDb();
      await db.insert(schema.SimpleArrayTests).values([
        { requiredTags: ["t1"], requiredScores: [1, 2] },
        { requiredTags: ["t2"], requiredScores: [2, 3] },
        { requiredTags: ["t3"], requiredScores: [5, 5] },
      ]);
    });

    it("arrayHas: value = ANY(col) — value present anywhere in the array", async () => {
      const db = getDb();
      const result = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(arrayHas(schema.SimpleArrayTests.requiredScores, 2));
      // [1,2] has 2 ✓ and [2,3] has 2 ✓
      expect(result).toHaveLength(2);
    });

    it("arrayAll: value = ALL(col) — all elements equal the value", async () => {
      const db = getDb();
      const result = await db
        .from(schema.SimpleArrayTests)
        .select()
        .where(arrayAll(schema.SimpleArrayTests.requiredScores, 5));
      // only [5,5] qualifies
      expect(result).toHaveLength(1);
      expect(result[0].requiredTags).toEqual(["t3"]);
    });
  });

  // ==========================================================================
  // Array filters on StatusEnum[]: all five filter types
  // ==========================================================================

  describe("array filters on StatusEnum[]", () => {
    beforeEach(async () => {
      await cleanTestData([schema.EnumArrayTests]);
      const db = getDb();
      await db.insert(schema.EnumArrayTests).values([
        {
          requiredStatuses: ["active", "pending"],
          requiredPriorities: ["high"],
        },
        { requiredStatuses: ["inactive"], requiredPriorities: ["medium"] },
        { requiredStatuses: ["active"], requiredPriorities: ["low", "low"] },
      ]);
    });

    it("arrayContains: col @> enum values", async () => {
      const db = getDb();
      const result = await db
        .from(schema.EnumArrayTests)
        .select()
        .where(
          arrayContains(schema.EnumArrayTests.requiredStatuses, ["active"]),
        );
      // ["active","pending"] contains "active" ✓ and ["active"] contains "active" ✓
      expect(result).toHaveLength(2);
    });

    it("arrayHas: enum value = ANY(col)", async () => {
      const db = getDb();
      const result = await db
        .from(schema.EnumArrayTests)
        .select()
        .where(arrayHas(schema.EnumArrayTests.requiredStatuses, "pending"));
      expect(result).toHaveLength(1);
      expect(result[0].requiredStatuses).toEqual(["active", "pending"]);
    });

    it("arrayOverlaps: enum arrays share elements", async () => {
      const db = getDb();
      const result = await db
        .from(schema.EnumArrayTests)
        .select()
        .where(
          arrayOverlaps(schema.EnumArrayTests.requiredStatuses, [
            "pending",
            "inactive",
          ]),
        );
      // ["active","pending"] shares "pending" ✓ and ["inactive"] shares "inactive" ✓
      expect(result).toHaveLength(2);
    });

    it("arrayContainedBy: enum col <@ values", async () => {
      const db = getDb();
      const result = await db
        .from(schema.EnumArrayTests)
        .select()
        .where(
          arrayContainedBy(schema.EnumArrayTests.requiredStatuses, [
            "active",
            "pending",
          ]),
        );
      // ["active","pending"] ⊆ ["active","pending"] ✓ and ["active"] ⊆ ["active","pending"] ✓
      expect(result).toHaveLength(2);
    });

    it("arrayAll: all enum elements equal value", async () => {
      const db = getDb();
      const result = await db
        .from(schema.EnumArrayTests)
        .select()
        .where(arrayAll(schema.EnumArrayTests.requiredPriorities, "low"));
      // only ["low","low"] qualifies
      expect(result).toHaveLength(1);
    });
  });
});
