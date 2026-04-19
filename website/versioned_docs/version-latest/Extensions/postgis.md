---
sidebar_position: 1
---

# PostGIS

[PostGIS](https://postgis.net/) adds support for geographic objects to PostgreSQL. Durcno provides type-safe column types for PostGIS geography types, with automatic serialization to/from GeoJSON coordinate arrays.

## Prerequisites

Enable the PostGIS extension in your database:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

## Import

All PostGIS column types are available through the `geography` namespace:

```typescript
import { geography } from "durcno";
```

## Geography Column Types

All geography columns accept these common options:

| Option    | Type     | Default | Description                                             |
| --------- | -------- | ------- | ------------------------------------------------------- |
| `srid`    | `number` | `4326`  | Spatial Reference System Identifier (WGS 84 by default) |
| `notNull` | symbol   | —       | Makes the column NOT NULL                               |
| `unique`  | symbol   | —       | Adds a UNIQUE constraint                                |

### `geography.point`

Represents a single geographic point (longitude, latitude).

- **SQL type**: `geography(POINT, <srid>)`
- **JS type**: `[number, number]` — `[longitude, latitude]`

```typescript
import { table, pk, varchar, notNull, geography } from "durcno";

export const Locations = table("public", "locations", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  coordinates: geography.point({ notNull }),
});

// Insert a point
await db.insert(Locations).values({
  name: "Eiffel Tower",
  coordinates: [2.2945, 48.8584], // [longitude, latitude]
});

// Select returns the same tuple format
const locations = await db.from(Locations).select();
// locations[0].coordinates → [2.2945, 48.8584]
```

### `geography.multipoint`

Represents a collection of points.

- **SQL type**: `geography(MULTIPOINT, <srid>)`
- **JS type**: `[number, number][]` — array of `[longitude, latitude]` pairs

```typescript
export const Routes = table("public", "routes", {
  id: pk(),
  waypoints: geography.multipoint({ notNull }),
});

await db.insert(Routes).values({
  waypoints: [
    [2.2945, 48.8584],
    [2.3522, 48.8566],
    [2.3376, 48.8606],
  ],
});
```

### `geography.linestring`

Represents a connected sequence of points forming a line.

- **SQL type**: `geography(LINESTRING, <srid>)`
- **JS type**: `[number, number][]` — array of `[longitude, latitude]` pairs

```typescript
export const Trails = table("public", "trails", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  path: geography.linestring({ notNull }),
});

await db.insert(Trails).values({
  name: "River Walk",
  path: [
    [-73.9857, 40.7484],
    [-73.9851, 40.748],
    [-73.9845, 40.7478],
  ],
});
```

### `geography.multilinestring`

Represents a collection of linestrings.

- **SQL type**: `geography(MULTILINESTRING, <srid>)`
- **JS type**: `[number, number][][]` — array of linestrings

```typescript
export const TransitRoutes = table("public", "transit_routes", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  lines: geography.multilinestring({ notNull }),
});

await db.insert(TransitRoutes).values({
  name: "Bus Route 42",
  lines: [
    // First line segment
    [
      [-73.9857, 40.7484],
      [-73.9851, 40.748],
    ],
    // Second line segment
    [
      [-73.984, 40.7475],
      [-73.9835, 40.747],
    ],
  ],
});
```

### `geography.polygon`

Represents a polygon with an exterior ring and optional interior rings (holes).

- **SQL type**: `geography(POLYGON, <srid>)`
- **JS type**: `[number, number][][]` — array of rings, where each ring is an array of `[longitude, latitude]` pairs. The first ring is the exterior boundary; subsequent rings are holes.

```typescript
export const Zones = table("public", "zones", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  boundary: geography.polygon({ notNull }),
});

await db.insert(Zones).values({
  name: "Central Park",
  boundary: [
    // Exterior ring (must be closed — first and last points match)
    [
      [-73.9819, 40.7681],
      [-73.958, 40.8006],
      [-73.9498, 40.7968],
      [-73.9737, 40.7644],
      [-73.9819, 40.7681],
    ],
  ],
});
```

### `geography.multipolygon`

Represents a collection of polygons.

- **SQL type**: `geography(MULTIPOLYGON, <srid>)`
- **JS type**: `[number, number][][][]` — array of polygons

```typescript
export const Districts = table("public", "districts", {
  id: pk(),
  name: varchar({ length: 255, notNull }),
  areas: geography.multipolygon({ notNull }),
});

await db.insert(Districts).values({
  name: "Borough Parks",
  areas: [
    // First polygon
    [
      [
        [-73.97, 40.77],
        [-73.96, 40.78],
        [-73.95, 40.77],
        [-73.97, 40.77],
      ],
    ],
    // Second polygon
    [
      [
        [-73.99, 40.75],
        [-73.98, 40.76],
        [-73.97, 40.75],
        [-73.99, 40.75],
      ],
    ],
  ],
});
```

## Custom SRID

By default all geography columns use SRID `4326` (WGS 84, the standard for GPS coordinates). You can specify a different SRID:

```typescript
export const LocalPoints = table("public", "local_points", {
  id: pk(),
  position: geography.point({ srid: 3857, notNull }), // Web Mercator
});
```

## Data Format

Durcno uses **GeoJSON coordinate ordering** (`[longitude, latitude]`) for all geography types. Data is automatically converted between:

- **TypeScript** ↔ GeoJSON coordinate arrays (what you read/write)
- **PostgreSQL** ↔ EWKT with SRID (the internal wire format)

This means you can work with familiar `[lng, lat]` tuples in your application code while Durcno handles the database serialization transparently.