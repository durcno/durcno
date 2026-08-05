import {
  array,
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
  timestamptz,
  timetz,
  tuple,
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
export const VarcharTests = table("public", "varcharTests", {
  id: pk(),
  // Nullable varchar
  name: varchar({ length: 100 }),
  // Nullable varchar with default
  nameWithDefault: varchar({ length: 100 }).default("default_value"),
});

/**
 * Test table for text column type
 */
export const TextTests = table("public", "textTests", {
  id: pk(),
  // Nullable text
  content: text({}),
  // Nullable text with default
  contentWithDefault: text({}).default("default text"),
});

/**
 * Test table for char column type
 */
export const CharTests = table("public", "charTests", {
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
export const IntegerTests = table("public", "integerTests", {
  id: pk(),
  // Nullable integer
  count: integer({}),
  // Nullable integer with default
  countWithDefault: integer({}).default(0),
});

/**
 * Test table for smallint column type
 */
export const SmallintTests = table("public", "smallintTests", {
  id: pk(),
  // Nullable smallint
  value: smallint({}),
  // Nullable smallint with default
  valueWithDefault: smallint({}).default(10),
});

/**
 * Test table for bigint column type
 */
export const BigintTests = table("public", "bigintTests", {
  id: pk(),
  // Nullable bigint
  amount: bigint({}),
  // Nullable bigint with default
  amountWithDefault: bigint({}).default(1000n),
});

/**
 * Test table for serial column type (auto-increment)
 */
export const SerialTests = table("public", "serialTests", {
  id: serial({}),
  name: varchar({ length: 100 }),
});

/**
 * Test table for smallserial column type (auto-increment)
 */
export const SmallserialTests = table("public", "smallserialTests", {
  id: smallserial({}),
  name: varchar({ length: 100 }),
});

/**
 * Test table for bigserial column type (auto-increment)
 */
export const BigserialTests = table("public", "bigserialTests", {
  id: bigserial({}),
  name: varchar({ length: 100 }),
});

/**
 * Test table for numeric column type (arbitrary precision)
 */
export const NumericTests = table("public", "numericTests", {
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
export const BooleanTests = table("public", "booleanTests", {
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
 * Test table for timestamp column type (without timezone)
 */
export const TimestampTests = table("public", "timestampTests", {
  id: pk(),
  // Nullable timestamp
  at: timestamp({}),
  // Nullable timestamp with default (epoch)
  atWithDefault: timestamp({}).default(new Date(0)),
});

/**
 * Test table for timestamptz column type (with timezone)
 */
export const TimestamptzTests = table("public", "timestamptzTests", {
  id: pk(),
  // Nullable timestamptz
  at: timestamptz({}),
  // Nullable timestamptz with default (epoch)
  atWithDefault: timestamptz({}).default(new Date(0)),
});

/**
 * Test table for date column type
 */
export const DateTests = table("public", "dateTests", {
  id: pk(),
  // Nullable date
  date: date({}),
  // Nullable date with default
  dateWithDefault: date({}).default(new Date("2000-01-01T00:00:00.000Z")),
});

/**
 * Test table for time column type
 */
export const TimeTests = table("public", "timeTests", {
  id: pk(),
  // Nullable time
  time: time({}),
  // Nullable time with default
  timeWithDefault: time({}).default("00:00:00"),
});

/**
 * Test table for timetz column type
 */
export const TimetzTests = table("public", "timetzTests", {
  id: pk(),
  // Nullable timetz
  time: timetz({}),
  // Nullable timetz with default
  timeWithDefault: timetz({}).default("00:00:00+00"),
});

// ============================================================================
// UUID Column Type
// ============================================================================

/**
 * Test table for uuid column type
 */
export const UuidTests = table("public", "uuidTests", {
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
export const ByteaTests = table("public", "byteaTests", {
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
export const EnumTests = table("public", "enumTests", {
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
export const GeographyPointTests = table("public", "geographyPointTests", {
  id: pk(),
  // Nullable point
  point: geography.point({}),
});

/**
 * Test table for geography multipoint column type
 */
export const GeographyMultiPointTests = table(
  "public",
  "geographyMultipointTests",
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
  "geographyLinestringTests",
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
  "geographyMultilinestringTests",
  {
    id: pk(),
    // Nullable multilinestring
    multilinestring: geography.multilinestring({}),
  },
);

/**
 * Test table for geography polygon column type
 */
export const GeographyPolygonTests = table("public", "geographyPolygonTests", {
  id: pk(),
  // Nullable polygon
  polygon: geography.polygon({}),
});

/**
 * Test table for geography multipolygon column type
 */
export const GeographyMultiPolygonTests = table(
  "public",
  "geographyMultipolygonTests",
  {
    id: pk(),
    // Nullable multipolygon
    multipolygon: geography.multipolygon({}),
  },
);

/**
 * Test table for PostGIS spatial filter integration tests.
 */
export const GeographyFilterTests = table("public", "geographyFilterTests", {
  id: pk(),
  name: varchar({ length: 100, notNull }),
  location: geography.point({ notNull }),
});

// ============================================================================
// Network Address Column Types (INET, CIDR, MACADDR)
// ============================================================================

/**
 * Test table for inet column type (IPv4/IPv6 host addresses)
 */
export const InetTests = table("public", "inetTests", {
  id: pk(),
  // Nullable inet
  ip: inet({}),
  // Nullable inet with default
  ipWithDefault: inet({}).default("127.0.0.1"),
});

/**
 * Test table for cidr column type (IPv4/IPv6 network addresses)
 */
export const CidrTests = table("public", "cidrTests", {
  id: pk(),
  // Nullable cidr
  network: cidr({}),
  // Nullable cidr with default
  networkWithDefault: cidr({}).default("0.0.0.0/0"),
});

/**
 * Test table for macaddr column type (MAC addresses)
 */
export const MacaddrTests = table("public", "macaddrTests", {
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
export const SimpleArrayTests = table("public", "simpleArrayTests", {
  id: pk(),
  // Required string array
  requiredTags: varchar({ length: 100, notNull, dimension: array() }),
  // Optional string array
  optionalTags: varchar({ length: 100, dimension: array() }),
  // Required integer array
  requiredScores: integer({ notNull, dimension: array() }),
  // Optional integer array
  optionalScores: integer({ dimension: array() }),
});

/**
 * Test table for fixed-length array column types (1D fixed-length)
 */
export const FixedArrayTests = table("public", "fixedArrayTests", {
  id: pk(),
  // Required 3-element integer tuple (like coordinates)
  requiredCoords: integer({ notNull, dimension: tuple(3) }),
  // Optional 3-element integer tuple
  optionalCoords: integer({ dimension: tuple(3) }),
  // Required 2-element string tuple
  requiredPair: varchar({ length: 50, notNull, dimension: tuple(2) }),
  // Optional 2-element string tuple
  optionalPair: varchar({ length: 50, dimension: tuple(2) }),
});

/**
 * Test table for multidimensional array column types (2D arrays)
 */
export const MultidimensionalArrayTests = table(
  "public",
  "multidimensionalArrayTests",
  {
    id: pk(),
    // 2D variable-length array: number[][] (matrix)
    requiredMatrix: integer({ notNull, dimension: array().array() }),
    // Optional 2D variable-length array
    optionalMatrix: integer({ dimension: array().array() }),
    // 2D with fixed inner array: [number, number][]
    requiredVectors: integer({ notNull, dimension: tuple(2).array() }),
    // Optional 2D with fixed inner array
    optionalVectors: integer({ dimension: tuple(2).array() }),
  },
);

/**
 * Test table for enum array column types
 */
export const EnumArrayTests = table("public", "enumArrayTests", {
  id: pk(),
  // Required enum array
  requiredStatuses: StatusEnum.enumed({ notNull, dimension: array() }),
  // Optional enum array
  optionalStatuses: StatusEnum.enumed({ dimension: array() }),
  // Required priority array
  requiredPriorities: PriorityEnum.enumed({
    notNull,
    dimension: array(),
  }),
  // Optional priority array
  optionalPriorities: PriorityEnum.enumed({ dimension: array() }),
});

// ============================================================================
// JSON/JSONB Column Types
// ============================================================================

/**
 * Test table for json column type (basic untyped JSON)
 */
export const JsonTests = table("public", "jsonTests", {
  id: pk(),
  // Nullable json
  data: json({}),
  // Nullable json with default
  dataWithDefault: json({}).default({ status: "default" }),
});

/**
 * Test table for jsonb column type (basic untyped JSONB)
 */
export const JsonbTests = table("public", "jsonbTests", {
  id: pk(),
  // Nullable jsonb
  data: jsonb({}),
  // Nullable jsonb with default
  dataWithDefault: jsonb({}).default({ status: "default" }),
});
