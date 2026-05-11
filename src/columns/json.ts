import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

/**
 * The base value type for JSON columns.
 * JSON can store any valid JSON value: objects, arrays, strings, numbers, booleans, or null.
 */
type JsonValType = unknown;

type JsonConfig = ColumnConfig;

/**
 * PostgreSQL JSON column type.
 * Stores JSON data in text format, preserving exact input formatting.
 *
 * Key differences from JSONB:
 * - Preserves whitespace and key ordering
 * - No indexing support for JSON path queries
 * - Slightly faster to insert (no parsing overhead)
 * - Slower to query (must be reparsed on each access)
 *
 * Use $type<T>() to specify a TypeScript type for the column value.
 *
 * @example
 * ```ts
 * // Basic JSON column
 * const table = table('users', {
 *   metadata: json({}),
 * });
 *
 * // Typed JSON column
 * interface UserSettings {
 *   theme: 'light' | 'dark';
 *   notifications: boolean;
 * }
 * const table = table('users', {
 *   settings: json({}).$type<UserSettings>(),
 * });
 * ```
 */
export class JsonColumn<TConfig extends JsonConfig> extends Column<
  TConfig,
  JsonValType,
  "json"
> {
  static readonly id = "Column.Json";

  get sqlTypeScalar() {
    return "json";
  }

  get sqlCastScalar() {
    return "json";
  }

  get zodTypeScaler() {
    // JSON columns can contain any valid JSON value
    return z.unknown();
  }

  toDriverScalar(value: JsonValType | Sql | null): string | null {
    if (value === null) return null;
    if (value instanceof Sql) return value.string;
    return JSON.stringify(value);
  }

  toSQLScalar(value: JsonValType | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::json`;
  }

  fromDriverScalar(value: unknown): JsonValType | null {
    if (value === null) return null;
    // PostgreSQL drivers typically parse JSONB automatically
    // but some return it as a string
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        // If parsing fails, return as-is (shouldn't happen with valid JSONB)
        return value;
      }
    }
    return value;
  }
}

/** Creates a `json` column. Stores JSON as text, preserving formatting. Maps to `unknown` (use `$type<T>()` to narrow). */
export function json<TConfig extends JsonConfig>(
  config: TConfig,
): JsonColumn<TConfig> {
  return new JsonColumn(config);
}
