import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type RealValType = number;

type RealConfig = ColumnConfig;

export class RealColumn<TConfig extends RealConfig> extends Column<
  TConfig,
  RealValType,
  "float"
> {
  static readonly id = "Column.Real";

  get sqlTypeScalar() {
    return "real";
  }

  get sqlCastScalar() {
    return null;
  }

  get zodTypeScaler() {
    return z.coerce.number();
  }

  toDriverScalar(value: RealValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: number | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return value.toString();
  }

  fromDriverScalar(value: number | string | null): RealValType | null {
    if (value === null) return null;
    return typeof value === "string" ? parseFloat(value) : value;
  }
}

/** Creates a `real` column. PostgreSQL 4-byte floating-point number, maps to `number`. */
export function real<TConfig extends RealConfig>(
  config: TConfig,
): RealColumn<TConfig> {
  return new RealColumn(config);
}
