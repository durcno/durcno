import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type VarcharValType = string;

type VarcharConfig = ColumnConfig & {
  /** Maximum character length (default: 255) */
  length?: number;
};

export class VarcharColumn<TConfig extends VarcharConfig> extends Column<
  TConfig,
  VarcharValType,
  "text"
> {
  static readonly id = "Column.Varchar";
  readonly #length: number;

  constructor(config: TConfig) {
    super(config);
    this.#length = config.length ?? 255;
  }

  get sqlTypeScalar() {
    return `varchar(${this.#length})`;
  }

  get sqlCastScalar() {
    return null;
  }

  get zodTypeScaler() {
    return z.string().max(this.#length);
  }

  toDriverScalar(value: VarcharValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: string | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'${value.replace(/'/g, "''")}'`;
  }

  fromDriverScalar(value: string | null): VarcharValType | null {
    return value;
  }
}

/**
 * Creates a `varchar` column. Variable-length string with a maximum length, maps to `string`.
 *
 * @example
 * ```ts
 * varchar({ length: 255, notNull }) // varchar(255) NOT NULL
 * ```
 *
 * @param config.length - Maximum character length (default: 255)
 */
export function varchar<TConfig extends VarcharConfig>(
  config: TConfig,
): VarcharColumn<TConfig> {
  return new VarcharColumn(config);
}
