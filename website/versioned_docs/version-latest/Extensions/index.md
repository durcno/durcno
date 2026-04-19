---
sidebar_position: 0
---

# Extensions

Durcno provides built-in support for popular PostgreSQL extensions through dedicated column types and utilities.

## Available Extensions

| Extension            | Description                 | Column Types                                                             |
| -------------------- | --------------------------- | ------------------------------------------------------------------------ |
| [PostGIS](./postgis) | Spatial and geographic data | `geography.point`, `geography.linestring`, `geography.polygon`, and more |

## Using Extensions

Extensions require the corresponding PostgreSQL extension to be installed in your database. You can enable them via a migration or directly in SQL:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

Once enabled, use the extension's column types in your schema just like any built-in column type. Durcno handles serialization, deserialization, and type inference automatically.