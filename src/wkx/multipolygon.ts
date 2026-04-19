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
import { Polygon } from "./polygon";
import { BinaryWriter } from "./binarywriter";
import type { BinaryReader } from "./binaryreader";
import type { WktParser, WktParseOptions } from "./wktparser";

export class MultiPolygon extends Geometry {
  polygons: Polygon[];

  constructor(polygons?: Polygon[], srid?: number) {
    super();

    this.polygons = polygons || [];
    this.srid = srid;

    if (this.polygons.length > 0) {
      this.hasZ = this.polygons[0].hasZ;
      this.hasM = this.polygons[0].hasM;
    }
  }

  static Z(polygons?: Polygon[], srid?: number): MultiPolygon {
    const multiPolygon = new MultiPolygon(polygons, srid);
    multiPolygon.hasZ = true;
    return multiPolygon;
  }

  static M(polygons?: Polygon[], srid?: number): MultiPolygon {
    const multiPolygon = new MultiPolygon(polygons, srid);
    multiPolygon.hasM = true;
    return multiPolygon;
  }

  static ZM(polygons?: Polygon[], srid?: number): MultiPolygon {
    const multiPolygon = new MultiPolygon(polygons, srid);
    multiPolygon.hasZ = true;
    multiPolygon.hasM = true;
    return multiPolygon;
  }

  static _parseWkt(value: WktParser, options: WktParseOptions): MultiPolygon {
    const multiPolygon = new MultiPolygon();
    multiPolygon.srid = options.srid;
    multiPolygon.hasZ = options.hasZ;
    multiPolygon.hasM = options.hasM;

    if (value.isMatch(["EMPTY"])) return multiPolygon;

    value.expectGroupStart();

    do {
      value.expectGroupStart();

      let exteriorRing: Point[] = [];
      const interiorRings: Point[][] = [];

      value.expectGroupStart();
      exteriorRing = exteriorRing.concat(value.matchCoordinates(options));
      value.expectGroupEnd();

      while (value.isMatch([","])) {
        value.expectGroupStart();
        interiorRings.push(value.matchCoordinates(options));
        value.expectGroupEnd();
      }

      multiPolygon.polygons.push(new Polygon(exteriorRing, interiorRings));

      value.expectGroupEnd();
    } while (value.isMatch([","]));

    value.expectGroupEnd();

    return multiPolygon;
  }

  static _parseWkb(value: BinaryReader, options: WkbOptions): MultiPolygon {
    const multiPolygon = new MultiPolygon();
    multiPolygon.srid = options.srid;
    multiPolygon.hasZ = options.hasZ || false;
    multiPolygon.hasM = options.hasM || false;

    const polygonCount = value.readUInt32();

    for (let i = 0; i < polygonCount; i++)
      multiPolygon.polygons.push(
        Geometry.parse(value as any, options) as Polygon,
      );

    return multiPolygon;
  }

  static _parseTwkb(value: BinaryReader, options: TwkbOptions): MultiPolygon {
    const multiPolygon = new MultiPolygon();
    multiPolygon.hasZ = options.hasZ || false;
    multiPolygon.hasM = options.hasM || false;

    if (options.isEmpty) return multiPolygon;

    const previousPoint = new Point(
      0,
      0,
      options.hasZ ? 0 : undefined,
      options.hasM ? 0 : undefined,
    );
    const polygonCount = value.readVarInt();

    for (let i = 0; i < polygonCount; i++) {
      const polygon = new Polygon();
      polygon.hasZ = options.hasZ || false;
      polygon.hasM = options.hasM || false;

      const ringCount = value.readVarInt();
      const exteriorRingCount = value.readVarInt();

      for (let j = 0; j < exteriorRingCount; j++)
        polygon.exteriorRing.push(
          Point._readTwkbPoint(value, options, previousPoint),
        );

      for (let j = 1; j < ringCount; j++) {
        const interiorRing: Point[] = [];

        const interiorRingCount = value.readVarInt();

        for (let k = 0; k < interiorRingCount; k++)
          interiorRing.push(
            Point._readTwkbPoint(value, options, previousPoint),
          );

        polygon.interiorRings.push(interiorRing);
      }

      multiPolygon.polygons.push(polygon);
    }

    return multiPolygon;
  }

  static _parseGeoJSON(value: GeoJSON.MultiPolygon): MultiPolygon {
    const multiPolygon = new MultiPolygon();

    if (
      value.coordinates.length > 0 &&
      value.coordinates[0].length > 0 &&
      value.coordinates[0][0].length > 0
    )
      multiPolygon.hasZ = value.coordinates[0][0][0].length > 2;

    for (let i = 0; i < value.coordinates.length; i++)
      multiPolygon.polygons.push(
        Polygon._parseGeoJSON({
          type: "Polygon",
          coordinates: value.coordinates[i],
        }),
      );

    return multiPolygon;
  }

  toWkt(): string {
    if (this.polygons.length === 0)
      return this._getWktType(Types.wkt.MultiPolygon, true);

    let wkt = this._getWktType(Types.wkt.MultiPolygon, false) + "(";

    for (let i = 0; i < this.polygons.length; i++)
      wkt += this.polygons[i]._toInnerWkt() + ",";

    wkt = wkt.slice(0, -1);
    wkt += ")";

    return wkt;
  }

  toWkb(): Buffer {
    const wkb = new BinaryWriter(this._getWkbSize());

    wkb.writeInt8(1);

    this._writeWkbType(wkb, Types.wkb.MultiPolygon);
    wkb.writeUInt32LE(this.polygons.length);

    for (let i = 0; i < this.polygons.length; i++)
      wkb.writeBuffer(this.polygons[i].toWkb({ srid: this.srid }));

    return wkb.buffer;
  }

  toTwkb(): Buffer {
    const twkb = new BinaryWriter(0, true);

    const precision = Geometry.getTwkbPrecision(5, 0, 0);
    const isEmpty = this.polygons.length === 0;

    this._writeTwkbHeader(twkb, Types.wkb.MultiPolygon, precision, isEmpty);

    if (this.polygons.length > 0) {
      twkb.writeVarInt(this.polygons.length);

      const previousPoint = new Point(0, 0, 0, 0);
      for (let i = 0; i < this.polygons.length; i++) {
        twkb.writeVarInt(1 + this.polygons[i].interiorRings.length);

        twkb.writeVarInt(this.polygons[i].exteriorRing.length);

        for (let j = 0; j < this.polygons[i].exteriorRing.length; j++)
          this.polygons[i].exteriorRing[j]._writeTwkbPoint(
            twkb,
            precision,
            previousPoint,
          );

        for (let j = 0; j < this.polygons[i].interiorRings.length; j++) {
          twkb.writeVarInt(this.polygons[i].interiorRings[j].length);

          for (let k = 0; k < this.polygons[i].interiorRings[j].length; k++)
            this.polygons[i].interiorRings[j][k]._writeTwkbPoint(
              twkb,
              precision,
              previousPoint,
            );
        }
      }
    }

    return twkb.buffer;
  }

  _getWkbSize(): number {
    let size = 1 + 4 + 4;

    for (let i = 0; i < this.polygons.length; i++)
      size += this.polygons[i]._getWkbSize();

    return size;
  }

  toGeoJSON(options?: GeoJSONOptions): GeoJSON.MultiPolygon & { crs?: any } {
    const geoJSON = super.toGeoJSON(options) as GeoJSON.MultiPolygon & {
      crs?: any;
    };
    geoJSON.type = Types.geoJSON.MultiPolygon as "MultiPolygon";
    geoJSON.coordinates = [];

    for (let i = 0; i < this.polygons.length; i++)
      geoJSON.coordinates.push(this.polygons[i].toGeoJSON().coordinates);

    return geoJSON;
  }
}
