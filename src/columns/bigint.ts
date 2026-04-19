import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type BigintValType = number;

type BigintConfig = ColumnConfig;

export class BigintColumn<TConfig extends BigintConfig> extends Column<
  TConfig,
  BigintValType
> {
  static readonly id = "Column.Bigint";

  get sqlTypeScalar() {
    return "bigint";
  }
  get zodTypeScaler() {
    return z.coerce.number();
  }

  toDriverScalar(value: BigintValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: number | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return value.toString();
  }

  fromDriverScalar(value: number | string | null): BigintValType | null {
    if (value === null) return null;
    return typeof value === "string" ? parseInt(value, 10) : value;
  }
}

/** Creates a `bigint` column. PostgreSQL 64-bit signed integer, maps to `number`. */
export function bigint<TConfig extends BigintConfig>(
  config: TConfig,
): BigintColumn<TConfig> {
  return new BigintColumn(config);
}
