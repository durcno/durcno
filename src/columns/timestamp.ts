import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type TimestampValType = Date;

type TimestampConfig = ColumnConfig & {
  /**
   * Fractional seconds precision (0-6).
   * When specified, uses `timestamp(precision)` syntax.
   */
  precision?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * Include timezone information in the timestamp.
   * When true, uses `timestamp with time zone` (recommended for UTC round-trips).
   * When false, uses `timestamp` (recommended for local round-trips).
   * @default true
   */
  withTimezone?: boolean;
};

export class TimestampColumn<TConfig extends TimestampConfig> extends Column<
  TConfig,
  TimestampValType,
  "datetime"
> {
  static readonly id = "Column.Timestamp";
  readonly #withTimezone: boolean;
  readonly #precision: number | undefined;

  constructor(config: TConfig) {
    super(config);
    this.#withTimezone = config.withTimezone ?? true;
    this.#precision = config.precision;
  }

  get sqlTypeScalar() {
    const precision =
      this.#precision !== undefined ? `(${this.#precision})` : "";
    const tz = this.#withTimezone ? " with time zone" : "";
    return `timestamp${precision}${tz}`;
  }

  get sqlCastScalar() {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler() {
    return z.iso.datetime({
      precision: this.#precision,
    });
  }

  toDriverScalar(value: TimestampValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value.toISOString();
  }

  toSQLScalar(value: TimestampValType | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql ? value.string : `'${value.toISOString()}'`;
  }

  fromDriverScalar(value: Date | null): TimestampValType | null {
    return value;
  }
}

/**
 * Creates a `timestamp` column. Date and time, maps to `Date`.
 *
 * @example
 * ```ts
 * timestamp({ withTimezone: true, precision: 3, notNull }) // timestamp(3) with time zone NOT NULL
 * ```
 *
 * @param config.withTimezone - Include timezone info (default: `true`)
 * @param config.precision - Fractional seconds precision (0–6)
 */
export function timestamp<TConfig extends TimestampConfig>(
  config: TConfig,
): TimestampColumn<TConfig> {
  return new TimestampColumn(config);
}
