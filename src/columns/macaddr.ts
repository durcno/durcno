import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type MacaddrValType = string;

type MacaddrConfig = ColumnConfig;

export class MacaddrColumn<TConfig extends MacaddrConfig> extends Column<
  TConfig,
  MacaddrValType
> {
  static readonly id = "Column.Macaddr";

  get sqlTypeScalar() {
    return "macaddr";
  }

  get sqlCastScalar() {
    return "macaddr";
  }

  get zodTypeScaler() {
    return z.mac();
  }

  toDriverScalar(value: MacaddrValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: string | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return `'${value.replace(/'/g, "''")}'`;
  }

  fromDriverScalar(value: string | null): MacaddrValType | null {
    return value;
  }
}

/** Creates a `macaddr` column. PostgreSQL MAC address type, maps to `string`. */
export function macaddr<TConfig extends MacaddrConfig>(
  config: TConfig,
): MacaddrColumn<TConfig> {
  return new MacaddrColumn(config);
}
