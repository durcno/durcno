import type { BinaryReader } from "./binaryreader";
import { BinaryWriter } from "./binarywriter";
import {
  type GeoJSONOptions,
  Geometry,
  type TwkbOptions,
  type TwkbPrecision,
  type WkbOptions,
} from "./geometry";
import { Types } from "./types";
import type { WktParseOptions, WktParser } from "./wktparser";
import { ZigZag } from "./zigzag";

export class Point extends Geometry {
  x?: number;
  y?: number;
  z?: number;
  m?: number;

  constructor(x?: number, y?: number, z?: number, m?: number, srid?: number) {
    super();

    this.x = x;
    this.y = y;
    this.z = z;
    this.m = m;
    this.srid = srid;

    this.hasZ = z !== undefined;
    this.hasM = m !== undefined;
  }

  static Z(x: number, y: number, z: number, srid?: number): Point {
    const point = new Point(x, y, z, undefined, srid);
    point.hasZ = true;
    return point;
  }

  static M(x: number, y: number, m: number, srid?: number): Point {
    const point = new Point(x, y, undefined, m, srid);
    point.hasM = true;
    return point;
  }

  static ZM(x: number, y: number, z: number, m: number, srid?: number): Point {
    const point = new Point(x, y, z, m, srid);
    point.hasZ = true;
    point.hasM = true;
    return point;
  }

  static _parseWkt(value: WktParser, options: WktParseOptions): Point {
    const point = new Point();
    point.srid = options.srid;
    point.hasZ = options.hasZ;
    point.hasM = options.hasM;

    if (value.isMatch(["EMPTY"])) return point;

    value.expectGroupStart();

    const coordinate = value.matchCoordinate(options);

    point.x = coordinate.x;
    point.y = coordinate.y;
    point.z = coordinate.z;
    point.m = coordinate.m;

    value.expectGroupEnd();

    return point;
  }

  static _parseWkb(value: BinaryReader, options: WkbOptions): Point {
    const point = Point._readWkbPoint(value, options);
    point.srid = options.srid;
    return point;
  }

  static _readWkbPoint(value: BinaryReader, options: WkbOptions): Point {
    return new Point(
      value.readDouble(),
      value.readDouble(),
      options.hasZ ? value.readDouble() : undefined,
      options.hasM ? value.readDouble() : undefined,
    );
  }

  static _parseTwkb(value: BinaryReader, options: TwkbOptions): Point {
    const point = new Point();
    point.hasZ = options.hasZ || false;
    point.hasM = options.hasM || false;

    if (options.isEmpty) return point;

    point.x =
      ZigZag.decode(value.readVarInt()) / (options.precisionFactor || 1);
    point.y =
      ZigZag.decode(value.readVarInt()) / (options.precisionFactor || 1);
    point.z = options.hasZ
      ? ZigZag.decode(value.readVarInt()) / (options.zPrecisionFactor || 1)
      : undefined;
    point.m = options.hasM
      ? ZigZag.decode(value.readVarInt()) / (options.mPrecisionFactor || 1)
      : undefined;

    return point;
  }

  static _readTwkbPoint(
    value: BinaryReader,
    options: TwkbOptions,
    previousPoint: Point,
  ): Point {
    previousPoint.x =
      (previousPoint.x || 0) +
      ZigZag.decode(value.readVarInt()) / (options.precisionFactor || 1);
    previousPoint.y =
      (previousPoint.y || 0) +
      ZigZag.decode(value.readVarInt()) / (options.precisionFactor || 1);

    if (options.hasZ)
      previousPoint.z =
        (previousPoint.z || 0) +
        ZigZag.decode(value.readVarInt()) / (options.zPrecisionFactor || 1);
    if (options.hasM)
      previousPoint.m =
        (previousPoint.m || 0) +
        ZigZag.decode(value.readVarInt()) / (options.mPrecisionFactor || 1);

    return new Point(
      previousPoint.x,
      previousPoint.y,
      previousPoint.z,
      previousPoint.m,
    );
  }

  static _parseGeoJSON(value: GeoJSON.Point): Point {
    return Point._readGeoJSONPoint(value.coordinates);
  }

  static _readGeoJSONPoint(coordinates: GeoJSON.Position): Point {
    if (coordinates.length === 0) return new Point();

    return new Point(
      coordinates.at(0),
      coordinates.at(1),
      coordinates.at(2),
      coordinates.at(3),
    );
  }

  toWkt(): string {
    if (
      typeof this.x === "undefined" &&
      typeof this.y === "undefined" &&
      typeof this.z === "undefined" &&
      typeof this.m === "undefined"
    )
      return this._getWktType(Types.wkt.Point, true);

    return (
      this._getWktType(Types.wkt.Point, false) +
      "(" +
      this._getWktCoordinate(
        this as { x: number; y: number; z?: number; m?: number },
      ) +
      ")"
    );
  }

  toWkb(parentOptions?: WkbOptions): Buffer {
    const wkb = new BinaryWriter(this._getWkbSize());

    wkb.writeInt8(1);
    this._writeWkbType(wkb, Types.wkb.Point, parentOptions);

    if (typeof this.x === "undefined" && typeof this.y === "undefined") {
      wkb.writeDoubleLE(NaN);
      wkb.writeDoubleLE(NaN);

      if (this.hasZ) wkb.writeDoubleLE(NaN);
      if (this.hasM) wkb.writeDoubleLE(NaN);
    } else {
      this._writeWkbPoint(wkb);
    }

    return wkb.buffer;
  }

  _writeWkbPoint(wkb: BinaryWriter): void {
    wkb.writeDoubleLE(this.x!);
    wkb.writeDoubleLE(this.y!);

    if (this.hasZ) wkb.writeDoubleLE(this.z!);
    if (this.hasM) wkb.writeDoubleLE(this.m!);
  }

  toTwkb(): Buffer {
    const twkb = new BinaryWriter(0, true);

    const precision = Geometry.getTwkbPrecision(5, 0, 0);
    const isEmpty =
      typeof this.x === "undefined" && typeof this.y === "undefined";

    this._writeTwkbHeader(twkb, Types.wkb.Point, precision, isEmpty);

    if (!isEmpty) this._writeTwkbPoint(twkb, precision, new Point(0, 0, 0, 0));

    return twkb.buffer;
  }

  _writeTwkbPoint(
    twkb: BinaryWriter,
    precision: TwkbPrecision,
    previousPoint: Point,
  ): void {
    const x = (this.x || 0) * precision.xyFactor;
    const y = (this.y || 0) * precision.xyFactor;
    const z = (this.z || 0) * precision.zFactor;
    const m = (this.m || 0) * precision.mFactor;

    twkb.writeVarInt(ZigZag.encode(x - (previousPoint.x || 0)));
    twkb.writeVarInt(ZigZag.encode(y - (previousPoint.y || 0)));
    if (this.hasZ) twkb.writeVarInt(ZigZag.encode(z - (previousPoint.z || 0)));
    if (this.hasM) twkb.writeVarInt(ZigZag.encode(m - (previousPoint.m || 0)));

    previousPoint.x = x;
    previousPoint.y = y;
    previousPoint.z = z;
    previousPoint.m = m;
  }

  _getWkbSize(): number {
    let size = 1 + 4 + 8 + 8;

    if (this.hasZ) size += 8;
    if (this.hasM) size += 8;

    return size;
  }

  toGeoJSON(options?: GeoJSONOptions): GeoJSON.Point & { crs?: any } {
    const geoJSON = super.toGeoJSON(options) as GeoJSON.Point & { crs?: any };
    geoJSON.type = Types.geoJSON.Point as "Point";

    if (typeof this.x === "undefined" && typeof this.y === "undefined")
      geoJSON.coordinates = [];
    else if (typeof this.z !== "undefined")
      geoJSON.coordinates = [this.x!, this.y!, this.z];
    else geoJSON.coordinates = [this.x!, this.y!];

    return geoJSON;
  }
}
