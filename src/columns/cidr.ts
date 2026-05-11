import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type CidrValType = string;

type CidrConfig = ColumnConfig;

export class CidrColumn<TConfig extends CidrConfig> extends Column<
  TConfig,
  CidrValType,
  "text"
> {
  static readonly id = "Column.Cidr";

  get sqlTypeScalar() {
    return "cidr";
  }

  get sqlCastScalar() {
    return "cidr";
  }

  get zodTypeScaler() {
    return z.union([z.cidrv4(), z.cidrv6()]);
  }

  toDriverScalar(value: CidrValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: string | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return `'${value.replace(/'/g, "''")}'`;
  }

  fromDriverScalar(value: string | null): CidrValType | null {
    return value;
  }
}

/** Creates a `cidr` column. PostgreSQL IPv4/IPv6 network address type, maps to `string`. */
export function cidr<TConfig extends CidrConfig>(
  config: TConfig,
): CidrColumn<TConfig> {
  return new CidrColumn(config);
}
