import * as z from "zod";
import type { Enum } from "../enumtype";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

export type EnumedConfig = ColumnConfig;

export class EnumedColumn<
  TValue extends string,
  TConfig extends EnumedConfig,
> extends Column<TConfig, TValue> {
  static readonly id = "Column.Enumed";
  readonly #enum: Enum<TValue>;

  constructor(enm: Enum<TValue>, config: TConfig) {
    super(config);
    this.#enum = enm;
  }

  get sqlTypeScalar() {
    return `"${this.#enum.schema}"."${this.#enum.name}"`;
  }

  get zodTypeScaler() {
    return z.enum(this.#enum.values);
  }

  toDriverScalar(value: TValue | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: TValue | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'${value.replace(/'/g, "''")}'`;
  }

  fromDriverScalar(value: TValue | null): TValue | null {
    return value;
  }
}

/** Creates an `enum` column bound to a user-defined PostgreSQL enum type. Maps to a union of string literals. */
export function enumed<TValue extends string, TConfig extends EnumedConfig>(
  enm: Enum<TValue>,
  config: TConfig,
) {
  return new EnumedColumn(enm, config);
}
