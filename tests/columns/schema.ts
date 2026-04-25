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
  // Nullable varchar
  name: varchar({ length: 100 }),
  // Nullable varchar with default
  nameWithDefault: varchar({ length: 100 }).default("default_value"),
});

/**
 * Test table for text column type
 */
export const TextTests = table("public", "text_tests", {
  id: pk(),
  // Nullable text
  content: text({}),
  // Nullable text with default
  contentWithDefault: text({}).default("default text"),
});

/**
 * Test table for char column type
 */
export const CharTests = table("public", "char_tests", {
  id: pk(),
  // Nullable char
  code: char({ length: 5 }),
  // Nullable char with default
  codeWithDefault: char({ length: 2 }).default("XX"),
});

// ============================================================================
// Numeric Column Types
// ============================================================================

/**
 * Test table for integer column type
 */
export const IntegerTests = table("public", "integer_tests", {
  id: pk(),
  // Nullable integer
  count: integer({}),
  // Nullable integer with default
  countWithDefault: integer({}).default(0),
});

/**
 * Test table for smallint column type
 */
export const SmallintTests = table("public", "smallint_tests", {
  id: pk(),
  // Nullable smallint
  value: smallint({}),
  // Nullable smallint with default
  valueWithDefault: smallint({}).default(10),
});

/**
 * Test table for bigint column type
 */
export const BigintTests = table("public", "bigint_tests", {
  id: pk(),
  // Nullable bigint
  amount: bigint({}),
  // Nullable bigint with default
  amountWithDefault: bigint({}).default(1000),
});

/**
 * Test table for serial column type (auto-increment)
 */
export const SerialTests = table("public", "serial_tests", {
  id: serial({}),
  name: varchar({ length: 100 }),
});

/**
 * Test table for smallserial column type (auto-increment)
 */
export const SmallserialTests = table("public", "smallserial_tests", {
  id: smallserial({}),
  name: varchar({ length: 100 }),
});

/**
 * Test table for bigserial column type (auto-increment)
 */
export const BigserialTests = table("public", "bigserial_tests", {
  id: bigserial({}),
  name: varchar({ length: 100 }),
});

/**
 * Test table for numeric column type (arbitrary precision)
 */
export const NumericTests = table("public", "numeric_tests", {
  id: pk(),
  // Nullable numeric
  value: numeric({}),
  // Nullable numeric with default
  valueWithDefault: numeric({}).default("0"),
});

// ============================================================================
// Boolean Column Type
// ============================================================================

/**
 * Test table for boolean column type
 */
export const BooleanTests = table("public", "boolean_tests", {
  id: pk(),
  // Nullable boolean
  flag: boolean({}),
  // Nullable boolean with default
  flagWithDefault: boolean({}).default(false),
});

// ============================================================================
// Date/Time Column Types
// ============================================================================

/**
 * Test table for timestamp column type
 */
export const TimestampTests = table("public", "timestamp_tests", {
  id: pk(),
  // Nullable timestamp
  at: timestamp({}),
  // Nullable timestamp with default (epoch)
  atWithDefault: timestamp({}).default(new Date(0)),
});

/**
 * Test table for date column type
 */
export const DateTests = table("public", "date_tests", {
  id: pk(),
  // Nullable date
  date: date({}),
  // Nullable date with default
  dateWithDefault: date({}).default(new Date("2000-01-01T00:00:00.000Z")),
});

/**
 * Test table for time column type
 */
export const TimeTests = table("public", "time_tests", {
  id: pk(),
  // Nullable time
  time: time({}),
  // Nullable time with default
  timeWithDefault: time({}).default("00:00:00"),
});

// ============================================================================
// UUID Column Type
// ============================================================================

/**
 * Test table for uuid column type
 */
export const UuidTests = table("public", "uuid_tests", {
  id: pk(),
  // Nullable uuid
  uuid: uuid({}),
  // Nullable uuid with default
  uuidWithDefault: uuid({}).default("00000000-0000-0000-8000-000000000000"),
});

// ============================================================================
// Binary Column Type
// ============================================================================

/**
 * Test table for bytea column type
 */
export const ByteaTests = table("public", "bytea_tests", {
  id: pk(),
  // Nullable bytea
  data: bytea({}),
});

// ============================================================================
// Enum Column Type
// ============================================================================

/**
 * Test table for enum column type
 */
export const EnumTests = table("public", "enum_tests", {
  id: pk(),
  // Nullable enum
  status: StatusEnum.enumed({}),
  // Nullable enum with default
  statusWithDefault: PriorityEnum.enumed({}).default("medium"),
});

// ============================================================================
// Geography Column Type (PostGIS)
// ============================================================================

/**
 * Test table for geography point column type
 */
export const GeographyPointTests = table("public", "geography_point_tests", {
  id: pk(),
  // Nullable point
  point: geography.point({}),
});

/**
 * Test table for geography multipoint column type
 */
export const GeographyMultiPointTests = table(
  "public",
  "geography_multipoint_tests",
  {
    id: pk(),
    // Nullable multipoint
    multipoint: geography.multipoint({}),
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
    // Nullable linestring
    linestring: geography.linestring({}),
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
    // Nullable multilinestring
    multilinestring: geography.multilinestring({}),
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
    // Nullable polygon
    polygon: geography.polygon({}),
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
    // Nullable multipolygon
    multipolygon: geography.multipolygon({}),
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
  // Nullable inet
  ip: inet({}),
  // Nullable inet with default
  ipWithDefault: inet({}).default("127.0.0.1"),
});

/**
 * Test table for cidr column type (IPv4/IPv6 network addresses)
 */
export const CidrTests = table("public", "cidr_tests", {
  id: pk(),
  // Nullable cidr
  network: cidr({}),
  // Nullable cidr with default
  networkWithDefault: cidr({}).default("0.0.0.0/0"),
});

/**
 * Test table for macaddr column type (MAC addresses)
 */
export const MacaddrTests = table("public", "macaddr_tests", {
  id: pk(),
  // Nullable macaddr
  mac: macaddr({}),
  // Nullable macaddr with default
  macWithDefault: macaddr({}).default("00:00:00:00:00:00"),
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
  // Nullable json
  data: json({}),
  // Nullable json with default
  dataWithDefault: json({}).default({ status: "default" }),
});

/**
 * Test table for jsonb column type (basic untyped JSONB)
 */
export const JsonbTests = table("public", "jsonb_tests", {
  id: pk(),
  // Nullable jsonb
  data: jsonb({}),
  // Nullable jsonb with default
  dataWithDefault: jsonb({}).default({ status: "default" }),
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
  // Nullable typed json
  settings: json({}).$type<UserSettings>(),
  // Nullable typed json with default
  settingsWithDefault: json({})
    .$type<UserSettings>()
    .default({ theme: "light", notifications: false, language: "en" }),
});

/**
 * Test table for typed jsonb columns
 */
export const TypedJsonbTests = table("public", "typed_jsonb_tests", {
  id: pk(),
  // Nullable typed jsonb
  settings: jsonb({}).$type<UserSettings>(),
  // Nullable typed jsonb with default
  settingsWithDefault: jsonb({})
    .$type<UserSettings>()
    .default({ theme: "light", notifications: false, language: "en" }),
});
