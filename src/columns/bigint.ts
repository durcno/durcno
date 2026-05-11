import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type BigintValType = bigint;

type BigintConfig = ColumnConfig;

export class BigintColumn<TConfig extends BigintConfig> extends Column<
  TConfig,
  BigintValType,
  "numeric"
> {
  static readonly id = "Column.Bigint";

  get sqlTypeScalar() {
    return "bigint";
  }

  get sqlCastScalar() {
    return null;
  }
  get zodTypeScaler() {
    return z.coerce.bigint();
  }

  toDriverScalar(value: BigintValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value.toString();
  }

  toSQLScalar(value: BigintValType | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return value.toString();
  }

  fromDriverScalar(value: bigint | string | null): BigintValType | null {
    if (value === null) return null;
    return BigInt(value);
  }
}

/** Creates a `bigint` column. PostgreSQL 64-bit signed integer, maps to `bigint`. */
export function bigint<TConfig extends BigintConfig>(
  config: TConfig,
): BigintColumn<TConfig> {
  return new BigintColumn(config);
}
