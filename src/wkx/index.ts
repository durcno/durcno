// Import and attach parser to Geometry class
import "./parser";

export { BinaryReader } from "./binaryreader";
export { BinaryWriter } from "./binarywriter";
export {
  type GeoJSONOptions,
  Geometry,
  type TwkbOptions,
  type TwkbPrecision,
  type WkbOptions,
} from "./geometry";
export { GeometryCollection } from "./geometrycollection";
export { LineString } from "./linestring";
export { MultiLineString } from "./multilinestring";
export { MultiPoint } from "./multipoint";
export { MultiPolygon } from "./multipolygon";
export { Point } from "./point";
export { Polygon } from "./polygon";
// Export all types and classes
export { Types } from "./types";
export { WktParser } from "./wktparser";
export { ZigZag } from "./zigzag";
