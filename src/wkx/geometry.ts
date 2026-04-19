import type { GeoJSON } from "geojson";
import { BinaryWriter } from "./binarywriter";
import { ZigZag } from "./zigzag";

export interface GeoJSONOptions {
  shortCrs?: boolean;
  longCrs?: boolean;
}

export interface TwkbPrecision {
  xy: number;
  z: number;
  m: number;
  xyFactor: number;
  zFactor: number;
  mFactor: number;
}

export interface WkbOptions {
  srid?: number;
  hasZ?: boolean;
  hasM?: boolean;
  hasSrid?: boolean;
  isEwkb?: boolean;
}

export interface TwkbOptions {
  precision?: number;
  precisionFactor?: number;
  zPrecision?: number;
  zPrecisionFactor?: number;
  mPrecision?: number;
  mPrecisionFactor?: number;
  hasBoundingBox?: number;
  hasSizeAttribute?: number;
  hasIdList?: number;
  hasExtendedPrecision?: number;
  isEmpty?: number;
  hasZ?: boolean;
  hasM?: boolean;
}

export abstract class Geometry {
  srid?: number;
  hasZ: boolean = false;
  hasM: boolean = false;

  // Static parse methods - are attached by parser.ts
  static parse: (
    value: string | Buffer | any,
    options?: WkbOptions,
  ) => Geometry;
  static parseTwkb: (value: Buffer | any) => Geometry;
  static parseGeoJSON: (value: GeoJSON.GeoJsonObject | any) => Geometry;

  // Internal parse methods - are attached by parser.ts
  static _parseWkt: (value: any, options?: any) => Geometry;
  static _parseWkb: (value: any, options?: any) => Geometry;
  static _parseGeoJSON: (value: any, isSubGeometry?: boolean) => Geometry;

  abstract toWkt(): string;
  abstract toWkb(parentOptions?: WkbOptions): Buffer;
  abstract toTwkb(): Buffer;
  abstract _getWkbSize(): number;

  toEwkt(): string {
    return "SRID=" + this.srid + ";" + this.toWkt();
  }

  toEwkb(): Buffer {
    const ewkb = new BinaryWriter(this._getWkbSize() + 4);
    const wkb = this.toWkb();

    ewkb.writeInt8(1);
    ewkb.writeUInt32LE(
      (wkb.slice(1, 5).readUInt32LE(0) | 0x20000000) >>> 0,
      true,
    );
    ewkb.writeUInt32LE(this.srid || 0);

    ewkb.writeBuffer(wkb.slice(5));

    return ewkb.buffer;
  }

  _getWktType(wktType: string, isEmpty: boolean): string {
    let wkt = wktType;

    if (this.hasZ && this.hasM) wkt += " ZM ";
    else if (this.hasZ) wkt += " Z ";
    else if (this.hasM) wkt += " M ";

    if (isEmpty && !this.hasZ && !this.hasM) wkt += " ";

    if (isEmpty) wkt += "EMPTY";

    return wkt;
  }

  _getWktCoordinate(point: {
    x: number;
    y: number;
    z?: number;
    m?: number;
  }): string {
    let coordinates = point.x + " " + point.y;

    if (this.hasZ) coordinates += " " + point.z;
    if (this.hasM) coordinates += " " + point.m;

    return coordinates;
  }

  _writeWkbType(
    wkb: BinaryWriter,
    geometryType: number,
    parentOptions?: WkbOptions,
  ): void {
    let dimensionType = 0;

    if (
      typeof this.srid === "undefined" &&
      (!parentOptions || typeof parentOptions.srid === "undefined")
    ) {
      if (this.hasZ && this.hasM) dimensionType += 3000;
      else if (this.hasZ) dimensionType += 1000;
      else if (this.hasM) dimensionType += 2000;
    } else {
      if (this.hasZ) dimensionType |= 0x80000000;
      if (this.hasM) dimensionType |= 0x40000000;
    }

    wkb.writeUInt32LE((dimensionType + geometryType) >>> 0, true);
  }

  static getTwkbPrecision(
    xyPrecision: number,
    zPrecision: number,
    mPrecision: number,
  ): TwkbPrecision {
    return {
      xy: xyPrecision,
      z: zPrecision,
      m: mPrecision,
      xyFactor: 10 ** xyPrecision,
      zFactor: 10 ** zPrecision,
      mFactor: 10 ** mPrecision,
    };
  }

  _writeTwkbHeader(
    twkb: BinaryWriter,
    geometryType: number,
    precision: TwkbPrecision,
    isEmpty: boolean,
  ): void {
    const type = (ZigZag.encode(precision.xy) << 4) + geometryType;
    let metadataHeader = (this.hasZ || this.hasM ? 1 : 0) << 3;
    metadataHeader += (isEmpty ? 1 : 0) << 4;

    twkb.writeUInt8(type);
    twkb.writeUInt8(metadataHeader);

    if (this.hasZ || this.hasM) {
      let extendedPrecision = 0;
      if (this.hasZ) extendedPrecision |= 0x1;
      if (this.hasM) extendedPrecision |= 0x2;

      twkb.writeUInt8(extendedPrecision);
    }
  }

  toGeoJSON(options?: GeoJSONOptions): GeoJSON.GeoJsonObject {
    const geoJSON: any = {};

    if (this.srid) {
      if (options) {
        if (options.shortCrs) {
          geoJSON.crs = {
            type: "name",
            properties: {
              name: "EPSG:" + this.srid,
            },
          };
        } else if (options.longCrs) {
          geoJSON.crs = {
            type: "name",
            properties: {
              name: "urn:ogc:def:crs:EPSG::" + this.srid,
            },
          };
        }
      }
    }

    return geoJSON;
  }
}
