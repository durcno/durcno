---
sidebar_position: 5
---

# Custom Columns

Durcno allows you to create custom column types by extending the base `Column` class. This is useful when you need to support specialized PostgreSQL types or add custom serialization logic for your application.

## Understanding the Column Class

The `Column` class is the abstract base for all column types. It handles common functionality like constraints (`notNull`, `unique`, `primaryKey`), default values, and references.

To create a custom column, you need to:

1. Define your value type
2. Create a configuration type extending `ColumnConfig`
3. Extend the `Column` class and implement the abstract methods
4. Create a factory function for ergonomic usage

## Basic Structure

Here's the minimum structure for a custom column using the current `Column` API (scalar helpers + automatic array/dimension handling):

```typescript
import * as z from "zod";
import { Sql } from "durcno/sql";
import { Column, ColumnConfig } from "durcno";

// 1. Define the TypeScript type for your column values
type MyValueType = string;

// 2. Create a config type extending ColumnConfig
export type MyColumnConfig = ColumnConfig & {
  // Add any custom options here
  myOption?: string;
};

// 3. Extend the Column class
// Note: generic order is <TConfig, TColVal>
export class MyColumn<TConfig extends MyColumnConfig> extends Column<
  TConfig,
  MyValueType
> {
  constructor(config: TConfig) {
    super(config);
  }

  // PostgreSQL base type for a scalar value. Column.sqlType will append
  // array suffixes automatically when `config.dimension` is present.
  get sqlTypeScalar(): string {
    return "text";
  }

  // Zod schema for a single scalar value. Column.zodType composes arrays
  // automatically when `config.dimension` is set.
  get zodTypeScaler() {
    return z.string();
  }

  // Convert a single scalar value for the database driver
  toDriverScalar(value: MyValueType | Sql | null): string | number | null {
    if (value === null) return null;
    if (value instanceof Sql) return value.string;
    return value;
  }

  // Convert a single scalar value to a SQL literal (used in migrations/raw SQL)
  toSQLScalar(value: MyValueType | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    // escape single quotes by doubling them
    return `'${value.replace(/'/g, "''")}'`;
  }

  // Parse a scalar value returned by the driver
  fromDriverScalar(value: unknown): MyValueType | null {
    if (value === null) return null;
    return String(value);
  }
}

// 4. Create a factory function
export function myColumn<TConfig extends MyColumnConfig>(
  config: TConfig,
): MyColumn<TConfig> {
  return new MyColumn(config);
}
```

## Abstract Methods

Durcno's `Column` now exposes _scalar_ abstract methods and helpers. The `Column` base implements dimension-aware array handling, so you only need to implement conversions for a single scalar value.

- `get sqlTypeScalar(): string`
  - Return the PostgreSQL type name for a single scalar value (e.g. `varchar(255)`, `jsonb`, `uuid`). The `Column` class will append array suffixes (like `[]` or `[N]`) automatically when `config.dimension` is present.

- `get zodTypeScaler(): z.ZodType`
  - Return a Zod schema for a single scalar value. `Column.zodType` will wrap this in tuples/arrays according to `config.dimension`.

- `toDriverScalar(value: TColVal | Sql | null): string | number | null`
  - Convert a single scalar value to the format the database driver expects. `Column.toDriver()` will call this for each element and handle arrays and `Sql` objects.

- `toSQLScalar(value: TColVal | Sql | null): string`
  - Convert a single scalar value to a SQL literal (used for migrations / raw SQL). `Column.toSQL()` will assemble `ARRAY[...]` for array columns.

- `fromDriverScalar(value: unknown): TColVal | null`
  - Parse a single scalar value from the driver result. `Column.fromDriver()` will call this for each element and return nested arrays when appropriate.

Additional helpers available on every `Column` instance:

- `default(value)` and `hasDefault` — set and inspect column defaults. Use `defaultToSQL()` to get a SQL literal for the default.
- `$insertFn(fn)` / `$updateFn(fn)` and the corresponding `hasInsertFn` / `hasUpdateFn` / `insertFnVal()` / `updateFnVal()` helpers.
- `$type<T>()` — a compile-time only helper to override the TypeScript value type for the column.
- `arg()` — returns an `Arg` helper that binds the column's driver conversion (useful for prepared statements).
- `fullName` — returns the quoted `"schema"."column"` style name when the column is attached to a table.

Note: the `Column` generic order is `Column<TConfig extends ColumnConfig, TColVal>` (first is config type, second is the value type). For examples see the built-in `varchar` and `json` column implementations.

## Example: Case-Insensitive Text (citext) Column

PostgreSQL provides the `citext` extension for case-insensitive text comparisons. This example shows a small custom column that maps to `citext` and ensures values round-trip as strings while integrating with Zod validation.

```typescript
import * as z from "zod";
import { Sql } from "durcno/sql";
import { Column, ColumnConfig } from "durcno";

type CitextVal = string;

export type CitextConfig = ColumnConfig & {};

export class CitextColumn<TConfig extends CitextConfig> extends Column<
  TConfig,
  CitextVal
> {
  get sqlTypeScalar(): string {
    return "citext"; // requires the citext extension in the DB
  }

  get zodTypeScaler(): z.ZodType {
    return z.string();
  }

  toDriverScalar(value: CitextVal | Sql | null): string | null {
    if (value === null) return null;
    if (value instanceof Sql) return value.string;
    return value;
  }

  toSQLScalar(value: CitextVal | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return `'${value.replace(/'/g, "''")}::citext`;
  }

  fromDriverScalar(value: unknown): CitextVal | null {
    if (value === null) return null;
    return String(value);
  }
}

export function citext<TConfig extends CitextConfig>(
  config: TConfig,
): CitextColumn<TConfig> {
  return new CitextColumn(config);
}
```

**Usage:**

```typescript
// Ensure the citext extension exists in your migration or database:
// CREATE EXTENSION IF NOT EXISTS citext;

import { table, pk, varchar, notNull } from "durcno";
import { citext } from "./citext-column";

export const People = table("public", "people", {
  id: pk(),
  email: citext({ notNull }),
  name: varchar({ length: 255 }),
});
```

## Example: Comma-Separated Tags Column

Sometimes you want to store a small list of tags in a single text field and work with it as a string[] in TypeScript. This `CsvTextColumn` stores tags as an escaped, comma-separated string while presenting a `string[]` at the type level.

```typescript
import * as z from "zod";
import { Sql } from "durcno/sql";
import { Column, ColumnConfig } from "durcno";

type Tags = string[];

export type CsvTextConfig = ColumnConfig & {};

export class CsvTextColumn<TConfig extends CsvTextConfig> extends Column<
  TConfig,
  Tags
> {
  get sqlTypeScalar(): string {
    return "text";
  }

  get zodTypeScaler(): z.ZodType {
    return z.array(z.string());
  }

  toDriverScalar(value: Tags | Sql | null): string | null {
    if (value === null) return null;
    if (value instanceof Sql) return value.string;
    // escape any commas inside tags with a backslash
    return value.map((v) => v.replace(/,/g, "\\,")).join(",");
  }

  toSQLScalar(value: Tags | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    const escaped = value
      .map((v) => v.replace(/,/g, "\\,").replace(/'/g, "''"))
      .join(",");
    return `'${escaped}'`;
  }

  fromDriverScalar(value: unknown): Tags | null {
    if (value === null) return null;
    const s = String(value);
    // Split on commas that are not escaped and unescape any escaped commas
    return s
      .split(/(?<!\\),/)
      .map((v) => v.replace(/\\,/g, ",").trim())
      .filter((v) => v.length > 0);
  }
}

export function csvText<TConfig extends CsvTextConfig>(
  config: TConfig,
): CsvTextColumn<TConfig> {
  return new CsvTextColumn(config);
}
```

**Usage:**

```typescript
import { table, pk, varchar } from "durcno";
import { csvText } from "./csv-text-column";

export const Articles = table("public", "articles", {
  id: pk(),
  title: varchar({ length: 255 }),
  tags: csvText({}).default([]),
});
```

> **Note:** Storing lists in a CSV text column is useful for small, infrequently queried tag lists. For more advanced querying and indexing use a proper array column (`text[]`) or a separate tags table.

## Best Practices

### Handle Sql Objects

Always check for `Sql` objects in `toDriver` and `toSQL` methods. This allows users to pass raw SQL:

```typescript
toDriver(value: MyValueType | Sql | null) {
  if (value === null) return null;
  if (value instanceof Sql) return value.string;
  // ... handle normal values
}
```

### Validate Input

Validate values in `toDriver` to catch errors early:

```typescript
toDriver(value: MyValueType | Sql | null) {
  if (value === null) return null;
  if (value instanceof Sql) return value.string;

  if (!isValidMyValue(value)) {
    throw new Error(`Invalid value for MyColumn: ${value}`);
  }

  return value;
}
```

### Keep Types Accurate

Ensure your TypeScript types match what the database returns. Use proper nullable types:

```typescript
fromDriver(value: unknown): MyValueType | null {
  if (value === null) return null;
  // Parse and return the correct type
  return parsedValue;
}
```