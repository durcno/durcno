import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type NumericValType = string;

const NUMERIC_LITERAL_REGEX = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Whether `value` is a valid PostgreSQL `numeric` literal.
 */
function isNumericLiteral(value: string): boolean {
  return NUMERIC_LITERAL_REGEX.test(value);
}

type NumericConfig = ColumnConfig & {
  /**
   * The total number of significant digits (1-1000).
   * If omitted, values of any precision can be stored.
   */
  precision?: number;
  /**
   * The number of digits after the decimal point.
   * If omitted, defaults to 0 when precision is specified.
   */
  scale?: number;
};

export class NumericColumn<TConfig extends NumericConfig> extends Column<
  TConfig,
  NumericValType,
  "numeric"
> {
  static readonly id = "Column.Numeric";
  readonly #precision?: number;
  readonly #scale?: number;

  constructor(config: TConfig) {
    super(config);
    this.#precision = config.precision;
    this.#scale = config.scale;
  }

  get sqlTypeScalar() {
    if (this.#precision !== undefined) {
      if (this.#scale !== undefined) {
        return `numeric(${this.#precision},${this.#scale})`;
      }
      return `numeric(${this.#precision})`;
    }
    return "numeric";
  }

  get sqlCastScalar() {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler() {
    return z.string().refine(isNumericLiteral, {
      message: "Invalid numeric value",
    });
  }

  toDriverScalar(value: NumericValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: NumericValType | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    if (!isNumericLiteral(value)) {
      throw new Error(`Invalid numeric value: ${value}`);
    }
    return value;
  }

  fromDriverScalar(value: string | null): NumericValType | null {
    if (value === null) return null;
    return typeof value === "string" ? value : String(value);
  }
}

/**
 * Creates a `numeric` column. Arbitrary-precision number, maps to `string` to avoid floating-point loss.
 *
 * @example
 * ```ts
 * numeric({ precision: 10, scale: 2, notNull }) // numeric(10,2) NOT NULL
 * ```
 *
 * @param config.precision - Total significant digits (1–1000). Omit for unlimited.
 * @param config.scale - Digits after the decimal point. Defaults to 0 when precision is set.
 */
export function numeric<TConfig extends NumericConfig>(
  config: TConfig,
): NumericColumn<TConfig> {
  return new NumericColumn(config);
}
