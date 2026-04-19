import * as z from "zod";
import { Sql } from "../../../sql";
import { Point } from "../../../wkx";
import { Column, type ColumnConfig } from "../../common";

type As = "xy" | "xyz" | "xym" | "xyzm";

export type PointConfig = ColumnConfig & {
  srid?: number;
  format?: "xy";
};

type GetValType<T extends As | undefined> = T extends "xy"
  ? SelfOrReadonly<[number, number]>
  : T extends "xyz" | "xym"
    ? SelfOrReadonly<[number, number, number]>
    : T extends "xyzm"
      ? SelfOrReadonly<[number, number, number, number]>
      : SelfOrReadonly<[number, number]>;

type GetZodType<T extends As | undefined> = T extends "xy"
  ? z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>
  : T extends "xyz" | "xym"
    ? z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>
    : T extends "xyzm"
      ? z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>
      : z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;

export class PointColumn<TConfig extends PointConfig> extends Column<
  TConfig,
  GetValType<TConfig["format"]>
> {
  static readonly id = "Column.Geography.Point";
  readonly #srid: number;
  readonly #format: TConfig["format"];
  readonly #hasZ: boolean;
  readonly #hasM: boolean;

  constructor(config: TConfig) {
    super(config);
    this.#srid = config.srid ?? 4326;
    this.#format = config.format ?? "xy";
    this.#hasZ = config.format ? config.format.includes("z") : false;
    this.#hasM = config.format ? config.format.includes("m") : false;
  }

  get sqlTypeScalar() {
    return `geography(POINT, ${this.#srid})`;
  }

  get zodTypeScaler(): GetZodType<TConfig["format"]> {
    return z.tuple(
      this.#format
        ? (this.#format.split("").map(() => z.number()) as [z.ZodNumber])
        : [z.number(), z.number()],
    ) as GetZodType<TConfig["format"]>;
  }

  toDriverScalar(value: GetValType<TConfig["format"]> | Sql | null) {
    if (value === null) return null;
    if (value instanceof Sql) return value.string;
    const point = Point.parseGeoJSON({ type: "Point", coordinates: value });
    return `SRID=${this.#srid};${point.toWkt()}`;
  }

  toSQLScalar(value: GetValType<TConfig["format"]> | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    const point = Point.parseGeoJSON({ type: "Point", coordinates: value });
    return `'SRID=${this.#srid};${point.toWkt()}'`;
  }

  fromDriverScalar(value: string | null): GetValType<TConfig["format"]> | null {
    if (value === null) return value;

    const buffer = Buffer.from(value, "hex");
    const geom = Point.parse(buffer, {
      srid: this.#srid,
      hasZ: this.#hasZ,
      hasM: this.#hasM,
    }) as Point;
    const geoJSON = geom.toGeoJSON();

    return geoJSON.coordinates as GetValType<TConfig["format"]>;
  }
}

/**
 * Creates a PostGIS `geography(POINT)` column. Maps to `[lon, lat]` tuple.
 *
 * @example
 * ```ts
 * geography.point({ srid: 4326 }) // geography(POINT, 4326)
 * ```
 *
 * @param config.srid - Spatial reference ID (default: 4326)
 * @param config.format - Coordinate format: `"xy"` (default: `"xy"`)
 */
export function point<TConfig extends PointConfig>(
  config: TConfig,
): PointColumn<TConfig> {
  return new PointColumn(config);
}
