import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type TimeValType = string;

type TimeConfig = ColumnConfig & {
  /**
   * Fractional seconds precision (0-6).
   * When specified, uses `time(precision)` syntax.
   */
  precision?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * Include timezone information in the time value.
   * When true, uses `time with time zone`.
   * When false, uses `time`.
   * @default false
   */
  withTimezone?: boolean;
};

export class TimeColumn<TConfig extends TimeConfig> extends Column<
  TConfig,
  TimeValType
> {
  static readonly id = "Column.Time";
  readonly #withTimezone: boolean;
  readonly #precision: number | undefined;

  constructor(config: TConfig) {
    super(config);
    this.#withTimezone = config.withTimezone ?? false;
    this.#precision = config.precision;
  }

  get sqlTypeScalar() {
    const precision =
      this.#precision !== undefined ? `(${this.#precision})` : "";
    const tz = this.#withTimezone ? " with time zone" : "";
    return `time${precision}${tz}`;
  }

  get sqlCastScalar() {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler() {
    return z.iso.time({
      precision: this.#precision,
    });
  }

  toDriverScalar(value: TimeValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: string | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'${value.replace(/'/g, "''")}'`;
  }

  fromDriverScalar(value: string | null): TimeValType | null {
    return value;
  }
}

/**
 * Creates a `time` column. Time of day without date, maps to `string`.
 *
 * @example
 * ```ts
 * time({ precision: 3, withTimezone: true, notNull }) // time(3) with time zone NOT NULL
 * ```
 *
 * @param config.withTimezone - Include timezone info (default: `false`)
 * @param config.precision - Fractional seconds precision (0–6)
 */
export function time<TConfig extends TimeConfig>(
  config: TConfig,
): TimeColumn<TConfig> {
  return new TimeColumn(config);
}
