import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type DoublePrecisionValType = number;

type DoublePrecisionConfig = ColumnConfig;

export class DoublePrecisionColumn<
  TConfig extends DoublePrecisionConfig,
> extends Column<TConfig, DoublePrecisionValType, "float"> {
  static readonly id = "Column.DoublePrecision";

  get sqlTypeScalar() {
    return "double precision";
  }

  get sqlCastScalar() {
    return null;
  }

  get zodTypeScaler() {
    return z.coerce.number();
  }

  toDriverScalar(value: DoublePrecisionValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: number | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return value.toString();
  }

  fromDriverScalar(
    value: number | string | null,
  ): DoublePrecisionValType | null {
    if (value === null) return null;
    return typeof value === "string" ? parseFloat(value) : value;
  }
}

/** Creates a `double precision` column. PostgreSQL 8-byte floating-point number, maps to `number`. */
export function doublePrecision<TConfig extends DoublePrecisionConfig>(
  config: TConfig,
): DoublePrecisionColumn<TConfig> {
  return new DoublePrecisionColumn(config);
}
