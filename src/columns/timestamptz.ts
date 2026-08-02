import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type TimestamptzValType = Date;

type TimestamptzConfig = ColumnConfig & {
  /**
   * Fractional seconds precision (0-6).
   * When specified, uses `timestamptz(precision)` syntax.
   */
  precision?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
};

/** PostgreSQL `timestamp with time zone` column. Maps to `Date`. */
export class TimestamptzColumn<
  TConfig extends TimestamptzConfig,
> extends Column<TConfig, TimestamptzValType, "datetime"> {
  static readonly id = "Column.Timestamptz";
  readonly #precision: number | undefined;

  constructor(config: TConfig) {
    super(config);
    this.#precision = config.precision;
  }

  get sqlTypeScalar() {
    const precision =
      this.#precision !== undefined ? `(${this.#precision})` : "";
    return `timestamptz${precision}`;
  }

  get sqlCastScalar() {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler() {
    return z.date();
  }

  toDriverScalar(value: TimestamptzValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value.toISOString();
  }

  toSQLScalar(value: TimestamptzValType | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql ? value.string : `'${value.toISOString()}'`;
  }

  fromDriverScalar(value: Date | null): TimestamptzValType | null {
    return value;
  }
}

/**
 * Creates a `timestamptz` (timestamp with time zone) column. Date and time with timezone, maps to `Date`.
 *
 * @example
 * ```ts
 * timestamptz({ precision: 3, notNull }) // timestamptz(3) NOT NULL
 * timestamptz({ notNull })               // timestamptz NOT NULL
 * ```
 *
 * @param config.precision - Fractional seconds precision (0–6)
 */
export function timestamptz<TConfig extends TimestamptzConfig>(
  config: TConfig,
): TimestamptzColumn<TConfig> {
  return new TimestamptzColumn(config);
}
