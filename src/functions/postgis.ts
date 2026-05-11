import type { GeographyPointCol } from "../filters/postgis";
import { pointToQuery } from "../filters/postgis";
import type { Arg, IsArg } from "../query-builders/pre";
import type { Query } from "../query-builders/query";
import type { Or } from "../types";
import { SqlFn } from ".";

// ============================================================================
// ST_Distance (SqlFn — value expression, not a boolean filter)
// ============================================================================

/**
 * Typed SQL value expression: `ST_Distance(col, ST_SetSRID(ST_MakePoint(lon, lat), srid))`
 * Evaluates to the distance in meters between the column and the given point.
 *
 * Can be used in:
 * - `.select({ distance: stDistance(col, point) })` → `{ distance: number }`
 * - `.orderBy(asc(stDistance(col, point)))` — order by proximity
 * - `.where(lt(stDistance(col, point), 5000))` — filter by distance
 *
 * @template TCol - Geography point column type.
 * @template TPoint - Concrete type of the point argument (raw value or `Arg` placeholder).
 * @template TSrid - Concrete type of the srid argument (number or `Arg` placeholder).
 */
export class StDistanceFn<
  TCol extends GeographyPointCol,
  TPoint extends TCol["ValType"] | Arg<TCol["ValType"]>,
  TSrid extends number | Arg<number> = number,
> extends SqlFn<
  number,
  TCol,
  Or<IsArg<TPoint>, IsArg<TSrid>>,
  "scalar",
  "numeric"
> {
  constructor(
    private readonly col: TCol,
    private readonly point: TPoint,
  ) {
    super();
  }

  toQuery(query: Query): void {
    query.sql += `ST_Distance(${this.col.fullName}, `;
    pointToQuery(query, this.point, this.col.toSQL.bind(this.col));
    query.sql += ")";
  }
}

/**
 * Creates a typed SQL value expression that computes the distance in meters
 * between a geography column and the given point.
 *
 * SQL: `ST_Distance(col, ST_SetSRID(ST_MakePoint(lon, lat), srid))`
 *
 * @param col - The geography point column (must be in query scope).
 * @param point - Raw coordinate or `Arg` placeholder typed as the column's `ValType`.
 * @param srid - Spatial reference ID (default: 4326).
 *
 * @example
 * const dist = stDistance(Properties.location, [2.29, 48.85]);
 * db.from(Properties)
 *   .select({ id: true, distance: dist })
 *   .orderBy(asc(dist))
 *   .where(lt(dist, 5000))
 */
export function stDistance<
  TCol extends GeographyPointCol,
  TPoint extends TCol["ValType"] | Arg<TCol["ValType"]>,
  TSrid extends number | Arg<number> = number,
>(col: TCol, point: TPoint): StDistanceFn<TCol, TPoint, TSrid> {
  return new StDistanceFn(col, point);
}
