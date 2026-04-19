import * as z from "zod";
import { Sql } from "../../../sql";
import { Polygon } from "../../../wkx";
import { Column, type ColumnConfig } from "../../common";

type As = "xy" | "xyz" | "xym" | "xyzm";

export type PolygonConfig = ColumnConfig & {
  srid?: number;
  format?: "xy";
};

type GetPointType<T extends As | undefined> = T extends "xy"
  ? SelfOrReadonly<[number, number]>
  : T extends "xyz" | "xym"
    ? SelfOrReadonly<[number, number, number]>
    : T extends "xyzm"
      ? SelfOrReadonly<[number, number, number, number]>
      : SelfOrReadonly<[number, number]>;

type GetRingType<T extends As | undefined> = SelfOrReadonly<GetPointType<T>[]>;

// A polygon is an array of rings: [exterior_ring, ...interior_rings]
type GetValType<T extends As | undefined> = SelfOrReadonly<GetRingType<T>[]>;

type GetPointZodType<T extends As | undefined> = T extends "xy"
  ? z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>
  : T extends "xyz" | "xym"
    ? z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>
    : T extends "xyzm"
      ? z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>
      : z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;

type GetZodType<T extends As | undefined> = z.ZodArray<
  z.ZodArray<GetPointZodType<T>>
>;

export class PolygonColumn<TConfig extends PolygonConfig> extends Column<
  TConfig,
  GetValType<TConfig["format"]>
> {
  static readonly id = "Column.Geography.Polygon";
  readonly #srid: number;
  readonly #as: TConfig["format"];
  readonly #hasZ: boolean;
  readonly #hasM: boolean;

  constructor(config: TConfig) {
    super(config);
    this.#srid = config.srid ?? 4326;
    this.#as = config.format ?? "xy";
    this.#hasZ = config.format ? config.format.includes("z") : false;
    this.#hasM = config.format ? config.format.includes("m") : false;
  }

  get sqlTypeScalar() {
    return `geography(POLYGON, ${this.#srid})`;
  }

  get zodTypeScaler(): GetZodType<TConfig["format"]> {
    const pointTuple = z.tuple(
      this.#as
        ? (this.#as.split("").map(() => z.number()) as [z.ZodNumber])
        : [z.number(), z.number()],
    );
    return z.array(z.array(pointTuple)) as GetZodType<TConfig["format"]>;
  }

  toDriverScalar(value: GetValType<TConfig["format"]> | Sql | null) {
    if (value === null) return null;
    if (value instanceof Sql) return value.string;
    const polygon = Polygon.parseGeoJSON({
      type: "Polygon",
      coordinates: value,
    });
    return `SRID=${this.#srid};${polygon.toWkt()}`;
  }

  toSQLScalar(value: GetValType<TConfig["format"]> | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    const polygon = Polygon.parseGeoJSON({
      type: "Polygon",
      coordinates: value,
    });
    return `'SRID=${this.#srid};${polygon.toWkt()}'`;
  }

  fromDriverScalar(value: string | null): GetValType<TConfig["format"]> | null {
    if (value === null) return value;

    const buffer = Buffer.from(value, "hex");
    const geom = Polygon.parse(buffer, {
      srid: this.#srid,
      hasZ: this.#hasZ,
      hasM: this.#hasM,
    }) as Polygon;
    const geoJSON = geom.toGeoJSON();

    return geoJSON.coordinates as GetValType<TConfig["format"]>;
  }
}

/**
 * Creates a PostGIS `geography(POLYGON)` column. Maps to an array of rings (arrays of `[lon, lat]` tuples).
 *
 * @example
 * ```ts
 * geography.polygon({ srid: 4326 }) // geography(POLYGON, 4326)
 * ```
 *
 * @param config.srid - Spatial reference ID (default: 4326)
 * @param config.format - Coordinate format: `"xy"` (default: `"xy"`)
 */
export function polygon<TConfig extends PolygonConfig>(
  config: TConfig,
): PolygonColumn<TConfig> {
  return new PolygonColumn(config);
}
