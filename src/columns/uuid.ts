import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type UuidValType = string;

/** Supported UUID versions for validation. */
export type UuidVersion = "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | "v8";

type UuidConfig = ColumnConfig & {
  /** UUID version to validate against in the Zod schema (e.g. `"v4"`, `"v7"`). */
  version?: UuidVersion;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UuidColumn<TConfig extends UuidConfig> extends Column<
  TConfig,
  UuidValType
> {
  static readonly id = "Column.Uuid";

  get sqlTypeScalar() {
    return "uuid";
  }

  get zodTypeScaler() {
    const version = this.config.version ?? "v7";
    return z.uuid({ version });
  }

  toDriverScalar(value: UuidValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: UuidValType | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    if (!UUID_REGEX.test(value)) {
      throw new Error(`Invalid UUID value: ${value}`);
    }
    return `'${value}'`;
  }

  fromDriverScalar(value: string | null): UuidValType | null {
    return value;
  }
}

/**
 * Creates a `uuid` column. PostgreSQL universally unique identifier type, maps to `string`.
 *
 * @example
 * ```ts
 * uuid({ notNull })                // uuid NOT NULL, zod validates v7 (default)
 * uuid({ notNull, version: "v4" }) // uuid NOT NULL, zod validates v4
 * ```
 *
 * @param config.version - UUID version to validate in the Zod schema (default: `"v7"`)
 */
export function uuid<TConfig extends UuidConfig>(
  config: TConfig,
): UuidColumn<TConfig> {
  return new UuidColumn(config);
}
