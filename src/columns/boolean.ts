import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type BooleanValType = boolean;

type BooleanConfig = ColumnConfig;

export class BooleanColumn<TConfig extends BooleanConfig> extends Column<
  TConfig,
  BooleanValType
> {
  static readonly id = "Column.Boolean";

  get sqlTypeScalar() {
    return "boolean";
  }

  get sqlCastScalar() {
    return "boolean";
  }
  get zodTypeScaler() {
    return z.boolean();
  }

  toDriverScalar(value: BooleanValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : `${value ? "1" : "0"}`;
  }

  toSQLScalar(value: boolean | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql ? value.string : `${value ? "'1'" : "'0'"}`;
  }

  fromDriverScalar(value: boolean): BooleanValType | null {
    if (value === null) return null;
    return value;
  }
}

/** Creates a `boolean` column. PostgreSQL true/false type, maps to `boolean`. */
export function boolean<TConfig extends BooleanConfig>(
  config: TConfig,
): BooleanColumn<TConfig> {
  return new BooleanColumn(config);
}
