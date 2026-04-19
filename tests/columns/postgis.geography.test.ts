import { isNotNull, isNull } from "durcno";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  cleanTestData,
  destroyTestContext,
  getDb,
  initTestContext,
  schema,
} from "./setup";

describe("Geography Point Column Type (PostGIS)", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([schema.GeographyPointTests]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // Test coordinates as [longitude, latitude]
  const pointA = [-74.006, 40.7128] as const; // New York
  const pointB = [-118.2437, 34.0522] as const; // Los Angeles
  const pointC = [139.6917, 35.6895] as const; // Tokyo

  describe("notNull constraint", () => {
    it("should insert and read required point", async () => {
      const db = getDb();
      await db.insert(schema.GeographyPointTests).values({
        requiredPoint: pointA,
      });

      const [row] = await db.from(schema.GeographyPointTests).select();
      expect(row.requiredPoint).toBeDefined();
      expect(row.requiredPoint?.[0]).toBeCloseTo(pointA[0], 4);
      expect(row.requiredPoint?.[1]).toBeCloseTo(pointA[1], 4);
    });

    it("should allow null for optional point", async () => {
      const db = getDb();
      await db.insert(schema.GeographyPointTests).values({
        requiredPoint: pointA,
      });

      const [row] = await db.from(schema.GeographyPointTests).select();
      expect(row.optionalPoint).toBeNull();
    });
  });

  describe("create and read", () => {
    it("should handle different coordinate values", async () => {
      const db = getDb();
      await db.insert(schema.GeographyPointTests).values({
        requiredPoint: pointB,
      });

      const [row] = await db.from(schema.GeographyPointTests).select();
      expect(row.requiredPoint?.[0]).toBeCloseTo(pointB[0], 4);
      expect(row.requiredPoint?.[1]).toBeCloseTo(pointB[1], 4);
    });

    it("should handle origin point", async () => {
      const db = getDb();
      const origin = [0, 0] as const;
      await db.insert(schema.GeographyPointTests).values({
        requiredPoint: origin,
      });

      const [row] = await db.from(schema.GeographyPointTests).select();
      expect(row.requiredPoint?.[0]).toBeCloseTo(0, 4);
      expect(row.requiredPoint?.[1]).toBeCloseTo(0, 4);
    });

    it("should handle negative coordinates", async () => {
      const db = getDb();
      const negativePoint = [-180, -90] as const;
      await db.insert(schema.GeographyPointTests).values({
        requiredPoint: negativePoint,
      });

      const [row] = await db.from(schema.GeographyPointTests).select();
      expect(row.requiredPoint?.[0]).toBeCloseTo(-180, 4);
      expect(row.requiredPoint?.[1]).toBeCloseTo(-90, 4);
    });

    it("should store optional point when provided", async () => {
      const db = getDb();
      await db.insert(schema.GeographyPointTests).values({
        requiredPoint: pointA,
        optionalPoint: pointC,
      });

      const [row] = await db.from(schema.GeographyPointTests).select();
      expect(row.optionalPoint).toBeDefined();
      expect(row.optionalPoint?.[0]).toBeCloseTo(pointC[0], 4);
      expect(row.optionalPoint?.[1]).toBeCloseTo(pointC[1], 4);
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      const db = getDb();
      await db.insert(schema.GeographyPointTests).values([
        { requiredPoint: pointA, optionalPoint: null },
        { requiredPoint: pointB, optionalPoint: pointC },
      ]);
    });

    it("should filter with isNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.GeographyPointTests)
        .select()
        .where(isNull(schema.GeographyPointTests.optionalPoint));

      expect(result).toHaveLength(1);
    });

    it("should filter with isNotNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.GeographyPointTests)
        .select()
        .where(isNotNull(schema.GeographyPointTests.optionalPoint));

      expect(result).toHaveLength(1);
    });
  });
});

describe("Geography MultiPoint Column Type (PostGIS)", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([schema.GeographyMultiPointTests]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // Test coordinates as [longitude, latitude] pairs
  const multiPointA = [
    [-74.006, 40.7128], // New York
    [-118.2437, 34.0522], // Los Angeles
  ] as const;

  const multiPointB = [
    [-0.1276, 51.5074], // London
    [139.6917, 35.6895], // Tokyo
    [2.3522, 48.8566], // Paris
  ] as const;

  describe("notNull constraint", () => {
    it("should insert and read required multipoint", async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiPointTests).values({
        requiredMultiPoint: multiPointA,
      });

      const [row] = await db.from(schema.GeographyMultiPointTests).select();
      expect(row.requiredMultiPoint).toBeDefined();
      expect(row.requiredMultiPoint?.length).toBe(2);
      expect(row.requiredMultiPoint?.[0][0]).toBeCloseTo(multiPointA[0][0], 4);
      expect(row.requiredMultiPoint?.[0][1]).toBeCloseTo(multiPointA[0][1], 4);
    });

    it("should allow null for optional multipoint", async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiPointTests).values({
        requiredMultiPoint: multiPointA,
      });

      const [row] = await db.from(schema.GeographyMultiPointTests).select();
      expect(row.optionalMultiPoint).toBeNull();
    });
  });

  describe("create and read", () => {
    it("should handle multipoint with multiple points", async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiPointTests).values({
        requiredMultiPoint: multiPointB,
      });

      const [row] = await db.from(schema.GeographyMultiPointTests).select();
      expect(row.requiredMultiPoint?.length).toBe(3);
      expect(row.requiredMultiPoint?.[2][0]).toBeCloseTo(multiPointB[2][0], 4);
      expect(row.requiredMultiPoint?.[2][1]).toBeCloseTo(multiPointB[2][1], 4);
    });

    it("should handle single point in multipoint", async () => {
      const db = getDb();
      const singlePoint = [[0, 0]] as const;
      await db.insert(schema.GeographyMultiPointTests).values({
        requiredMultiPoint: singlePoint,
      });

      const [row] = await db.from(schema.GeographyMultiPointTests).select();
      expect(row.requiredMultiPoint?.length).toBe(1);
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiPointTests).values([
        { requiredMultiPoint: multiPointA, optionalMultiPoint: null },
        { requiredMultiPoint: multiPointB, optionalMultiPoint: multiPointA },
      ]);
    });

    it("should filter with isNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.GeographyMultiPointTests)
        .select()
        .where(isNull(schema.GeographyMultiPointTests.optionalMultiPoint));

      expect(result).toHaveLength(1);
    });

    it("should filter with isNotNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.GeographyMultiPointTests)
        .select()
        .where(isNotNull(schema.GeographyMultiPointTests.optionalMultiPoint));

      expect(result).toHaveLength(1);
    });
  });
});

describe("Geography LineString Column Type (PostGIS)", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([schema.GeographyLineStringTests]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // A line from New York to Los Angeles
  const lineStringA = [
    [-74.006, 40.7128],
    [-87.6298, 41.8781], // Chicago
    [-118.2437, 34.0522],
  ] as const;

  // A line around Europe
  const lineStringB = [
    [-0.1276, 51.5074], // London
    [2.3522, 48.8566], // Paris
    [13.405, 52.52], // Berlin
  ] as const;

  describe("notNull constraint", () => {
    it("should insert and read required linestring", async () => {
      const db = getDb();
      await db.insert(schema.GeographyLineStringTests).values({
        requiredLineString: lineStringA,
      });

      const [row] = await db.from(schema.GeographyLineStringTests).select();
      expect(row.requiredLineString).toBeDefined();
      expect(row.requiredLineString?.length).toBe(3);
      expect(row.requiredLineString?.[0][0]).toBeCloseTo(lineStringA[0][0], 4);
      expect(row.requiredLineString?.[0][1]).toBeCloseTo(lineStringA[0][1], 4);
    });

    it("should allow null for optional linestring", async () => {
      const db = getDb();
      await db.insert(schema.GeographyLineStringTests).values({
        requiredLineString: lineStringA,
      });

      const [row] = await db.from(schema.GeographyLineStringTests).select();
      expect(row.optionalLineString).toBeNull();
    });
  });

  describe("create and read", () => {
    it("should handle linestring with multiple points", async () => {
      const db = getDb();
      await db.insert(schema.GeographyLineStringTests).values({
        requiredLineString: lineStringB,
      });

      const [row] = await db.from(schema.GeographyLineStringTests).select();
      expect(row.requiredLineString?.length).toBe(3);
      expect(row.requiredLineString?.[1][0]).toBeCloseTo(lineStringB[1][0], 4);
      expect(row.requiredLineString?.[1][1]).toBeCloseTo(lineStringB[1][1], 4);
    });

    it("should handle simple two-point linestring", async () => {
      const db = getDb();
      const simpleLine = [
        [0, 0],
        [10, 10],
      ] as const;
      await db.insert(schema.GeographyLineStringTests).values({
        requiredLineString: simpleLine,
      });

      const [row] = await db.from(schema.GeographyLineStringTests).select();
      expect(row.requiredLineString?.length).toBe(2);
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      const db = getDb();
      await db.insert(schema.GeographyLineStringTests).values([
        { requiredLineString: lineStringA, optionalLineString: null },
        { requiredLineString: lineStringB, optionalLineString: lineStringA },
      ]);
    });

    it("should filter with isNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.GeographyLineStringTests)
        .select()
        .where(isNull(schema.GeographyLineStringTests.optionalLineString));

      expect(result).toHaveLength(1);
    });

    it("should filter with isNotNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.GeographyLineStringTests)
        .select()
        .where(isNotNull(schema.GeographyLineStringTests.optionalLineString));

      expect(result).toHaveLength(1);
    });
  });
});

describe("Geography MultiLineString Column Type (PostGIS)", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([schema.GeographyMultiLineStringTests]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // Multiple lines
  const multiLineStringA = [
    [
      [-74.006, 40.7128],
      [-118.2437, 34.0522],
    ],
    [
      [-0.1276, 51.5074],
      [139.6917, 35.6895],
    ],
  ] as const;

  const multiLineStringB = [
    [
      [0, 0],
      [10, 10],
    ],
    [
      [20, 20],
      [30, 30],
    ],
    [
      [40, 40],
      [50, 50],
    ],
  ] as const;

  describe("notNull constraint", () => {
    it("should insert and read required multilinestring", async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiLineStringTests).values({
        requiredMultiLineString: multiLineStringA,
      });

      const [row] = await db
        .from(schema.GeographyMultiLineStringTests)
        .select();
      expect(row.requiredMultiLineString).toBeDefined();
      expect(row.requiredMultiLineString?.length).toBe(2);
      expect(row.requiredMultiLineString?.[0][0][0]).toBeCloseTo(
        multiLineStringA[0][0][0],
        4,
      );
    });

    it("should allow null for optional multilinestring", async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiLineStringTests).values({
        requiredMultiLineString: multiLineStringA,
      });

      const [row] = await db
        .from(schema.GeographyMultiLineStringTests)
        .select();
      expect(row.optionalMultiLineString).toBeNull();
    });
  });

  describe("create and read", () => {
    it("should handle multilinestring with multiple lines", async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiLineStringTests).values({
        requiredMultiLineString: multiLineStringB,
      });

      const [row] = await db
        .from(schema.GeographyMultiLineStringTests)
        .select();
      expect(row.requiredMultiLineString?.length).toBe(3);
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiLineStringTests).values([
        {
          requiredMultiLineString: multiLineStringA,
          optionalMultiLineString: null,
        },
        {
          requiredMultiLineString: multiLineStringB,
          optionalMultiLineString: multiLineStringA,
        },
      ]);
    });

    it("should filter with isNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.GeographyMultiLineStringTests)
        .select()
        .where(
          isNull(schema.GeographyMultiLineStringTests.optionalMultiLineString),
        );

      expect(result).toHaveLength(1);
    });

    it("should filter with isNotNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.GeographyMultiLineStringTests)
        .select()
        .where(
          isNotNull(
            schema.GeographyMultiLineStringTests.optionalMultiLineString,
          ),
        );

      expect(result).toHaveLength(1);
    });
  });
});

describe("Geography Polygon Column Type (PostGIS)", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([schema.GeographyPolygonTests]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // Simple square polygon (exterior ring only)
  const polygonA = [
    [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0], // Closed ring
    ],
  ] as const;

  // Polygon with a hole (exterior + interior ring)
  const polygonWithHole = [
    [
      [0, 0],
      [20, 0],
      [20, 20],
      [0, 20],
      [0, 0],
    ],
    [
      [5, 5],
      [15, 5],
      [15, 15],
      [5, 15],
      [5, 5],
    ],
  ] as const;

  describe("notNull constraint", () => {
    it("should insert and read required polygon", async () => {
      const db = getDb();
      await db.insert(schema.GeographyPolygonTests).values({
        requiredPolygon: polygonA,
      });

      const [row] = await db.from(schema.GeographyPolygonTests).select();
      expect(row.requiredPolygon).toBeDefined();
      expect(row.requiredPolygon?.length).toBe(1);
      expect(row.requiredPolygon?.[0].length).toBe(5);
    });

    it("should allow null for optional polygon", async () => {
      const db = getDb();
      await db.insert(schema.GeographyPolygonTests).values({
        requiredPolygon: polygonA,
      });

      const [row] = await db.from(schema.GeographyPolygonTests).select();
      expect(row.optionalPolygon).toBeNull();
    });
  });

  describe("create and read", () => {
    it("should handle polygon with hole", async () => {
      const db = getDb();
      await db.insert(schema.GeographyPolygonTests).values({
        requiredPolygon: polygonWithHole,
      });

      const [row] = await db.from(schema.GeographyPolygonTests).select();
      expect(row.requiredPolygon?.length).toBe(2); // Exterior + interior ring
    });

    it("should preserve coordinate values", async () => {
      const db = getDb();
      await db.insert(schema.GeographyPolygonTests).values({
        requiredPolygon: polygonA,
      });

      const [row] = await db.from(schema.GeographyPolygonTests).select();
      expect(row.requiredPolygon?.[0][1][0]).toBeCloseTo(10, 4);
      expect(row.requiredPolygon?.[0][1][1]).toBeCloseTo(0, 4);
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      const db = getDb();
      await db.insert(schema.GeographyPolygonTests).values([
        { requiredPolygon: polygonA, optionalPolygon: null },
        { requiredPolygon: polygonWithHole, optionalPolygon: polygonA },
      ]);
    });

    it("should filter with isNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.GeographyPolygonTests)
        .select()
        .where(isNull(schema.GeographyPolygonTests.optionalPolygon));

      expect(result).toHaveLength(1);
    });

    it("should filter with isNotNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.GeographyPolygonTests)
        .select()
        .where(isNotNull(schema.GeographyPolygonTests.optionalPolygon));

      expect(result).toHaveLength(1);
    });
  });
});

describe("Geography MultiPolygon Column Type (PostGIS)", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  beforeEach(async () => {
    await cleanTestData([schema.GeographyMultiPolygonTests]);
  });

  afterAll(async () => {
    await destroyTestContext();
  });

  // Two simple polygons
  const multiPolygonA = [
    [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ],
    [
      [
        [20, 20],
        [30, 20],
        [30, 30],
        [20, 30],
        [20, 20],
      ],
    ],
  ] as const;

  // Three polygons
  const multiPolygonB = [
    [
      [
        [0, 0],
        [5, 0],
        [5, 5],
        [0, 5],
        [0, 0],
      ],
    ],
    [
      [
        [10, 10],
        [15, 10],
        [15, 15],
        [10, 15],
        [10, 10],
      ],
    ],
    [
      [
        [20, 20],
        [25, 20],
        [25, 25],
        [20, 25],
        [20, 20],
      ],
    ],
  ] as const;

  describe("notNull constraint", () => {
    it("should insert and read required multipolygon", async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiPolygonTests).values({
        requiredMultiPolygon: multiPolygonA,
      });

      const [row] = await db.from(schema.GeographyMultiPolygonTests).select();
      expect(row.requiredMultiPolygon).toBeDefined();
      expect(row.requiredMultiPolygon?.length).toBe(2);
    });

    it("should allow null for optional multipolygon", async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiPolygonTests).values({
        requiredMultiPolygon: multiPolygonA,
      });

      const [row] = await db.from(schema.GeographyMultiPolygonTests).select();
      expect(row.optionalMultiPolygon).toBeNull();
    });
  });

  describe("create and read", () => {
    it("should handle multipolygon with multiple polygons", async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiPolygonTests).values({
        requiredMultiPolygon: multiPolygonB,
      });

      const [row] = await db.from(schema.GeographyMultiPolygonTests).select();
      expect(row.requiredMultiPolygon?.length).toBe(3);
    });

    it("should preserve nested structure", async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiPolygonTests).values({
        requiredMultiPolygon: multiPolygonA,
      });

      const [row] = await db.from(schema.GeographyMultiPolygonTests).select();
      // multiPolygonA[1][0][1] = [30, 20]
      expect(row.requiredMultiPolygon?.[1][0][1][0]).toBeCloseTo(30, 4);
      expect(row.requiredMultiPolygon?.[1][0][1][1]).toBeCloseTo(20, 4);
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      const db = getDb();
      await db.insert(schema.GeographyMultiPolygonTests).values([
        { requiredMultiPolygon: multiPolygonA, optionalMultiPolygon: null },
        {
          requiredMultiPolygon: multiPolygonB,
          optionalMultiPolygon: multiPolygonA,
        },
      ]);
    });

    it("should filter with isNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.GeographyMultiPolygonTests)
        .select()
        .where(isNull(schema.GeographyMultiPolygonTests.optionalMultiPolygon));

      expect(result).toHaveLength(1);
    });

    it("should filter with isNotNull operator", async () => {
      const db = getDb();
      const result = await db
        .from(schema.GeographyMultiPolygonTests)
        .select()
        .where(
          isNotNull(schema.GeographyMultiPolygonTests.optionalMultiPolygon),
        );

      expect(result).toHaveLength(1);
    });
  });
});
