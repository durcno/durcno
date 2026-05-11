/**
 * PostGIS spatial filters.
 *
 * **Spatial predicates** (extend `Filter`, usable in `.where()`):
 * - `stDWithin`    — `ST_DWithin(col, point, radius)`
 * - `stIntersects` — `ST_Intersects(col, point)`
 * - `stContains`   — `ST_Contains(col, point)`
 * - `stWithin`     — `ST_Within(col, point)`
 *
 * All factories accept either a raw coordinate value or an `Arg<T>` placeholder.
 * When an `Arg` is passed the resulting filter carries `THasArg = true`
 * and is only accepted inside prepared queries (`db.prepare()`).
 */
import type { PointColumn } from "../columns/postgis/geography/point";
import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/pre";
import type { Query } from "../query-builders/query";
import type { TableColumn } from "../table";
import type { Or } from "../types";
import { Filter } from ".";

/** Constrains `TCol` to geography point columns only. */
// biome-ignore lint/suspicious/noExplicitAny: <>
export type GeographyPointCol = TableColumn<any, any, any, PointColumn<any>>;

/** Writes `ST_PointFromText(point)` into `query.sql`, supporting `Arg<string>` for point. */
export function pointToQuery(
  query: Query,
  point: GeographyPointCol["ValType"] | Arg<GeographyPointCol["ValType"]>,
  toSQL: (value: GeographyPointCol["ValType"]) => string,
): void {
  query.sql += `ST_PointFromText(`;
  if (is(point, Arg<GeographyPointCol["ValType"]>)) {
    query.addArg(point);
  } else {
    query.sql += toSQL(point);
  }
  query.sql += ")";
}

// ============================================================================
// ST_DWithin
// ============================================================================

/**
 * Spatial filter: `ST_DWithin(col, ST_SetSRID(ST_MakePoint(lon, lat), srid), radius)`
 * Returns true if the geometry column is within `radius` meters of the given point.
 *
 * @template TCol - Geography point column type.
 * @template TPoint - Concrete type of the point argument (raw value or `Arg` placeholder).
 * @template TRadius - Concrete type of the radius argument (number or `Arg` placeholder).
 * @template TSrid - Concrete type of the srid argument (number or `Arg` placeholder).
 */
export class StDWithinFilter<
  TCol extends GeographyPointCol,
  TPoint extends TCol["ValType"] | Arg<TCol["ValType"]>,
  TRadius extends number | Arg<number>,
> extends Filter<TCol, Or<IsArg<TPoint>, IsArg<TRadius>>> {
  constructor(
    private readonly col: TCol,
    private readonly point: TPoint,
    private readonly radius: TRadius,
  ) {
    super();
  }

  toQuery(query: Query): void {
    query.sql += `ST_DWithin(${this.col.fullName}, `;
    pointToQuery(query, this.point, this.col.toSQL.bind(this.col));
    query.sql += ", ";
    if (is(this.radius, Arg<number>)) {
      query.addArg(this.radius);
    } else {
      query.sql += this.radius.toString();
    }
    query.sql += ")";
  }
}

/**
 * Creates a condition that checks if a geography column is within `radius` meters
 * of the given point.
 *
 * SQL: `ST_DWithin(col, ST_SetSRID(ST_MakePoint(lon, lat), srid), radius)`
 *
 * @param col - The geography point column (must be in query scope).
 * @param point - Raw coordinate or `Arg` placeholder typed as the column's `ValType`.
 * @param radius - Search radius in meters, or an `Arg<number>` placeholder for prepared queries.
 *
 * @example
 * db.from(Properties).select().where(stDWithin(Properties.location, [2.29, 48.85], 5000))
 */
export function stDWithin<
  TCol extends GeographyPointCol,
  TPoint extends TCol["ValType"] | Arg<TCol["ValType"]>,
  TRadius extends number | Arg<number>,
>(
  col: TCol,
  point: TPoint,
  radius: TRadius,
): StDWithinFilter<TCol, TPoint, TRadius> {
  return new StDWithinFilter(col, point, radius);
}

// ============================================================================
// ST_Intersects
// ============================================================================

/**
 * Spatial filter: `ST_Intersects(col, ST_SetSRID(ST_MakePoint(lon, lat), srid))`
 * Returns true if the geometry column intersects the given point.
 *
 * @template TCol - Geography point column type.
 * @template TPoint - Concrete type of the point argument (raw value or `Arg` placeholder).
 * @template TSrid - Concrete type of the srid argument (number or `Arg` placeholder).
 */
export class StIntersectsFilter<
  TCol extends GeographyPointCol,
  TPoint extends TCol["ValType"] | Arg<TCol["ValType"]>,
> extends Filter<TCol, IsArg<TPoint>> {
  constructor(
    private readonly col: TCol,
    private readonly point: TPoint,
  ) {
    super();
  }

  toQuery(query: Query): void {
    query.sql += `ST_Intersects(${this.col.fullName}, `;
    pointToQuery(query, this.point, this.col.toSQL.bind(this.col));
    query.sql += ")";
  }
}

/**
 * Creates a condition that checks if a geography column intersects the given point.
 *
 * SQL: `ST_Intersects(col, ST_SetSRID(ST_MakePoint(lon, lat), srid))`
 *
 * @param col - The geography point column (must be in query scope).
 * @param point - Raw coordinate or `Arg` placeholder typed as the column's `ValType`.
 */
export function stIntersects<
  TCol extends GeographyPointCol,
  TPoint extends TCol["ValType"] | Arg<TCol["ValType"]>,
>(col: TCol, point: TPoint): StIntersectsFilter<TCol, TPoint> {
  return new StIntersectsFilter(col, point);
}

// ============================================================================
// ST_Contains
// ============================================================================

/**
 * Spatial filter: `ST_Contains(col, ST_SetSRID(ST_MakePoint(lon, lat), srid))`
 * Returns true if the geometry column contains the given point.
 *
 * @template TCol - Geography point column type.
 * @template TPoint - Concrete type of the point argument (raw value or `Arg` placeholder).
 * @template TSrid - Concrete type of the srid argument (number or `Arg` placeholder).
 */
export class StContainsFilter<
  TCol extends GeographyPointCol,
  TPoint extends TCol["ValType"] | Arg<TCol["ValType"]>,
> extends Filter<TCol, IsArg<TPoint>> {
  constructor(
    private readonly col: TCol,
    private readonly point: TPoint,
  ) {
    super();
  }

  toQuery(query: Query): void {
    query.sql += `ST_Contains(${this.col.fullName}, `;
    pointToQuery(query, this.point, this.col.toSQL.bind(this.col));
    query.sql += ")";
  }
}

/**
 * Creates a condition that checks if a geography column contains the given point.
 *
 * SQL: `ST_Contains(col, ST_SetSRID(ST_MakePoint(lon, lat), srid))`
 *
 * @param col - The geography point column (must be in query scope).
 * @param point - Raw coordinate or `Arg` placeholder typed as the column's `ValType`.
 */
export function stContains<
  TCol extends GeographyPointCol,
  TPoint extends TCol["ValType"] | Arg<TCol["ValType"]>,
>(col: TCol, point: TPoint): StContainsFilter<TCol, TPoint> {
  return new StContainsFilter(col, point);
}

// ============================================================================
// ST_Within
// ============================================================================

/**
 * Spatial filter: `ST_Within(col, ST_SetSRID(ST_MakePoint(lon, lat), srid))`
 * Returns true if the geometry column is within the given point geometry.
 *
 * @template TCol - Geography point column type.
 * @template TPoint - Concrete type of the point argument (raw value or `Arg` placeholder).
 * @template TSrid - Concrete type of the srid argument (number or `Arg` placeholder).
 */
export class StWithinFilter<
  TCol extends GeographyPointCol,
  TPoint extends TCol["ValType"] | Arg<TCol["ValType"]>,
> extends Filter<TCol, IsArg<TPoint>> {
  constructor(
    private readonly col: TCol,
    private readonly point: TPoint,
  ) {
    super();
  }

  toQuery(query: Query): void {
    query.sql += `ST_Within(${this.col.fullName}, `;
    pointToQuery(query, this.point, this.col.toSQL.bind(this.col));
    query.sql += ")";
  }
}

/**
 * Creates a condition that checks if a geography column is within the given point geometry.
 *
 * SQL: `ST_Within(col, ST_SetSRID(ST_MakePoint(lon, lat), srid))`
 *
 * @param col - The geography point column (must be in query scope).
 * @param point - Raw coordinate or `Arg` placeholder typed as the column's `ValType`.
 */
export function stWithin<
  TCol extends GeographyPointCol,
  TPoint extends TCol["ValType"] | Arg<TCol["ValType"]>,
>(col: TCol, point: TPoint): StWithinFilter<TCol, TPoint> {
  return new StWithinFilter(col, point);
}
