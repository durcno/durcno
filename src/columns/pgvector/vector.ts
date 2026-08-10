import * as z from "zod";
import { Sql } from "../../sql";
import { Column, type ColumnConfig } from "../common";

export type VectorConfig = ColumnConfig & {
  dimensions?: number;
};

export class VectorColumn<TConfig extends VectorConfig> extends Column<
  TConfig,
  number[],
  "numeric"
> {
  static readonly id = "Column.Vector";
  readonly #dimensions: TConfig["dimensions"];

  constructor(config: TConfig) {
    super(config);
    this.#dimensions = config.dimensions;
  }

  get sqlTypeScalar(): string {
    return this.#dimensions ? `vector(${this.#dimensions})` : "vector";
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
 * Creates a `vector` column. PostgreSQL pgvector dense vector type, maps to `number[]`.
 *
 * @example
 * ```ts
 * vector({ dimensions: 1536, notNull }) // vector(1536) NOT NULL
 * ```
 *
 * @param config.dimensions - Fixed vector dimension length
 */
export function vector<const TConfig extends VectorConfig>(
  config: TConfig = {} as TConfig,
) {
  return new VectorColumn(config);
}
