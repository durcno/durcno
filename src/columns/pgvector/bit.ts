import * as z from "zod";
import { Sql } from "../../sql";
import { Column, type ColumnConfig } from "../common";

export type BitConfig = ColumnConfig & {
  length?: number;
};

export class BitColumn<TConfig extends BitConfig> extends Column<
  TConfig,
  string,
  "string"
> {
  static readonly id = "Column.Bit";
  readonly #length: number | undefined;

  constructor(config: TConfig) {
    super(config);
    this.#length = config.length;
  }

  get sqlTypeScalar(): string {
    return this.#length ? `bit(${this.#length})` : "bit";
  }

  get sqlCastScalar(): string {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler() {
    let base = z.string().regex(/^[01]+$/);
    if (this.#length !== undefined) {
      base = base.length(this.#length);
    }
    return base;
  }

  toDriverScalar(value: string | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: string | Sql | null): string {
    if (value === null) return "NULL";
    // standard bit literal syntax: B'101010'
    return value instanceof Sql ? value.string : `B'${value}'`;
  }

  fromDriverScalar(value: string | null): string | null {
    return value;
  }
}

/**
 * Creates a `bit` column. PostgreSQL bit string type, maps to `string`.
 *
 * @example
 * ```ts
 * bit({ length: 16, notNull }) // bit(16) NOT NULL
 * ```
 *
 * @param config.length - Fixed bit string length
 */
export function bit<const TConfig extends BitConfig>(
  config: TConfig = {} as TConfig,
) {
  return new BitColumn(config);
}
