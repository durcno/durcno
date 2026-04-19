import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type CharValType = string;

type CharConfig = ColumnConfig & {
  /** Fixed character length (default: 1) */
  length?: number;
};

export class CharColumn<TConfig extends CharConfig> extends Column<
  TConfig,
  CharValType
> {
  static readonly id = "Column.Char";
  readonly #length: number;

  constructor(config: TConfig) {
    super(config);
    this.#length = config.length ?? 1;
  }

  get sqlTypeScalar() {
    return `char(${this.#length})`;
  }

  get zodTypeScaler() {
    return z.string().length(this.#length);
  }

  toDriverScalar(value: CharValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: string | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'${value.replace(/'/g, "''")}'`;
  }

  fromDriverScalar(value: string | null): CharValType | null {
    // PostgreSQL pads char values with spaces, trim them
    return value === null ? null : value.trimEnd();
  }
}

/**
 * Creates a `char` column. Fixed-length, blank-padded string. Maps to `string`.
 *
 * @example
 * ```ts
 * char({ length: 2, notNull }) // char(2) NOT NULL
 * ```
 *
 * @param config.length - Fixed character length (default: 1)
 */
export function char<TConfig extends CharConfig>(
  config: TConfig,
): CharColumn<TConfig> {
  return new CharColumn(config);
}
