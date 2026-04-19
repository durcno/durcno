import {
  bigint,
  bigserial,
  boolean,
  bytea,
  char,
  cidr,
  date,
  enumtype,
  geography,
  inet,
  integer,
  json,
  jsonb,
  macaddr,
  notNull,
  numeric,
  pk,
  serial,
  smallint,
  smallserial,
  table,
  text,
  time,
  timestamp,
  unique,
  uuid,
  varchar,
} from "durcno";

export { Migrations } from "durcno";

// ============================================================================
// Enum Types
// ============================================================================

export const StatusEnum = enumtype("public", "status", [
  "active",
  "inactive",
  "pending",
]);
export const PriorityEnum = enumtype("public", "priority", [
  "low",
  "medium",
  "high",
]);

// ============================================================================
// String Column Types
// ============================================================================

/**
 * Test table for varchar column type
 */
export const VarcharTests = table("public", "varchar_tests", {
  id: pk(),
  // Required varchar with length
  requiredName: varchar({ length: 100, notNull }),
  // Optional varchar
  optionalName: varchar({ length: 100 }),
  // Varchar with default
  withDefault: varchar({ length: 50, notNull }).default("default_value"),
  // Varchar with unique constraint
  uniqueCode: varchar({ length: 20, unique }),
});

/**
 * Test table for text column type
 */
export const TextTests = table("public", "text_tests", {
  id: pk(),
  // Required text
  requiredContent: text({ notNull }),
  // Optional text
  optionalContent: text({}),
  // Text with default
  withDefault: text({ notNull }).default("default text"),
});

/**
 * Test table for char column type
 */
export const CharTests = table("public", "char_tests", {
  id: pk(),
  // Required char with length
  requiredCode: char({ length: 5, notNull }),
  // Optional char
  optionalCode: char({ length: 3 }),
  // Char with default
  withDefault: char({ length: 2, notNull }).default("XX"),
});

// ============================================================================
// Numeric Column Types
// ============================================================================

/**
 * Test table for integer column type
 */
export const IntegerTests = table("public", "integer_tests", {
  id: pk(),
  // Required integer
  requiredCount: integer({ notNull }),
  // Optional integer
  optionalCount: integer({}),
  // Integer with default
  withDefault: integer({ notNull }).default(0),
});

/**
 * Test table for smallint column type
 */
export const SmallintTests = table("public", "smallint_tests", {
  id: pk(),
  // Required smallint
  requiredValue: smallint({ notNull }),
  // Optional smallint
  optionalValue: smallint({}),
  // Smallint with default
  withDefault: smallint({ notNull }).default(10),
});

/**
 * Test table for bigint column type
 */
export const BigintTests = table("public", "bigint_tests", {
  id: pk(),
  // Required bigint
  requiredAmount: bigint({ notNull }),
  // Optional bigint
  optionalAmount: bigint({}),
  // Bigint with default
  withDefault: bigint({ notNull }).default(1000),
});

/**
 * Test table for serial column type (auto-increment)
 */
export const SerialTests = table("public", "serial_tests", {
  id: serial({}),
  name: varchar({ length: 100, notNull }),
});

/**
 * Test table for smallserial column type (auto-increment)
 */
export const SmallserialTests = table("public", "smallserial_tests", {
  id: smallserial({}),
  name: varchar({ length: 100, notNull }),
});

/**
 * Test table for bigserial column type (auto-increment)
 */
export const BigserialTests = table("public", "bigserial_tests", {
  id: bigserial({}),
  name: varchar({ length: 100, notNull }),
});

/**
 * Test table for numeric column type (arbitrary precision)
 */
export const NumericTests = table("public", "numeric_tests", {
  id: pk(),
  // Required numeric without precision/scale
  requiredValue: numeric({ notNull }),
  // Optional numeric
  optionalValue: numeric({}),
  // Numeric with precision only
  withPrecision: numeric({ precision: 10, notNull }),
  // Numeric with precision and scale
  withScale: numeric({ precision: 10, scale: 2, notNull }),
  // Numeric with default
  withDefault: numeric({ notNull }).default("0"),
});

// ============================================================================
// Boolean Column Type
// ============================================================================

/**
 * Test table for boolean column type
 */
export const BooleanTests = table("public", "boolean_tests", {
  id: pk(),
  // Required boolean
  requiredFlag: boolean({ notNull }),
  // Optional boolean
  optionalFlag: boolean({}),
  // Boolean with default true
  defaultTrue: boolean({ notNull }).default(true),
  // Boolean with default false
  defaultFalse: boolean({ notNull }).default(false),
});

// ============================================================================
// Date/Time Column Types
// ============================================================================

/**
 * Test table for timestamp column type
 */
export const TimestampTests = table("public", "timestamp_tests", {
  id: pk(),
  // Required timestamp (with timezone by default)
  requiredAt: timestamp({ notNull }),
  // Optional timestamp
  optionalAt: timestamp({}),
  // Timestamp without timezone
  withoutTz: timestamp({ notNull, withTimezone: false }),
  // Timestamp with precision
  withPrecision: timestamp({ precision: 3 }),
});

/**
 * Test table for date column type
 */
export const DateTests = table("public", "date_tests", {
  id: pk(),
  // Required date
  requiredDate: date({ notNull }),
  // Optional date
  optionalDate: date({}),
});

/**
 * Test table for time column type
 */
export const TimeTests = table("public", "time_tests", {
  id: pk(),
  // Required time
  requiredTime: time({ notNull }),
  // Optional time
  optionalTime: time({}),
  // Time with precision
  withPrecision: time({ precision: 3 }),
  // Time with timezone
  withTimezone: time({ withTimezone: true }),
});

// ============================================================================
// UUID Column Type
// ============================================================================

/**
 * Test table for uuid column type
 */
export const UuidTests = table("public", "uuid_tests", {
  id: pk(),
  // Required uuid
  requiredUuid: uuid({ notNull }),
  // Optional uuid
  optionalUuid: uuid({}),
  // Unique uuid
  uniqueUuid: uuid({ unique }),
});

// ============================================================================
// Binary Column Type
// ============================================================================

/**
 * Test table for bytea column type
 */
export const ByteaTests = table("public", "bytea_tests", {
  id: pk(),
  // Required bytea
  requiredData: bytea({ notNull }),
  // Optional bytea
  optionalData: bytea({}),
  // Unique bytea
  uniqueHash: bytea({ unique }),
});

// ============================================================================
// Enum Column Type
// ============================================================================

/**
 * Test table for enum column type
 */
export const EnumTests = table("public", "enum_tests", {
  id: pk(),
  // Required enum
  requiredStatus: StatusEnum.enumed({ notNull }),
  // Optional enum
  optionalStatus: StatusEnum.enumed({}),
  // Enum with default
  withDefault: PriorityEnum.enumed({ notNull }).default("medium"),
});

// ============================================================================
// Geography Column Type (PostGIS)
// ============================================================================

/**
 * Test table for geography point column type
 */
export const GeographyPointTests = table("public", "geography_point_tests", {
  id: pk(),
  // Required point
  requiredPoint: geography.point({ notNull }),
  // Optional point
  optionalPoint: geography.point({}),
});

/**
 * Test table for geography multipoint column type
 */
export const GeographyMultiPointTests = table(
  "public",
  "geography_multipoint_tests",
  {
    id: pk(),
    // Required multipoint
    requiredMultiPoint: geography.multipoint({ notNull }),
    // Optional multipoint
    optionalMultiPoint: geography.multipoint({}),
  },
);

/**
 * Test table for geography linestring column type
 */
export const GeographyLineStringTests = table(
  "public",
  "geography_linestring_tests",
  {
    id: pk(),
    // Required linestring
    requiredLineString: geography.linestring({ notNull }),
    // Optional linestring
    optionalLineString: geography.linestring({}),
  },
);

/**
 * Test table for geography multilinestring column type
 */
export const GeographyMultiLineStringTests = table(
  "public",
  "geography_multilinestring_tests",
  {
    id: pk(),
    // Required multilinestring
    requiredMultiLineString: geography.multilinestring({ notNull }),
    // Optional multilinestring
    optionalMultiLineString: geography.multilinestring({}),
  },
);

/**
 * Test table for geography polygon column type
 */
export const GeographyPolygonTests = table(
  "public",
  "geography_polygon_tests",
  {
    id: pk(),
    // Required polygon
    requiredPolygon: geography.polygon({ notNull }),
    // Optional polygon
    optionalPolygon: geography.polygon({}),
  },
);

/**
 * Test table for geography multipolygon column type
 */
export const GeographyMultiPolygonTests = table(
  "public",
  "geography_multipolygon_tests",
  {
    id: pk(),
    // Required multipolygon
    requiredMultiPolygon: geography.multipolygon({ notNull }),
    // Optional multipolygon
    optionalMultiPolygon: geography.multipolygon({}),
  },
);

// ============================================================================
// Network Address Column Types (INET, CIDR, MACADDR)
// ============================================================================

/**
 * Test table for inet column type (IPv4/IPv6 host addresses)
 */
export const InetTests = table("public", "inet_tests", {
  id: pk(),
  // Required inet
  requiredIp: inet({ notNull }),
  // Optional inet
  optionalIp: inet({}),
  // Unique inet
  uniqueIp: inet({ unique }),
});

/**
 * Test table for cidr column type (IPv4/IPv6 network addresses)
 */
export const CidrTests = table("public", "cidr_tests", {
  id: pk(),
  // Required cidr
  requiredNetwork: cidr({ notNull }),
  // Optional cidr
  optionalNetwork: cidr({}),
  // Unique cidr
  uniqueNetwork: cidr({ unique }),
});

/**
 * Test table for macaddr column type (MAC addresses)
 */
export const MacaddrTests = table("public", "macaddr_tests", {
  id: pk(),
  // Required macaddr
  requiredMac: macaddr({ notNull }),
  // Optional macaddr
  optionalMac: macaddr({}),
  // Unique macaddr
  uniqueMac: macaddr({ unique }),
});

// ============================================================================
// Array Column Types
// ============================================================================

/**
 * Test table for simple array column types (1D variable-length)
 */
export const SimpleArrayTests = table("public", "simple_array_tests", {
  id: pk(),
  // Required string array
  requiredTags: varchar({ length: 100, notNull, dimension: [null] as const }),
  // Optional string array
  optionalTags: varchar({ length: 100, dimension: [null] as const }),
  // Required integer array
  requiredScores: integer({ notNull, dimension: [null] as const }),
  // Optional integer array
  optionalScores: integer({ dimension: [null] as const }),
});

/**
 * Test table for fixed-length array column types (1D fixed-length)
 */
export const FixedArrayTests = table("public", "fixed_array_tests", {
  id: pk(),
  // Required 3-element integer tuple (like coordinates)
  requiredCoords: integer({ notNull, dimension: [3] as const }),
  // Optional 3-element integer tuple
  optionalCoords: integer({ dimension: [3] as const }),
  // Required 2-element string tuple
  requiredPair: varchar({ length: 50, notNull, dimension: [2] as const }),
  // Optional 2-element string tuple
  optionalPair: varchar({ length: 50, dimension: [2] as const }),
});

/**
 * Test table for multidimensional array column types (2D arrays)
 */
export const MultidimensionalArrayTests = table(
  "public",
  "multidimensional_array_tests",
  {
    id: pk(),
    // 2D variable-length array: number[][] (matrix)
    requiredMatrix: integer({ notNull, dimension: [null, null] as const }),
    // Optional 2D variable-length array
    optionalMatrix: integer({ dimension: [null, null] as const }),
    // 2D with fixed inner array: [number, number][]
    requiredVectors: integer({ notNull, dimension: [2, null] as const }),
    // Optional 2D with fixed inner array
    optionalVectors: integer({ dimension: [2, null] as const }),
  },
);

/**
 * Test table for enum array column types
 */
export const EnumArrayTests = table("public", "enum_array_tests", {
  id: pk(),
  // Required enum array
  requiredStatuses: StatusEnum.enumed({ notNull, dimension: [null] as const }),
  // Optional enum array
  optionalStatuses: StatusEnum.enumed({ dimension: [null] as const }),
  // Required priority array
  requiredPriorities: PriorityEnum.enumed({
    notNull,
    dimension: [null] as const,
  }),
  // Optional priority array
  optionalPriorities: PriorityEnum.enumed({ dimension: [null] as const }),
});

// ============================================================================
// JSON/JSONB Column Types
// ============================================================================

/**
 * Test table for json column type (basic untyped JSON)
 */
export const JsonTests = table("public", "json_tests", {
  id: pk(),
  // Required json
  requiredData: json({ notNull }),
  // Optional json
  optionalData: json({}),
  // Json with default
  withDefault: json({ notNull }).default({ status: "default" }),
});

/**
 * Test table for jsonb column type (basic untyped JSONB)
 */
export const JsonbTests = table("public", "jsonb_tests", {
  id: pk(),
  // Required jsonb
  requiredData: jsonb({ notNull }),
  // Optional jsonb
  optionalData: jsonb({}),
  // Jsonb with default
  withDefault: jsonb({ notNull }).default({ status: "default" }),
});

/**
 * Custom type for typed JSON tests
 */
export interface UserSettings {
  theme: "light" | "dark";
  notifications: boolean;
  language: string;
}

/**
 * Test table for typed json columns
 */
export const TypedJsonTests = table("public", "typed_json_tests", {
  id: pk(),
  // Required typed json
  requiredSettings: json({ notNull }).$type<UserSettings>(),
  // Optional typed json
  optionalSettings: json({}).$type<UserSettings>(),
});

/**
 * Test table for typed jsonb columns
 */
export const TypedJsonbTests = table("public", "typed_jsonb_tests", {
  id: pk(),
  // Required typed jsonb
  requiredSettings: jsonb({ notNull }).$type<UserSettings>(),
  // Optional typed jsonb
  optionalSettings: jsonb({}).$type<UserSettings>(),
});
