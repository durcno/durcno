import type { GeoJSON } from "geojson";
import {
  Geometry,
  type GeoJSONOptions,
  TwkbPrecision,
  type WkbOptions,
  type TwkbOptions,
} from "./geometry";
import { Types } from "./types";
import { Point } from "./point";
import { BinaryWriter } from "./binarywriter";
import type { BinaryReader } from "./binaryreader";
import type { WktParser, WktParseOptions } from "./wktparser";

export class MultiPoint extends Geometry {
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

  static Z(points?: Point[], srid?: number): MultiPoint {
    const multiPoint = new MultiPoint(points, srid);
    multiPoint.hasZ = true;
    return multiPoint;
  }

  static M(points?: Point[], srid?: number): MultiPoint {
    const multiPoint = new MultiPoint(points, srid);
    multiPoint.hasM = true;
    return multiPoint;
  }

  static ZM(points?: Point[], srid?: number): MultiPoint {
    const multiPoint = new MultiPoint(points, srid);
    multiPoint.hasZ = true;
    multiPoint.hasM = true;
    return multiPoint;
  }

  static _parseWkt(value: WktParser, options: WktParseOptions): MultiPoint {
    const multiPoint = new MultiPoint();
    multiPoint.srid = options.srid;
    multiPoint.hasZ = options.hasZ;
    multiPoint.hasM = options.hasM;

    if (value.isMatch(["EMPTY"])) return multiPoint;

    value.expectGroupStart();
    multiPoint.points = multiPoint.points.concat(
      value.matchCoordinates(options),
    );
    value.expectGroupEnd();

    return multiPoint;
  }

  static _parseWkb(value: BinaryReader, options: WkbOptions): MultiPoint {
    const multiPoint = new MultiPoint();
    multiPoint.srid = options.srid;
    multiPoint.hasZ = options.hasZ || false;
    multiPoint.hasM = options.hasM || false;

    const pointCount = value.readUInt32();

    for (let i = 0; i < pointCount; i++)
      multiPoint.points.push(Geometry.parse(value as any, options) as Point);

    return multiPoint;
  }

  static _parseTwkb(value: BinaryReader, options: TwkbOptions): MultiPoint {
    const multiPoint = new MultiPoint();
    multiPoint.hasZ = options.hasZ || false;
    multiPoint.hasM = options.hasM || false;

    if (options.isEmpty) return multiPoint;

    const previousPoint = new Point(
      0,
      0,
      options.hasZ ? 0 : undefined,
      options.hasM ? 0 : undefined,
    );
    const pointCount = value.readVarInt();

    for (let i = 0; i < pointCount; i++)
      multiPoint.points.push(
        Point._readTwkbPoint(value, options, previousPoint),
      );

    return multiPoint;
  }

  static _parseGeoJSON(value: GeoJSON.MultiPoint): MultiPoint {
    const multiPoint = new MultiPoint();

    if (value.coordinates.length > 0)
      multiPoint.hasZ = value.coordinates[0].length > 2;

    for (let i = 0; i < value.coordinates.length; i++)
      multiPoint.points.push(
        Point._parseGeoJSON({
          type: "Point",
          coordinates: value.coordinates[i],
        }),
      );

    return multiPoint;
  }

  toWkt(): string {
    if (this.points.length === 0)
      return this._getWktType(Types.wkt.MultiPoint, true);

    let wkt = this._getWktType(Types.wkt.MultiPoint, false) + "(";

    for (let i = 0; i < this.points.length; i++)
      wkt +=
        this._getWktCoordinate(
          this.points[i] as { x: number; y: number; z?: number; m?: number },
        ) + ",";

    wkt = wkt.slice(0, -1);
    wkt += ")";

    return wkt;
  }

  toWkb(): Buffer {
    const wkb = new BinaryWriter(this._getWkbSize());

    wkb.writeInt8(1);

    this._writeWkbType(wkb, Types.wkb.MultiPoint);
    wkb.writeUInt32LE(this.points.length);

    for (let i = 0; i < this.points.length; i++)
      wkb.writeBuffer(this.points[i].toWkb({ srid: this.srid }));

    return wkb.buffer;
  }

  toTwkb(): Buffer {
    const twkb = new BinaryWriter(0, true);

    const precision = Geometry.getTwkbPrecision(5, 0, 0);
    const isEmpty = this.points.length === 0;

    this._writeTwkbHeader(twkb, Types.wkb.MultiPoint, precision, isEmpty);

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

    coordinateSize += 5;

    return 1 + 4 + 4 + this.points.length * coordinateSize;
  }

  toGeoJSON(options?: GeoJSONOptions): GeoJSON.MultiPoint & { crs?: any } {
    const geoJSON = super.toGeoJSON(options) as GeoJSON.MultiPoint & {
      crs?: any;
    };
    geoJSON.type = Types.geoJSON.MultiPoint as "MultiPoint";
    geoJSON.coordinates = [];

    for (let i = 0; i < this.points.length; i++)
      geoJSON.coordinates.push(this.points[i].toGeoJSON().coordinates);

    return geoJSON;
  }
}
