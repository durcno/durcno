import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

/**
 * The base value type for JSONB columns.
 * JSONB can store any valid JSON value: objects, arrays, strings, numbers, booleans, or null.
 */
type JsonbValType = unknown;

type JsonbConfig = ColumnConfig;

/**
 * PostgreSQL JSONB column type.
 * Stores JSON data in a decomposed binary format for efficient processing.
 *
 * Key differences from JSON:
 * - Does not preserve whitespace or key ordering
 * - Supports GIN indexing for fast path queries
 * - Slightly slower to insert (parsing overhead)
 * - Faster to query (no reparsing needed)
 * - Supports containment and existence operators (@>, ?, ?|, ?&)
 *
 * Use $type<T>() to specify a TypeScript type for the column value.
 *
 * @example
 * ```ts
 * // Basic JSONB column
 * const table = table('users', {
 *   metadata: jsonb({}),
 * });
 *
 * // Typed JSONB column
 * interface UserSettings {
 *   theme: 'light' | 'dark';
 *   notifications: boolean;
 * }
 * const table = table('users', {
 *   settings: jsonb({}).$type<UserSettings>(),
 * });
 * ```
 */
export class JsonbColumn<TConfig extends JsonbConfig> extends Column<
  TConfig,
  JsonbValType
> {
  static readonly id = "Column.Jsonb";

  get sqlTypeScalar() {
    return "jsonb";
  }

  get sqlCastScalar() {
    return "jsonb";
  }

  get zodTypeScaler() {
    // JSONB columns can contain any valid JSON value
    return z.unknown();
  }

  toDriverScalar(value: JsonbValType | Sql | null): string | null {
    if (value === null) return null;
    if (value instanceof Sql) return value.string;
    return JSON.stringify(value);
  }

  toSQLScalar(value: JsonbValType | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }

  fromDriverScalar(value: unknown): JsonbValType | null {
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

/** Creates a `jsonb` column. Stores JSON in decomposed binary format for efficient querying. Maps to `unknown` (use `$type<T>()` to narrow). */
export function jsonb<TConfig extends JsonbConfig>(
  config: TConfig,
): JsonbColumn<TConfig> {
  return new JsonbColumn(config);
}
