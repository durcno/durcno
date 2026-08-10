import * as z from "zod";
import { Sql } from "../../sql";
import { Column, type ColumnConfig } from "../common";

export type HalfvecConfig = ColumnConfig & {
  dimensions?: number;
};

export class HalfvecColumn<TConfig extends HalfvecConfig> extends Column<
  TConfig,
  number[],
  "numeric"
> {
  static readonly id = "Column.Halfvec";
  readonly #dimensions: number | undefined;

  constructor(config: TConfig) {
    super(config);
    this.#dimensions = config.dimensions;
  }

  get sqlTypeScalar(): string {
    return this.#dimensions ? `halfvec(${this.#dimensions})` : "halfvec";
  }

  get sqlCastScalar(): string {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler() {
    if (this.#dimensions === undefined) return z.array(z.number());
    return z.array(z.number()).length(this.#dimensions);
  }

  toDriverScalar(value: number[] | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql
      ? value.string
      : `[${(value as number[]).join(",")}]`;
  }

  toSQLScalar(value: number[] | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'[${(value as number[]).join(",")}]'`;
  }

  fromDriverScalar(value: unknown): number[] | null {
    if (value === null) return null;
    if (Array.isArray(value)) return value as number[];
    if (typeof value === "string") {
      try {
        return JSON.parse(value) as number[];
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Creates a `halfvec` column. PostgreSQL pgvector half precision vector type, maps to `number[]`.
 *
 * @example
 * ```ts
 * halfvec({ dimensions: 1536, notNull }) // halfvec(1536) NOT NULL
 * ```
 *
 * @param config.dimensions - Fixed vector dimension length
 */
export function halfvec<const TConfig extends HalfvecConfig>(
  config: TConfig = {} as TConfig,
) {
  return new HalfvecColumn(config);
}
