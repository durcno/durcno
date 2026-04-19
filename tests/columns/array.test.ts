import { isNotNull, isNull } from "durcno";
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

  beforeEach(async () => {
    await cleanTestData([
      schema.SimpleArrayTests,
      schema.FixedArrayTests,
      schema.MultidimensionalArrayTests,
      schema.EnumArrayTests,
    ]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // ============================================================================
  // Simple Array Column Tests (1D Variable-Length)
  // ============================================================================
  describe("Simple Array Column Type", () => {
    // Test data
    const stringArray = ["tag1", "tag2", "tag3"];
    const intArray = [10, 20, 30, 40];
    const emptyArray: string[] = [];
    const singleElementArray = ["only-one"];

    describe("notNull constraint", () => {
      it("should insert and read required string array", async () => {
        const db = getDb();
        await db.insert(schema.SimpleArrayTests).values({
          requiredTags: stringArray,
          requiredScores: intArray,
        });

        const [row] = await db.from(schema.SimpleArrayTests).select();
        expect(row.requiredTags).toEqual(stringArray);
      });

      it("should insert and read required integer array", async () => {
        const db = getDb();
        await db.insert(schema.SimpleArrayTests).values({
          requiredTags: stringArray,
          requiredScores: intArray,
        });

        const [row] = await db.from(schema.SimpleArrayTests).select();
        expect(row.requiredScores).toEqual(intArray);
      });

      it("should allow null for optional arrays", async () => {
        const db = getDb();
        await db.insert(schema.SimpleArrayTests).values({
          requiredTags: stringArray,
          requiredScores: intArray,
          // optionalTags and optionalScores not provided - should be null
        });

        const [row] = await db.from(schema.SimpleArrayTests).select();
        expect(row.optionalTags).toBeNull();
        expect(row.optionalScores).toBeNull();
      });
    });

    describe("create and read", () => {
      it("should handle empty arrays", async () => {
        const db = getDb();
        await db.insert(schema.SimpleArrayTests).values({
          requiredTags: emptyArray,
          requiredScores: [],
        });

        const [row] = await db.from(schema.SimpleArrayTests).select();
        expect(row.requiredTags).toEqual([]);
        expect(row.requiredScores).toEqual([]);
      });

      it("should handle single-element arrays", async () => {
        const db = getDb();
        await db.insert(schema.SimpleArrayTests).values({
          requiredTags: singleElementArray,
          requiredScores: [42],
        });

        const [row] = await db.from(schema.SimpleArrayTests).select();
        expect(row.requiredTags).toEqual(singleElementArray);
        expect(row.requiredScores).toEqual([42]);
      });

      it("should handle large arrays", async () => {
        const db = getDb();
        const largeStringArray = Array.from(
          { length: 100 },
          (_, i) => `tag${i}`,
        );
        const largeIntArray = Array.from({ length: 100 }, (_, i) => i * 10);

        await db.insert(schema.SimpleArrayTests).values({
          requiredTags: largeStringArray,
          requiredScores: largeIntArray,
        });

        const [row] = await db.from(schema.SimpleArrayTests).select();
        expect(row.requiredTags).toEqual(largeStringArray);
        expect(row.requiredScores).toEqual(largeIntArray);
      });

      it("should handle strings with special characters in arrays", async () => {
        const db = getDb();
        const specialChars = [
          "hello world",
          "tag-with-dash",
          "underscore_tag",
          "tag.dot",
        ];

        await db.insert(schema.SimpleArrayTests).values({
          requiredTags: specialChars,
          requiredScores: [1],
        });

        const [row] = await db.from(schema.SimpleArrayTests).select();
        expect(row.requiredTags).toEqual(specialChars);
      });

      it("should handle negative numbers in integer arrays", async () => {
        const db = getDb();
        const negativeNumbers = [-100, -50, 0, 50, 100];

        await db.insert(schema.SimpleArrayTests).values({
          requiredTags: ["test"],
          requiredScores: negativeNumbers,
        });

        const [row] = await db.from(schema.SimpleArrayTests).select();
        expect(row.requiredScores).toEqual(negativeNumbers);
      });

      it("should handle multiple rows with different arrays", async () => {
        const db = getDb();
        await db.insert(schema.SimpleArrayTests).values([
          { requiredTags: ["a", "b"], requiredScores: [1, 2] },
          { requiredTags: ["c", "d", "e"], requiredScores: [3, 4, 5] },
          { requiredTags: [], requiredScores: [] },
        ]);

        const rows = await db.from(schema.SimpleArrayTests).select();
        expect(rows).toHaveLength(3);
        expect(rows[0].requiredTags).toEqual(["a", "b"]);
        expect(rows[1].requiredTags).toEqual(["c", "d", "e"]);
        expect(rows[2].requiredTags).toEqual([]);
      });
    });

    describe("filtering", () => {
      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.SimpleArrayTests).values([
          {
            requiredTags: ["a", "b"],
            requiredScores: [1, 2],
            optionalTags: null,
          },
          {
            requiredTags: ["c", "d"],
            requiredScores: [3, 4],
            optionalTags: ["x"],
          },
          {
            requiredTags: ["e"],
            requiredScores: [5],
            optionalTags: ["y", "z"],
          },
        ]);
      });

      it("should filter with isNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.SimpleArrayTests)
          .select()
          .where(isNull(schema.SimpleArrayTests.optionalTags));

        expect(result).toHaveLength(1);
        expect(result[0].requiredTags).toEqual(["a", "b"]);
      });

      it("should filter with isNotNull operator", async () => {
        const db = getDb();
        const result = await db
          .from(schema.SimpleArrayTests)
          .select()
          .where(isNotNull(schema.SimpleArrayTests.optionalTags));

        expect(result).toHaveLength(2);
      });
    });

    describe("update operations", () => {
      it("should update array values", async () => {
        const db = getDb();
        await db.insert(schema.SimpleArrayTests).values({
          requiredTags: ["old1", "old2"],
          requiredScores: [1, 2],
        });

        await db
          .update(schema.SimpleArrayTests)
          .set({ requiredTags: ["new1", "new2", "new3"] });

        const [row] = await db.from(schema.SimpleArrayTests).select();
        expect(row.requiredTags).toEqual(["new1", "new2", "new3"]);
      });

      it("should update array to empty", async () => {
        const db = getDb();
        await db.insert(schema.SimpleArrayTests).values({
          requiredTags: ["a", "b", "c"],
          requiredScores: [1, 2, 3],
        });

        await db.update(schema.SimpleArrayTests).set({ requiredTags: [] });

        const [row] = await db.from(schema.SimpleArrayTests).select();
        expect(row.requiredTags).toEqual([]);
      });

      it("should update optional array to null", async () => {
        const db = getDb();
        await db.insert(schema.SimpleArrayTests).values({
          requiredTags: ["a"],
          requiredScores: [1],
          optionalTags: ["x", "y"],
        });

        await db.update(schema.SimpleArrayTests).set({ optionalTags: null });

        const [row] = await db.from(schema.SimpleArrayTests).select();
        expect(row.optionalTags).toBeNull();
      });
    });
  });

  // ============================================================================
  // Fixed-Length Array Column Tests (1D Fixed-Length Tuples)
  // ============================================================================
  describe("Fixed-Length Array Column Type", () => {
    // Test data - 3-element tuples (coordinates)
    const coords3d: [number, number, number] = [10, 20, 30];
    const zeroCoords: [number, number, number] = [0, 0, 0];
    const negativeCoords: [number, number, number] = [-10, -20, -30];

    // 2-element string tuples
    const stringPair: [string, string] = ["first", "second"];

    describe("notNull constraint", () => {
      it("should insert and read required 3-element integer tuple", async () => {
        const db = getDb();
        await db.insert(schema.FixedArrayTests).values({
          requiredCoords: coords3d,
          requiredPair: stringPair,
        });

        const [row] = await db.from(schema.FixedArrayTests).select();
        expect(row.requiredCoords).toEqual(coords3d);
      });

      it("should insert and read required 2-element string tuple", async () => {
        const db = getDb();
        await db.insert(schema.FixedArrayTests).values({
          requiredCoords: coords3d,
          requiredPair: stringPair,
        });

        const [row] = await db.from(schema.FixedArrayTests).select();
        expect(row.requiredPair).toEqual(stringPair);
      });

      it("should allow null for optional fixed arrays", async () => {
        const db = getDb();
        await db.insert(schema.FixedArrayTests).values({
          requiredCoords: coords3d,
          requiredPair: stringPair,
        });

        const [row] = await db.from(schema.FixedArrayTests).select();
        expect(row.optionalCoords).toBeNull();
        expect(row.optionalPair).toBeNull();
      });
    });

    describe("create and read", () => {
      it("should handle coordinates with zero values", async () => {
        const db = getDb();
        await db.insert(schema.FixedArrayTests).values({
          requiredCoords: zeroCoords,
          requiredPair: stringPair,
        });

        const [row] = await db.from(schema.FixedArrayTests).select();
        expect(row.requiredCoords).toEqual(zeroCoords);
      });

      it("should handle coordinates with negative values", async () => {
        const db = getDb();
        await db.insert(schema.FixedArrayTests).values({
          requiredCoords: negativeCoords,
          requiredPair: stringPair,
        });

        const [row] = await db.from(schema.FixedArrayTests).select();
        expect(row.requiredCoords).toEqual(negativeCoords);
      });

      it("should handle string pairs with special characters", async () => {
        const db = getDb();
        const specialPair: [string, string] = ["hello world", "test-value"];

        await db.insert(schema.FixedArrayTests).values({
          requiredCoords: coords3d,
          requiredPair: specialPair,
        });

        const [row] = await db.from(schema.FixedArrayTests).select();
        expect(row.requiredPair).toEqual(specialPair);
      });

      it("should handle multiple rows with different tuples", async () => {
        const db = getDb();
        await db.insert(schema.FixedArrayTests).values([
          { requiredCoords: [1, 2, 3], requiredPair: ["a", "b"] },
          { requiredCoords: [4, 5, 6], requiredPair: ["c", "d"] },
          { requiredCoords: [7, 8, 9], requiredPair: ["e", "f"] },
        ]);

        const rows = await db.from(schema.FixedArrayTests).select();
        expect(rows).toHaveLength(3);
        expect(rows[0].requiredCoords).toEqual([1, 2, 3]);
        expect(rows[1].requiredCoords).toEqual([4, 5, 6]);
        expect(rows[2].requiredCoords).toEqual([7, 8, 9]);
      });
    });

    describe("filtering", () => {
      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.FixedArrayTests).values([
          {
            requiredCoords: [1, 2, 3],
            requiredPair: ["a", "b"],
            optionalCoords: null,
          },
          {
            requiredCoords: [4, 5, 6],
            requiredPair: ["c", "d"],
            optionalCoords: [10, 20, 30],
          },
          {
            requiredCoords: [7, 8, 9],
            requiredPair: ["e", "f"],
            optionalCoords: [40, 50, 60],
          },
        ]);
      });

      it("should filter with isNull operator on optional tuple", async () => {
        const db = getDb();
        const result = await db
          .from(schema.FixedArrayTests)
          .select()
          .where(isNull(schema.FixedArrayTests.optionalCoords));

        expect(result).toHaveLength(1);
        expect(result[0].requiredCoords).toEqual([1, 2, 3]);
      });

      it("should filter with isNotNull operator on optional tuple", async () => {
        const db = getDb();
        const result = await db
          .from(schema.FixedArrayTests)
          .select()
          .where(isNotNull(schema.FixedArrayTests.optionalCoords));

        expect(result).toHaveLength(2);
      });
    });

    describe("update operations", () => {
      it("should update fixed-length array values", async () => {
        const db = getDb();
        await db.insert(schema.FixedArrayTests).values({
          requiredCoords: [1, 2, 3],
          requiredPair: ["a", "b"],
        });

        await db
          .update(schema.FixedArrayTests)
          .set({ requiredCoords: [100, 200, 300] });

        const [row] = await db.from(schema.FixedArrayTests).select();
        expect(row.requiredCoords).toEqual([100, 200, 300]);
      });
    });
  });

  // ============================================================================
  // Multidimensional Array Column Tests (2D Arrays)
  // ============================================================================
  describe("Multidimensional Array Column Type", () => {
    // Test data - 2D arrays (matrix)
    const matrix2x3: number[][] = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const matrix3x2: number[][] = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];
    const emptyMatrix: number[][] = [];
    const singleRowMatrix: number[][] = [[1, 2, 3]];

    // 2D with fixed inner: [number, number][]
    const vectors: [number, number][] = [
      [1, 2],
      [3, 4],
      [5, 6],
    ];

    describe("notNull constraint", () => {
      it("should insert and read required 2D variable-length array", async () => {
        const db = getDb();
        await db.insert(schema.MultidimensionalArrayTests).values({
          requiredMatrix: matrix2x3,
          requiredVectors: vectors,
        });

        const [row] = await db.from(schema.MultidimensionalArrayTests).select();
        expect(row.requiredMatrix).toEqual(matrix2x3);
      });

      it("should insert and read required fixed-inner 2D array", async () => {
        const db = getDb();
        await db.insert(schema.MultidimensionalArrayTests).values({
          requiredMatrix: matrix2x3,
          requiredVectors: vectors,
        });

        const [row] = await db.from(schema.MultidimensionalArrayTests).select();
        expect(row.requiredVectors).toEqual(vectors);
      });

      it("should allow null for optional 2D arrays", async () => {
        const db = getDb();
        await db.insert(schema.MultidimensionalArrayTests).values({
          requiredMatrix: matrix2x3,
          requiredVectors: vectors,
        });

        const [row] = await db.from(schema.MultidimensionalArrayTests).select();
        expect(row.optionalMatrix).toBeNull();
        expect(row.optionalVectors).toBeNull();
      });
    });

    describe("create and read", () => {
      it("should handle empty 2D arrays", async () => {
        const db = getDb();
        await db.insert(schema.MultidimensionalArrayTests).values({
          requiredMatrix: emptyMatrix,
          requiredVectors: [],
        });

        const [row] = await db.from(schema.MultidimensionalArrayTests).select();
        expect(row.requiredMatrix).toEqual([]);
        expect(row.requiredVectors).toEqual([]);
      });

      it("should handle single-row matrix", async () => {
        const db = getDb();
        await db.insert(schema.MultidimensionalArrayTests).values({
          requiredMatrix: singleRowMatrix,
          requiredVectors: [[1, 2]],
        });

        const [row] = await db.from(schema.MultidimensionalArrayTests).select();
        expect(row.requiredMatrix).toEqual(singleRowMatrix);
        expect(row.requiredVectors).toEqual([[1, 2]]);
      });

      it("should handle different sized matrices", async () => {
        const db = getDb();
        await db.insert(schema.MultidimensionalArrayTests).values([
          { requiredMatrix: matrix2x3, requiredVectors: vectors },
          { requiredMatrix: matrix3x2, requiredVectors: [[10, 20]] },
        ]);

        const rows = await db.from(schema.MultidimensionalArrayTests).select();
        expect(rows).toHaveLength(2);
        expect(rows[0].requiredMatrix).toEqual(matrix2x3);
        expect(rows[1].requiredMatrix).toEqual(matrix3x2);
      });

      it("should handle matrices with negative numbers", async () => {
        const db = getDb();
        const negativeMatrix = [
          [-1, -2, -3],
          [-4, -5, -6],
        ];

        await db.insert(schema.MultidimensionalArrayTests).values({
          requiredMatrix: negativeMatrix,
          requiredVectors: [[-1, -2]],
        });

        const [row] = await db.from(schema.MultidimensionalArrayTests).select();
        expect(row.requiredMatrix).toEqual(negativeMatrix);
      });

      it("should handle large matrices", async () => {
        const db = getDb();
        const largeMatrix = Array.from({ length: 10 }, (_, i) =>
          Array.from({ length: 10 }, (_, j) => i * 10 + j),
        );

        await db.insert(schema.MultidimensionalArrayTests).values({
          requiredMatrix: largeMatrix,
          requiredVectors: [[1, 2]],
        });

        const [row] = await db.from(schema.MultidimensionalArrayTests).select();
        expect(row.requiredMatrix).toEqual(largeMatrix);
      });
    });

    describe("filtering", () => {
      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.MultidimensionalArrayTests).values([
          {
            requiredMatrix: [[1]],
            requiredVectors: [[1, 2]],
            optionalMatrix: null,
          },
          {
            requiredMatrix: [[2]],
            requiredVectors: [[3, 4]],
            optionalMatrix: [[10, 20]],
          },
          {
            requiredMatrix: [[3]],
            requiredVectors: [[5, 6]],
            optionalMatrix: [
              [30, 40],
              [50, 60],
            ],
          },
        ]);
      });

      it("should filter with isNull operator on optional 2D array", async () => {
        const db = getDb();
        const result = await db
          .from(schema.MultidimensionalArrayTests)
          .select()
          .where(isNull(schema.MultidimensionalArrayTests.optionalMatrix));

        expect(result).toHaveLength(1);
        expect(result[0].requiredMatrix).toEqual([[1]]);
      });

      it("should filter with isNotNull operator on optional 2D array", async () => {
        const db = getDb();
        const result = await db
          .from(schema.MultidimensionalArrayTests)
          .select()
          .where(isNotNull(schema.MultidimensionalArrayTests.optionalMatrix));

        expect(result).toHaveLength(2);
      });
    });

    describe("update operations", () => {
      it("should update 2D array values", async () => {
        const db = getDb();
        await db.insert(schema.MultidimensionalArrayTests).values({
          requiredMatrix: [
            [1, 2],
            [3, 4],
          ],
          requiredVectors: [[1, 2]],
        });

        await db.update(schema.MultidimensionalArrayTests).set({
          requiredMatrix: [
            [100, 200],
            [300, 400],
            [500, 600],
          ],
        });

        const [row] = await db.from(schema.MultidimensionalArrayTests).select();
        expect(row.requiredMatrix).toEqual([
          [100, 200],
          [300, 400],
          [500, 600],
        ]);
      });

      it("should update 2D array to empty", async () => {
        const db = getDb();
        await db.insert(schema.MultidimensionalArrayTests).values({
          requiredMatrix: [
            [1, 2],
            [3, 4],
          ],
          requiredVectors: [[1, 2]],
        });

        await db
          .update(schema.MultidimensionalArrayTests)
          .set({ requiredMatrix: [] });

        const [row] = await db.from(schema.MultidimensionalArrayTests).select();
        expect(row.requiredMatrix).toEqual([]);
      });
    });
  });

  // ============================================================================
  // Enum Array Column Tests
  // ============================================================================
  describe("Enum Array Column Type", () => {
    // Test data
    const statusArray = ["active", "pending", "inactive"] as const;
    const priorityArray = ["high", "medium", "low"] as const;
    const singleStatus = ["active"] as const;

    describe("notNull constraint", () => {
      it("should insert and read required enum array", async () => {
        const db = getDb();
        await db.insert(schema.EnumArrayTests).values({
          requiredStatuses: [...statusArray],
          requiredPriorities: [...priorityArray],
        });

        const [row] = await db.from(schema.EnumArrayTests).select();
        expect(row.requiredStatuses).toEqual([...statusArray]);
      });

      it("should allow null for optional enum arrays", async () => {
        const db = getDb();
        await db.insert(schema.EnumArrayTests).values({
          requiredStatuses: [...statusArray],
          requiredPriorities: [...priorityArray],
        });

        const [row] = await db.from(schema.EnumArrayTests).select();
        expect(row.optionalStatuses).toBeNull();
        expect(row.optionalPriorities).toBeNull();
      });
    });

    describe("create and read", () => {
      it("should handle single-element enum array", async () => {
        const db = getDb();
        await db.insert(schema.EnumArrayTests).values({
          requiredStatuses: [...singleStatus],
          requiredPriorities: ["high"],
        });

        const [row] = await db.from(schema.EnumArrayTests).select();
        expect(row.requiredStatuses).toEqual([...singleStatus]);
        expect(row.requiredPriorities).toEqual(["high"]);
      });

      it("should handle empty enum arrays", async () => {
        const db = getDb();
        await db.insert(schema.EnumArrayTests).values({
          requiredStatuses: [],
          requiredPriorities: [],
        });

        const [row] = await db.from(schema.EnumArrayTests).select();
        expect(row.requiredStatuses).toEqual([]);
        expect(row.requiredPriorities).toEqual([]);
      });

      it("should handle repeated enum values in array", async () => {
        const db = getDb();
        await db.insert(schema.EnumArrayTests).values({
          requiredStatuses: ["active", "active", "pending"],
          requiredPriorities: ["high", "high", "high"],
        });

        const [row] = await db.from(schema.EnumArrayTests).select();
        expect(row.requiredStatuses).toEqual(["active", "active", "pending"]);
        expect(row.requiredPriorities).toEqual(["high", "high", "high"]);
      });

      it("should handle multiple rows with different enum arrays", async () => {
        const db = getDb();
        await db.insert(schema.EnumArrayTests).values([
          { requiredStatuses: ["active"], requiredPriorities: ["high"] },
          {
            requiredStatuses: ["pending", "inactive"],
            requiredPriorities: ["medium", "low"],
          },
          { requiredStatuses: [], requiredPriorities: [] },
        ]);

        const rows = await db.from(schema.EnumArrayTests).select();
        expect(rows).toHaveLength(3);
        expect(rows[0].requiredStatuses).toEqual(["active"]);
        expect(rows[1].requiredStatuses).toEqual(["pending", "inactive"]);
        expect(rows[2].requiredStatuses).toEqual([]);
      });
    });

    describe("filtering", () => {
      beforeEach(async () => {
        const db = getDb();
        await db.insert(schema.EnumArrayTests).values([
          {
            requiredStatuses: ["active"],
            requiredPriorities: ["high"],
            optionalStatuses: null,
          },
          {
            requiredStatuses: ["pending"],
            requiredPriorities: ["medium"],
            optionalStatuses: ["active"],
          },
          {
            requiredStatuses: ["inactive"],
            requiredPriorities: ["low"],
            optionalStatuses: ["pending", "active"],
          },
        ]);
      });

      it("should filter with isNull operator on optional enum array", async () => {
        const db = getDb();
        const result = await db
          .from(schema.EnumArrayTests)
          .select()
          .where(isNull(schema.EnumArrayTests.optionalStatuses));

        expect(result).toHaveLength(1);
        expect(result[0].requiredStatuses).toEqual(["active"]);
      });

      it("should filter with isNotNull operator on optional enum array", async () => {
        const db = getDb();
        const result = await db
          .from(schema.EnumArrayTests)
          .select()
          .where(isNotNull(schema.EnumArrayTests.optionalStatuses));

        expect(result).toHaveLength(2);
      });
    });

    describe("update operations", () => {
      it("should update enum array values", async () => {
        const db = getDb();
        await db.insert(schema.EnumArrayTests).values({
          requiredStatuses: ["active"],
          requiredPriorities: ["high"],
        });

        await db.update(schema.EnumArrayTests).set({
          requiredStatuses: ["inactive", "pending"],
        });

        const [row] = await db.from(schema.EnumArrayTests).select();
        expect(row.requiredStatuses).toEqual(["inactive", "pending"]);
      });
    });
  });
});
