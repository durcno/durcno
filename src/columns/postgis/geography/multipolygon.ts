import * as z from "zod";
import { Sql } from "../../../sql";
import type { SelfOrReadonly } from "../../../types";
import { MultiPolygon } from "../../../wkx";
import { Column, type ColumnConfig } from "../../common";

type As = "xy" | "xyz" | "xym" | "xyzm";

export type MultiPolygonConfig = ColumnConfig & {
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

type GetPolygonType<T extends As | undefined> = SelfOrReadonly<
  GetRingType<T>[]
>;

// A multipolygon is an array of polygons
type GetValType<T extends As | undefined> = SelfOrReadonly<GetPolygonType<T>[]>;

type GetPointZodType<T extends As | undefined> = T extends "xy"
  ? z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>
  : T extends "xyz" | "xym"
    ? z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber], null>
    : T extends "xyzm"
      ? z.ZodTuple<[z.ZodNumber, z.ZodNumber, z.ZodNumber, z.ZodNumber], null>
      : z.ZodTuple<[z.ZodNumber, z.ZodNumber], null>;

type GetZodType<T extends As | undefined> = z.ZodArray<
  z.ZodArray<z.ZodArray<GetPointZodType<T>>>
>;

export class MultiPolygonColumn<
  TConfig extends MultiPolygonConfig,
> extends Column<TConfig, GetValType<TConfig["format"]>, "geography"> {
  static readonly id = "Column.Geography.MultiPolygon";
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
    return `geography(MULTIPOLYGON, ${this.#srid})`;
  }

  get sqlCastScalar() {
    return "geography";
  }

  get zodTypeScaler(): GetZodType<TConfig["format"]> {
    const pointTuple = z.tuple(
      this.#as
        ? (this.#as.split("").map(() => z.number()) as [z.ZodNumber])
        : [z.number(), z.number()],
    );
    return z.array(z.array(z.array(pointTuple))) as GetZodType<
      TConfig["format"]
    >;
  }

  toDriverScalar(value: GetValType<TConfig["format"]> | Sql | null) {
    if (value === null) return null;
    if (value instanceof Sql) return value.string;
    const multiPolygon = MultiPolygon.parseGeoJSON({
      type: "MultiPolygon",
      coordinates: value,
    });
    return `SRID=${this.#srid};${multiPolygon.toWkt()}`;
  }

  toSQLScalar(value: GetValType<TConfig["format"]> | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    const multiPolygon = MultiPolygon.parseGeoJSON({
      type: "MultiPolygon",
      coordinates: value,
    });
    return `'SRID=${this.#srid};${multiPolygon.toWkt()}'`;
  }

  fromDriverScalar(value: string | null): GetValType<TConfig["format"]> | null {
    if (value === null) return value;

    const buffer = Buffer.from(value, "hex");
    const geom = MultiPolygon.parse(buffer, {
      srid: this.#srid,
      hasZ: this.#hasZ,
      hasM: this.#hasM,
    }) as MultiPolygon;
    const geoJSON = geom.toGeoJSON();

    return geoJSON.coordinates as GetValType<TConfig["format"]>;
  }
}

/**
 * Creates a PostGIS `geography(MULTIPOLYGON)` column. Maps to an array of polygons.
 *
 * @example
 * ```ts
 * geography.multipolygon({ srid: 4326 }) // geography(MULTIPOLYGON, 4326)
 * ```
 *
 * @param config.srid - Spatial reference ID (default: 4326)
 * @param config.format - Coordinate format: `"xy"` (default: `"xy"`)
 */
export function multipolygon<TConfig extends MultiPolygonConfig>(
  config: TConfig,
): MultiPolygonColumn<TConfig> {
  return new MultiPolygonColumn(config);
}
