import * as z from "zod";
import type { Enum } from "../enumtype";
import { Sql } from "../sql";
import type { StdTable } from "../table";
import { Column, type ColumnConfig } from "./common";

export type EnumedConfig = ColumnConfig;

export class EnumedColumn<
  TValue extends string,
  TConfig extends EnumedConfig,
> extends Column<TConfig, TValue, "text"> {
  static readonly id = "Column.Enumed";
  readonly #enum: Enum<TValue>;

  constructor(enm: Enum<TValue>, config: TConfig) {
    super(config);
    this.#enum = enm;
  }

  get sqlTypeScalar() {
    return `"${this.#enum.schemaSql}"."${this.#enum.nameSql}"`;
  }

  get sqlCastScalar() {
    return this.sqlTypeScalar;
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

  /**
   * Overrides the base `clone()` because `EnumedColumn` requires both the
   * enum reference and the config to construct a valid instance.
   * @internal
   */
  clone(): EnumedColumn<TValue, TConfig> {
    const cloned = new EnumedColumn(this.#enum, this.config);
    if (this.name) cloned._.setName(this.name);
    if (this.table) cloned._.setTable(this.table as unknown as StdTable);
    return cloned;
  }

  /**
   * Overrides `cloneAsNullable()` because `EnumedColumn` requires both the
   * enum reference and the config to construct a valid instance.
   * @internal
   */
  cloneAsNullable(): EnumedColumn<
    TValue,
    Omit<TConfig, "notNull" | "primaryKey">
  > {
    const {
      notNull: _nn,
      primaryKey: _pk,
      ...rest
    } = this.config as Record<string, unknown>;
    const cloned = new EnumedColumn(
      this.#enum,
      rest as Omit<TConfig, "notNull" | "primaryKey">,
    );
    if (this.name) cloned._.setName(this.name);
    if (this.table) cloned._.setTable(this.table as unknown as StdTable);
    return cloned;
  }
}

/** Creates an `enum` column bound to a user-defined PostgreSQL enum type. Maps to a union of string literals. */
export function enumed<TValue extends string, TConfig extends EnumedConfig>(
  enm: Enum<TValue>,
  config: TConfig,
) {
  return new EnumedColumn(enm, config);
}
