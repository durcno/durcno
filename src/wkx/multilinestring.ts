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
import { LineString } from "./linestring";
import { BinaryWriter } from "./binarywriter";
import type { BinaryReader } from "./binaryreader";
import type { WktParser, WktParseOptions } from "./wktparser";

export class MultiLineString extends Geometry {
  lineStrings: LineString[];

  constructor(lineStrings?: LineString[], srid?: number) {
    super();

    this.lineStrings = lineStrings || [];
    this.srid = srid;

    if (this.lineStrings.length > 0) {
      this.hasZ = this.lineStrings[0].hasZ;
      this.hasM = this.lineStrings[0].hasM;
    }
  }

  static Z(lineStrings?: LineString[], srid?: number): MultiLineString {
    const multiLineString = new MultiLineString(lineStrings, srid);
    multiLineString.hasZ = true;
    return multiLineString;
  }

  static M(lineStrings?: LineString[], srid?: number): MultiLineString {
    const multiLineString = new MultiLineString(lineStrings, srid);
    multiLineString.hasM = true;
    return multiLineString;
  }

  static ZM(lineStrings?: LineString[], srid?: number): MultiLineString {
    const multiLineString = new MultiLineString(lineStrings, srid);
    multiLineString.hasZ = true;
    multiLineString.hasM = true;
    return multiLineString;
  }

  static _parseWkt(
    value: WktParser,
    options: WktParseOptions,
  ): MultiLineString {
    const multiLineString = new MultiLineString();
    multiLineString.srid = options.srid;
    multiLineString.hasZ = options.hasZ;
    multiLineString.hasM = options.hasM;

    if (value.isMatch(["EMPTY"])) return multiLineString;

    value.expectGroupStart();

    do {
      value.expectGroupStart();
      multiLineString.lineStrings.push(
        new LineString(value.matchCoordinates(options)),
      );
      value.expectGroupEnd();
    } while (value.isMatch([","]));

    value.expectGroupEnd();

    return multiLineString;
  }

  static _parseWkb(value: BinaryReader, options: WkbOptions): MultiLineString {
    const multiLineString = new MultiLineString();
    multiLineString.srid = options.srid;
    multiLineString.hasZ = options.hasZ || false;
    multiLineString.hasM = options.hasM || false;

    const lineStringCount = value.readUInt32();

    for (let i = 0; i < lineStringCount; i++)
      multiLineString.lineStrings.push(
        Geometry.parse(value as any, options) as LineString,
      );

    return multiLineString;
  }

  static _parseTwkb(
    value: BinaryReader,
    options: TwkbOptions,
  ): MultiLineString {
    const multiLineString = new MultiLineString();
    multiLineString.hasZ = options.hasZ || false;
    multiLineString.hasM = options.hasM || false;

    if (options.isEmpty) return multiLineString;

    const previousPoint = new Point(
      0,
      0,
      options.hasZ ? 0 : undefined,
      options.hasM ? 0 : undefined,
    );
    const lineStringCount = value.readVarInt();

    for (let i = 0; i < lineStringCount; i++) {
      const lineString = new LineString();
      lineString.hasZ = options.hasZ || false;
      lineString.hasM = options.hasM || false;

      const pointCount = value.readVarInt();

      for (let j = 0; j < pointCount; j++)
        lineString.points.push(
          Point._readTwkbPoint(value, options, previousPoint),
        );

      multiLineString.lineStrings.push(lineString);
    }

    return multiLineString;
  }

  static _parseGeoJSON(value: GeoJSON.MultiLineString): MultiLineString {
    const multiLineString = new MultiLineString();

    if (value.coordinates.length > 0 && value.coordinates[0].length > 0)
      multiLineString.hasZ = value.coordinates[0][0].length > 2;

    for (let i = 0; i < value.coordinates.length; i++)
      multiLineString.lineStrings.push(
        LineString._parseGeoJSON({
          type: "LineString",
          coordinates: value.coordinates[i],
        }),
      );

    return multiLineString;
  }

  toWkt(): string {
    if (this.lineStrings.length === 0)
      return this._getWktType(Types.wkt.MultiLineString, true);

    let wkt = this._getWktType(Types.wkt.MultiLineString, false) + "(";

    for (let i = 0; i < this.lineStrings.length; i++)
      wkt += this.lineStrings[i]._toInnerWkt() + ",";

    wkt = wkt.slice(0, -1);
    wkt += ")";

    return wkt;
  }

  toWkb(): Buffer {
    const wkb = new BinaryWriter(this._getWkbSize());

    wkb.writeInt8(1);

    this._writeWkbType(wkb, Types.wkb.MultiLineString);
    wkb.writeUInt32LE(this.lineStrings.length);

    for (let i = 0; i < this.lineStrings.length; i++)
      wkb.writeBuffer(this.lineStrings[i].toWkb({ srid: this.srid }));

    return wkb.buffer;
  }

  toTwkb(): Buffer {
    const twkb = new BinaryWriter(0, true);

    const precision = Geometry.getTwkbPrecision(5, 0, 0);
    const isEmpty = this.lineStrings.length === 0;

    this._writeTwkbHeader(twkb, Types.wkb.MultiLineString, precision, isEmpty);

    if (this.lineStrings.length > 0) {
      twkb.writeVarInt(this.lineStrings.length);

      const previousPoint = new Point(0, 0, 0, 0);
      for (let i = 0; i < this.lineStrings.length; i++) {
        twkb.writeVarInt(this.lineStrings[i].points.length);

        for (let j = 0; j < this.lineStrings[i].points.length; j++)
          this.lineStrings[i].points[j]._writeTwkbPoint(
            twkb,
            precision,
            previousPoint,
          );
      }
    }

    return twkb.buffer;
  }

  _getWkbSize(): number {
    let size = 1 + 4 + 4;

    for (let i = 0; i < this.lineStrings.length; i++)
      size += this.lineStrings[i]._getWkbSize();

    return size;
  }

  toGeoJSON(options?: GeoJSONOptions): GeoJSON.MultiLineString & { crs?: any } {
    const geoJSON = super.toGeoJSON(options) as GeoJSON.MultiLineString & {
      crs?: any;
    };
    geoJSON.type = Types.geoJSON.MultiLineString as "MultiLineString";
    geoJSON.coordinates = [];

    for (let i = 0; i < this.lineStrings.length; i++)
      geoJSON.coordinates.push(this.lineStrings[i].toGeoJSON().coordinates);

    return geoJSON;
  }
}
