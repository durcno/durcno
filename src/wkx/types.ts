export const Types = {
  wkt: {
    Point: "POINT",
    LineString: "LINESTRING",
    Polygon: "POLYGON",
    MultiPoint: "MULTIPOINT",
    MultiLineString: "MULTILINESTRING",
    MultiPolygon: "MULTIPOLYGON",
    GeometryCollection: "GEOMETRYCOLLECTION",
  },
  wkb: {
    Point: 1,
    LineString: 2,
    Polygon: 3,
    MultiPoint: 4,
    MultiLineString: 5,
    MultiPolygon: 6,
    GeometryCollection: 7,
  },
  geoJSON: {
    Point: "Point",
    LineString: "LineString",
    Polygon: "Polygon",
    MultiPoint: "MultiPoint",
    MultiLineString: "MultiLineString",
    MultiPolygon: "MultiPolygon",
    GeometryCollection: "GeometryCollection",
  },
} as const;

export type WktType = (typeof Types.wkt)[keyof typeof Types.wkt];
export type WkbType = (typeof Types.wkb)[keyof typeof Types.wkb];
export type GeoJSONType = (typeof Types.geoJSON)[keyof typeof Types.geoJSON];
