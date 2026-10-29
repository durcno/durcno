import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type TsvectorValType = string;

type TsvectorConfig = ColumnConfig;

export class TsvectorColumn<TConfig extends TsvectorConfig> extends Column<
  TConfig,
  TsvectorValType,
  "tsvector"
> {
  static readonly id = "Column.Tsvector";

  get sqlTypeScalar() {
    return "tsvector";
  }

  get sqlCastScalar() {
    return "tsvector";
  }

  get zodTypeScaler() {
    return z.string();
  }

  toDriverScalar(value: TsvectorValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: TsvectorValType | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'${value.replace(/'/g, "''")}'`;
  }

  fromDriverScalar(value: string | null): TsvectorValType | null {
    return value;
  }
}

/** Creates a `tsvector` column. PostgreSQL full-text search vector, maps to `string`. */
export function tsvector<TConfig extends TsvectorConfig>(
  config: TConfig,
): TsvectorColumn<TConfig> {
  return new TsvectorColumn(config);
}
