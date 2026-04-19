import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type SmallintValType = number;

type SmallintConfig = ColumnConfig;

export class SmallintColumn<TConfig extends SmallintConfig> extends Column<
  TConfig,
  SmallintValType
> {
  static readonly id = "Column.Smallint";

  get sqlTypeScalar() {
    return "smallint";
  }

  get zodTypeScaler() {
    return z.coerce.number();
  }

  toDriverScalar(value: SmallintValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: number | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return value.toString();
  }

  fromDriverScalar(value: number | string | null): SmallintValType | null {
    if (value === null) return null;
    return typeof value === "string" ? parseInt(value, 10) : value;
  }
}

/** Creates a `smallint` column. PostgreSQL 16-bit signed integer, maps to `number`. */
export function smallint<TConfig extends SmallintConfig>(
  config: TConfig,
): SmallintColumn<TConfig> {
  return new SmallintColumn(config);
}
