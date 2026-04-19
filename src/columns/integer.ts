import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type IntegerValType = number;

type IntegerConfig = ColumnConfig;

export class IntegerColumn<TConfig extends IntegerConfig> extends Column<
  TConfig,
  IntegerValType
> {
  static readonly id = "Column.Integer";

  get sqlTypeScalar() {
    return "integer";
  }

  get zodTypeScaler() {
    return z.coerce.number();
  }

  toDriverScalar(value: IntegerValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: number | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return value.toString();
  }

  fromDriverScalar(value: number | string | null): IntegerValType | null {
    if (value === null) return null;
    return typeof value === "string" ? parseInt(value, 10) : value;
  }
}

/** Creates an `integer` column. PostgreSQL 32-bit signed integer, maps to `number`. */
export function integer<TConfig extends IntegerConfig>(
  config: TConfig,
): IntegerColumn<TConfig> {
  return new IntegerColumn(config);
}
