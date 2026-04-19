import type { GeoJSON } from "geojson";
import type { BinaryReader } from "./binaryreader";
import { BinaryWriter } from "./binarywriter";
import {
  type GeoJSONOptions,
  Geometry,
  type TwkbOptions,
  TwkbPrecision,
  type WkbOptions,
} from "./geometry";
import { Point } from "./point";
import { Types } from "./types";
import type { WktParseOptions, WktParser } from "./wktparser";

export class LineString extends Geometry {
  points: Point[];

  constructor(points?: Point[], srid?: number) {
    super();

    this.points = points || [];
    this.srid = srid;

    if (this.points.length > 0) {
      this.hasZ = this.points[0].hasZ;
      this.hasM = this.points[0].hasM;
    }
  }

  static Z(points?: Point[], srid?: number): LineString {
    const lineString = new LineString(points, srid);
    lineString.hasZ = true;
    return lineString;
  }

  static M(points?: Point[], srid?: number): LineString {
    const lineString = new LineString(points, srid);
    lineString.hasM = true;
    return lineString;
  }

  static ZM(points?: Point[], srid?: number): LineString {
    const lineString = new LineString(points, srid);
    lineString.hasZ = true;
    lineString.hasM = true;
    return lineString;
  }

  static _parseWkt(value: WktParser, options: WktParseOptions): LineString {
    const lineString = new LineString();
    lineString.srid = options.srid;
    lineString.hasZ = options.hasZ;
    lineString.hasM = options.hasM;

    if (value.isMatch(["EMPTY"])) return lineString;

    value.expectGroupStart();
    lineString.points = lineString.points.concat(
      value.matchCoordinates(options),
    );
    value.expectGroupEnd();

    return lineString;
  }

  static _parseWkb(value: BinaryReader, options: WkbOptions): LineString {
    const lineString = new LineString();
    lineString.srid = options.srid;
    lineString.hasZ = options.hasZ || false;
    lineString.hasM = options.hasM || false;

    const pointCount = value.readUInt32();

    for (let i = 0; i < pointCount; i++)
      lineString.points.push(Point._readWkbPoint(value, options));

    return lineString;
  }

  static _parseTwkb(value: BinaryReader, options: TwkbOptions): LineString {
    const lineString = new LineString();
    lineString.hasZ = options.hasZ || false;
    lineString.hasM = options.hasM || false;

    if (options.isEmpty) return lineString;

    const previousPoint = new Point(
      0,
      0,
      options.hasZ ? 0 : undefined,
      options.hasM ? 0 : undefined,
    );
    const pointCount = value.readVarInt();

    for (let i = 0; i < pointCount; i++)
      lineString.points.push(
        Point._readTwkbPoint(value, options, previousPoint),
      );

    return lineString;
  }

  static _parseGeoJSON(value: GeoJSON.LineString): LineString {
    const lineString = new LineString();

    if (value.coordinates.length > 0)
      lineString.hasZ = value.coordinates[0].length > 2;

    for (let i = 0; i < value.coordinates.length; i++)
      lineString.points.push(Point._readGeoJSONPoint(value.coordinates[i]));

    return lineString;
  }

  toWkt(): string {
    if (this.points.length === 0)
      return this._getWktType(Types.wkt.LineString, true);

    return this._getWktType(Types.wkt.LineString, false) + this._toInnerWkt();
  }

  _toInnerWkt(): string {
    let innerWkt = "(";

    for (let i = 0; i < this.points.length; i++)
      innerWkt +=
        this._getWktCoordinate(
          this.points[i] as { x: number; y: number; z?: number; m?: number },
        ) + ",";

    innerWkt = innerWkt.slice(0, -1);
    innerWkt += ")";

    return innerWkt;
  }

  toWkb(parentOptions?: WkbOptions): Buffer {
    const wkb = new BinaryWriter(this._getWkbSize());

    wkb.writeInt8(1);

    this._writeWkbType(wkb, Types.wkb.LineString, parentOptions);
    wkb.writeUInt32LE(this.points.length);

    for (let i = 0; i < this.points.length; i++)
      this.points[i]._writeWkbPoint(wkb);

    return wkb.buffer;
  }

  toTwkb(): Buffer {
    const twkb = new BinaryWriter(0, true);

    const precision = Geometry.getTwkbPrecision(5, 0, 0);
    const isEmpty = this.points.length === 0;

    this._writeTwkbHeader(twkb, Types.wkb.LineString, precision, isEmpty);

    if (this.points.length > 0) {
      twkb.writeVarInt(this.points.length);

      const previousPoint = new Point(0, 0, 0, 0);
      for (let i = 0; i < this.points.length; i++)
        this.points[i]._writeTwkbPoint(twkb, precision, previousPoint);
    }

    return twkb.buffer;
  }

  _getWkbSize(): number {
    let coordinateSize = 16;

    if (this.hasZ) coordinateSize += 8;
    if (this.hasM) coordinateSize += 8;

    return 1 + 4 + 4 + this.points.length * coordinateSize;
  }

  toGeoJSON(options?: GeoJSONOptions): GeoJSON.LineString & { crs?: any } {
    const geoJSON = super.toGeoJSON(options) as GeoJSON.LineString & {
      crs?: any;
    };
    geoJSON.type = Types.geoJSON.LineString as "LineString";
    geoJSON.coordinates = [];

    for (let i = 0; i < this.points.length; i++) {
      if (this.hasZ)
        geoJSON.coordinates.push([
          this.points[i].x!,
          this.points[i].y!,
          this.points[i].z!,
        ]);
      else geoJSON.coordinates.push([this.points[i].x!, this.points[i].y!]);
    }

    return geoJSON;
  }
}
