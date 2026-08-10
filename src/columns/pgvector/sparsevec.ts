import * as z from "zod";
import { Sql } from "../../sql";
import { Column, type ColumnConfig } from "../common";

export type SparsevecConfig = ColumnConfig & {
  dimensions?: number;
};

export class SparsevecColumn<TConfig extends SparsevecConfig> extends Column<
  TConfig,
  string,
  "string"
> {
  static readonly id = "Column.Sparsevec";
  readonly #dimensions: number | undefined;

  constructor(config: TConfig) {
    super(config);
    this.#dimensions = config.dimensions;
  }

  get sqlTypeScalar(): string {
    return this.#dimensions ? `sparsevec(${this.#dimensions})` : "sparsevec";
  }

  get sqlCastScalar(): string {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler() {
    return z.string();
  }

  toDriverScalar(value: string | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: string | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'${value.replace(/'/g, "''")}'`;
  }

  fromDriverScalar(value: string | null): string | null {
    return value;
  }
}

/**
 * Creates a `sparsevec` column. PostgreSQL pgvector sparse vector type, maps to `string`.
 *
 * @example
 * ```ts
 * sparsevec({ dimensions: 1000, notNull }) // sparsevec(1000) NOT NULL
 * ```
 *
 * @param config.dimensions - Fixed vector dimension length
 */
export function sparsevec<const TConfig extends SparsevecConfig>(
  config: TConfig = {} as TConfig,
) {
  return new SparsevecColumn(config);
}
