import type { GeoJSON } from "geojson";
import { BinaryReader } from "./binaryreader";
import { Geometry, type TwkbOptions, type WkbOptions } from "./geometry";
import { GeometryCollection } from "./geometrycollection";
import { LineString } from "./linestring";
import { MultiLineString } from "./multilinestring";
import { MultiPoint } from "./multipoint";
import { MultiPolygon } from "./multipolygon";
import { Point } from "./point";
import { Polygon } from "./polygon";
import { Types } from "./types";
import { WktParser } from "./wktparser";
import { ZigZag } from "./zigzag";

// Parse function that handles both WKT strings and WKB buffers
function parse(
  value: string | Buffer | WktParser | BinaryReader,
  options?: WkbOptions,
): Geometry {
  const valueType = typeof value;

  if (valueType === "string" || value instanceof WktParser)
    return parseWkt(value as string | WktParser);
  else if (Buffer.isBuffer(value) || value instanceof BinaryReader)
    return parseWkb(value as Buffer | BinaryReader, options);
  else throw new Error("first argument must be a string or Buffer");
}

// Parse WKT string
function parseWkt(value: string | WktParser): Geometry {
  let wktParser: WktParser;
  let srid: number | undefined;

  if (value instanceof WktParser) wktParser = value;
  else wktParser = new WktParser(value);

  const match = wktParser.matchRegex([/^SRID=(\d+);/]);
  if (match) srid = parseInt(match[1], 10);

  const geometryType = wktParser.matchType();
  const dimension = wktParser.matchDimension();

  const options = {
    srid: srid,
    hasZ: dimension.hasZ,
    hasM: dimension.hasM,
  };

  switch (geometryType) {
    case Types.wkt.Point:
      return Point._parseWkt(wktParser, options);
    case Types.wkt.LineString:
      return LineString._parseWkt(wktParser, options);
    case Types.wkt.Polygon:
      return Polygon._parseWkt(wktParser, options);
    case Types.wkt.MultiPoint:
      return MultiPoint._parseWkt(wktParser, options);
    case Types.wkt.MultiLineString:
      return MultiLineString._parseWkt(wktParser, options);
    case Types.wkt.MultiPolygon:
      return MultiPolygon._parseWkt(wktParser, options);
    case Types.wkt.GeometryCollection:
      return GeometryCollection._parseWkt(wktParser, options);
    default:
      throw new Error("GeometryType " + geometryType + " not supported");
  }
}

// Parse WKB buffer
function parseWkb(
  value: Buffer | BinaryReader,
  parentOptions?: WkbOptions,
): Geometry {
  let binaryReader: BinaryReader;
  let wkbType: number;
  let geometryType: number;
  const options: WkbOptions = {};

  if (value instanceof BinaryReader) binaryReader = value;
  else binaryReader = new BinaryReader(value);

  binaryReader.isBigEndian = !binaryReader.readInt8();

  wkbType = binaryReader.readUInt32();

  options.hasSrid = (wkbType & 0x20000000) === 0x20000000;
  options.isEwkb =
    !!(wkbType & 0x20000000) ||
    !!(wkbType & 0x40000000) ||
    !!(wkbType & 0x80000000);

  if (options.hasSrid) options.srid = binaryReader.readUInt32();

  options.hasZ = false;
  options.hasM = false;

  if (!options.isEwkb && (!parentOptions || !parentOptions.isEwkb)) {
    if (wkbType >= 1000 && wkbType < 2000) {
      options.hasZ = true;
      geometryType = wkbType - 1000;
    } else if (wkbType >= 2000 && wkbType < 3000) {
      options.hasM = true;
      geometryType = wkbType - 2000;
    } else if (wkbType >= 3000 && wkbType < 4000) {
      options.hasZ = true;
      options.hasM = true;
      geometryType = wkbType - 3000;
    } else {
      geometryType = wkbType;
    }
  } else {
    if (wkbType & 0x80000000) options.hasZ = true;
    if (wkbType & 0x40000000) options.hasM = true;

    geometryType = wkbType & 0xf;
  }

  switch (geometryType) {
    case Types.wkb.Point:
      return Point._parseWkb(binaryReader, options);
    case Types.wkb.LineString:
      return LineString._parseWkb(binaryReader, options);
    case Types.wkb.Polygon:
      return Polygon._parseWkb(binaryReader, options);
    case Types.wkb.MultiPoint:
      return MultiPoint._parseWkb(binaryReader, options);
    case Types.wkb.MultiLineString:
      return MultiLineString._parseWkb(binaryReader, options);
    case Types.wkb.MultiPolygon:
      return MultiPolygon._parseWkb(binaryReader, options);
    case Types.wkb.GeometryCollection:
      return GeometryCollection._parseWkb(binaryReader, options);
    default:
      throw new Error("GeometryType " + geometryType + " not supported");
  }
}

// Parse TWKB buffer
function parseTwkb(value: Buffer | BinaryReader): Geometry {
  let binaryReader: BinaryReader;
  const options: TwkbOptions = {};

  if (value instanceof BinaryReader) binaryReader = value;
  else binaryReader = new BinaryReader(value);

  const type = binaryReader.readUInt8();
  const metadataHeader = binaryReader.readUInt8();

  const geometryType = type & 0x0f;
  options.precision = ZigZag.decode(type >> 4);
  options.precisionFactor = 10 ** options.precision;

  options.hasBoundingBox = (metadataHeader >> 0) & 1;
  options.hasSizeAttribute = (metadataHeader >> 1) & 1;
  options.hasIdList = (metadataHeader >> 2) & 1;
  options.hasExtendedPrecision = (metadataHeader >> 3) & 1;
  options.isEmpty = (metadataHeader >> 4) & 1;

  if (options.hasExtendedPrecision) {
    const extendedPrecision = binaryReader.readUInt8();
    options.hasZ = (extendedPrecision & 0x01) === 0x01;
    options.hasM = (extendedPrecision & 0x02) === 0x02;

    options.zPrecision = ZigZag.decode((extendedPrecision & 0x1c) >> 2);
    options.zPrecisionFactor = 10 ** options.zPrecision;

    options.mPrecision = ZigZag.decode((extendedPrecision & 0xe0) >> 5);
    options.mPrecisionFactor = 10 ** options.mPrecision;
  } else {
    options.hasZ = false;
    options.hasM = false;
  }

  if (options.hasSizeAttribute) binaryReader.readVarInt();
  if (options.hasBoundingBox) {
    let dimensions = 2;

    if (options.hasZ) dimensions++;
    if (options.hasM) dimensions++;

    for (let i = 0; i < dimensions; i++) {
      binaryReader.readVarInt();
      binaryReader.readVarInt();
    }
  }

  switch (geometryType) {
    case Types.wkb.Point:
      return Point._parseTwkb(binaryReader, options);
    case Types.wkb.LineString:
      return LineString._parseTwkb(binaryReader, options);
    case Types.wkb.Polygon:
      return Polygon._parseTwkb(binaryReader, options);
    case Types.wkb.MultiPoint:
      return MultiPoint._parseTwkb(binaryReader, options);
    case Types.wkb.MultiLineString:
      return MultiLineString._parseTwkb(binaryReader, options);
    case Types.wkb.MultiPolygon:
      return MultiPolygon._parseTwkb(binaryReader, options);
    case Types.wkb.GeometryCollection:
      return GeometryCollection._parseTwkb(binaryReader, options);
    default:
      throw new Error("GeometryType " + geometryType + " not supported");
  }
}

// Parse GeoJSON
function parseGeoJSON(value: GeoJSON.GeoJsonObject): Geometry {
  return parseGeoJSONInternal(value as GeoJSON.Geometry);
}

function parseGeoJSONInternal(
  value: GeoJSON.Geometry,
  isSubGeometry: boolean = false,
): Geometry {
  let geometry: Geometry;
  const geometryType = value.type;

  switch (geometryType) {
    case Types.geoJSON.Point:
      geometry = Point._parseGeoJSON(value as GeoJSON.Point);
      break;
    case Types.geoJSON.LineString:
      geometry = LineString._parseGeoJSON(value as GeoJSON.LineString);
      break;
    case Types.geoJSON.Polygon:
      geometry = Polygon._parseGeoJSON(value as GeoJSON.Polygon);
      break;
    case Types.geoJSON.MultiPoint:
      geometry = MultiPoint._parseGeoJSON(value as GeoJSON.MultiPoint);
      break;
    case Types.geoJSON.MultiLineString:
      geometry = MultiLineString._parseGeoJSON(
        value as GeoJSON.MultiLineString,
      );
      break;
    case Types.geoJSON.MultiPolygon:
      geometry = MultiPolygon._parseGeoJSON(value as GeoJSON.MultiPolygon);
      break;
    case Types.geoJSON.GeometryCollection:
      geometry = GeometryCollection._parseGeoJSON(
        value as GeoJSON.GeometryCollection,
      );
      break;
    default:
      throw new Error("GeometryType " + geometryType + " not supported");
  }

  const valueWithCrs = value as any;
  if (
    valueWithCrs.crs &&
    valueWithCrs.crs.type &&
    valueWithCrs.crs.type === "name" &&
    valueWithCrs.crs.properties &&
    valueWithCrs.crs.properties.name
  ) {
    const crs = valueWithCrs.crs.properties.name;

    if (crs.indexOf("EPSG:") === 0) geometry.srid = parseInt(crs.substring(5));
    else if (crs.indexOf("urn:ogc:def:crs:EPSG::") === 0)
      geometry.srid = parseInt(crs.substring(22));
    else throw new Error("Unsupported crs: " + crs);
  } else if (!isSubGeometry) {
    geometry.srid = 4326;
  }

  return geometry;
}

// Attach static methods to Geometry class
Geometry.parse = parse;
Geometry.parseTwkb = parseTwkb;
Geometry.parseGeoJSON = parseGeoJSON;
Geometry._parseWkt = parseWkt as any;
Geometry._parseWkb = parseWkb;
Geometry._parseGeoJSON = parseGeoJSONInternal;

export {
  parse,
  parseGeoJSON,
  parseGeoJSONInternal,
  parseTwkb,
  parseWkb,
  parseWkt,
};
