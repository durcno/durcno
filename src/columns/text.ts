import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type TextValType = string;

type TextConfig = ColumnConfig;

export class TextColumn<TConfig extends TextConfig> extends Column<
  TConfig,
  TextValType,
  "text"
> {
  static readonly id = "Column.Text";

  get sqlTypeScalar() {
    return "text";
  }

  get sqlCastScalar() {
    return null;
  }

  get zodTypeScaler() {
    return z.string();
  }

  toDriverScalar(value: TextValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: string | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'${value.replace(/'/g, "''")}'`;
  }

  fromDriverScalar(value: string | null): TextValType | null {
    return value;
  }
}

/** Creates a `text` column. PostgreSQL variable-length string with no length limit, maps to `string`. */
export function text<TConfig extends TextConfig>(
  config: TConfig,
): TextColumn<TConfig> {
  return new TextColumn(config);
}
