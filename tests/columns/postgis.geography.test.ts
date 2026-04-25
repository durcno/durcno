import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { destroyTestContext, getDb, initTestContext, schema } from "./setup";
import { eq } from "durcno";

describe("Geography Column Types (PostGIS)", () => {
  beforeAll(async () => {
    await initTestContext();
  }, 120000);

  afterAll(async () => {
    await destroyTestContext();
  });

  // ==========================================================================
  // POINT
  // ==========================================================================

  describe("geography point", () => {
    let insertedId: number;
    const pointA: [number, number] = [-74.006, 40.7128]; // NYC
    const pointB: [number, number] = [-118.2437, 34.0522]; // LA

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.GeographyPointTests)
        .values({ point: pointA })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.GeographyPointTests)
        .select()
        .where(eq(schema.GeographyPointTests.id, insertedId));
      expect(row.point).toBeDefined();
      expect(String(row.point?.[0])).toContain(String(pointA[0]));
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.GeographyPointTests)
        .set({ point: pointB })
        .where(eq(schema.GeographyPointTests.id, insertedId));
      const [row] = await db
        .from(schema.GeographyPointTests)
        .select()
        .where(eq(schema.GeographyPointTests.id, insertedId));
      expect(String(row.point?.[0])).toContain(String(pointB[0]));
    });
  });

  // ==========================================================================
  // MULTIPOINT
  // ==========================================================================

  describe("geography multipoint", () => {
    let insertedId: number;
    const mpA: [number, number][] = [
      [-74.006, 40.7128],
      [-118.2437, 34.0522],
    ];
    const mpB: [number, number][] = [
      [-87.6298, 41.8781],
      [-122.4194, 37.7749],
    ];

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.GeographyMultiPointTests)
        .values({ multipoint: mpA })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.GeographyMultiPointTests)
        .select()
        .where(eq(schema.GeographyMultiPointTests.id, insertedId));
      expect(row.multipoint).toBeDefined();
      expect(Array.isArray(row.multipoint)).toBe(true);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.GeographyMultiPointTests)
        .set({ multipoint: mpB })
        .where(eq(schema.GeographyMultiPointTests.id, insertedId));
      const [row] = await db
        .from(schema.GeographyMultiPointTests)
        .select()
        .where(eq(schema.GeographyMultiPointTests.id, insertedId));
      expect(row.multipoint).toBeDefined();
    });
  });

  // ==========================================================================
  // LINESTRING
  // ==========================================================================

  describe("geography linestring", () => {
    let insertedId: number;
    const lsA: [number, number][] = [
      [-74.006, 40.7128],
      [-87.6298, 41.8781],
      [-118.2437, 34.0522],
    ];
    const lsB: [number, number][] = [
      [-122.4194, 37.7749],
      [-104.9903, 39.7392],
    ];

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.GeographyLineStringTests)
        .values({ linestring: lsA })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.GeographyLineStringTests)
        .select()
        .where(eq(schema.GeographyLineStringTests.id, insertedId));
      expect(row.linestring).toBeDefined();
      expect(Array.isArray(row.linestring)).toBe(true);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.GeographyLineStringTests)
        .set({ linestring: lsB })
        .where(eq(schema.GeographyLineStringTests.id, insertedId));
      const [row] = await db
        .from(schema.GeographyLineStringTests)
        .select()
        .where(eq(schema.GeographyLineStringTests.id, insertedId));
      expect(row.linestring).toBeDefined();
    });
  });

  // ==========================================================================
  // MULTILINESTRING
  // ==========================================================================

  describe("geography multilinestring", () => {
    let insertedId: number;
    const mlsA: [number, number][][] = [
      [
        [-74.006, 40.7128],
        [-87.6298, 41.8781],
      ],
      [
        [-118.2437, 34.0522],
        [-122.4194, 37.7749],
      ],
    ];
    const mlsB: [number, number][][] = [
      [
        [-104.9903, 39.7392],
        [-96.797, 32.7767],
      ],
    ];

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.GeographyMultiLineStringTests)
        .values({ multilinestring: mlsA })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.GeographyMultiLineStringTests)
        .select()
        .where(eq(schema.GeographyMultiLineStringTests.id, insertedId));
      expect(row.multilinestring).toBeDefined();
      expect(Array.isArray(row.multilinestring)).toBe(true);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.GeographyMultiLineStringTests)
        .set({ multilinestring: mlsB })
        .where(eq(schema.GeographyMultiLineStringTests.id, insertedId));
      const [row] = await db
        .from(schema.GeographyMultiLineStringTests)
        .select()
        .where(eq(schema.GeographyMultiLineStringTests.id, insertedId));
      expect(row.multilinestring).toBeDefined();
    });
  });

  // ==========================================================================
  // POLYGON
  // ==========================================================================

  describe("geography polygon", () => {
    let insertedId: number;
    const polyA: [number, number][][] = [
      [
        [-74.006, 40.7128],
        [-73.935242, 40.73061],
        [-73.996, 40.671],
        [-74.006, 40.7128],
      ],
    ];
    const polyB: [number, number][][] = [
      [
        [-118.2437, 34.0522],
        [-118.1937, 34.0522],
        [-118.1937, 34.0022],
        [-118.2437, 34.0522],
      ],
    ];

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.GeographyPolygonTests)
        .values({ polygon: polyA })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.GeographyPolygonTests)
        .select()
        .where(eq(schema.GeographyPolygonTests.id, insertedId));
      expect(row.polygon).toBeDefined();
      expect(Array.isArray(row.polygon)).toBe(true);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.GeographyPolygonTests)
        .set({ polygon: polyB })
        .where(eq(schema.GeographyPolygonTests.id, insertedId));
      const [row] = await db
        .from(schema.GeographyPolygonTests)
        .select()
        .where(eq(schema.GeographyPolygonTests.id, insertedId));
      expect(row.polygon).toBeDefined();
    });
  });

  // ==========================================================================
  // MULTIPOLYGON
  // ==========================================================================

  describe("geography multipolygon", () => {
    let insertedId: number;
    const mpolyA: [number, number][][][] = [
      [
        [
          [-74.006, 40.7128],
          [-73.935242, 40.73061],
          [-73.996, 40.671],
          [-74.006, 40.7128],
        ],
      ],
      [
        [
          [-118.2437, 34.0522],
          [-118.1937, 34.0522],
          [-118.1937, 34.0022],
          [-118.2437, 34.0522],
        ],
      ],
    ];
    const mpolyB: [number, number][][][] = [
      [
        [
          [-87.6298, 41.8781],
          [-87.5798, 41.8781],
          [-87.5798, 41.8281],
          [-87.6298, 41.8781],
        ],
      ],
    ];

    it("insert", async () => {
      const db = getDb();
      const [row] = await db
        .insert(schema.GeographyMultiPolygonTests)
        .values({ multipolygon: mpolyA })
        .returning({ id: true });
      insertedId = row.id;
      expect(insertedId).toBeDefined();
    });

    it("select", async () => {
      const db = getDb();
      const [row] = await db
        .from(schema.GeographyMultiPolygonTests)
        .select()
        .where(eq(schema.GeographyMultiPolygonTests.id, insertedId));
      expect(row.multipolygon).toBeDefined();
      expect(Array.isArray(row.multipolygon)).toBe(true);
    });

    it("update", async () => {
      const db = getDb();
      await db
        .update(schema.GeographyMultiPolygonTests)
        .set({ multipolygon: mpolyB })
        .where(eq(schema.GeographyMultiPolygonTests.id, insertedId));
      const [row] = await db
        .from(schema.GeographyMultiPolygonTests)
        .select()
        .where(eq(schema.GeographyMultiPolygonTests.id, insertedId));
      expect(row.multipolygon).toBeDefined();
    });
  });
});
