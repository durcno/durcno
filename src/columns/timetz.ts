import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type TimetzValType = string;

type TimetzConfig = ColumnConfig & {
  /**
   * Fractional seconds precision (0-6).
   * When specified, uses `timetz(precision)` syntax.
   */
  precision?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

/** PostgreSQL `time with time zone` column. Maps to `string`. */
export class TimetzColumn<TConfig extends TimetzConfig> extends Column<
  TConfig,
  TimetzValType,
  "time"
> {
  static readonly id = "Column.Timetz";
  readonly #precision: number | undefined;

  constructor(config: TConfig) {
    super(config);
    this.#precision = config.precision;
  }

  get sqlTypeScalar() {
    const precision =
      this.#precision !== undefined ? `(${this.#precision})` : "";
    return `timetz${precision}`;
  }

  get sqlCastScalar() {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler() {
    return z
      .string()
      .regex(
        /^\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[-+]\d{2}(:?\d{2})?)?$/,
        "Invalid time with timezone",
      );
  }

  toDriverScalar(value: TimetzValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: string | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'${value.replace(/'/g, "''")}'`;
  }

  fromDriverScalar(value: string | null): TimetzValType | null {
    return value;
  }
}

/**
 * Creates a `timetz` (time with time zone) column. Time of day with timezone, maps to `string`.
 *
 * @example
 * ```ts
 * timetz({ precision: 3, notNull }) // timetz(3) NOT NULL
 * timetz({ notNull })               // timetz NOT NULL
 * ```
 *
 * @param config.precision - Fractional seconds precision (0–6)
 */
export function timetz<TConfig extends TimetzConfig>(
  config: TConfig,
): TimetzColumn<TConfig> {
  return new TimetzColumn(config);
}
