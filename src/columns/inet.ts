import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type InetValType = string;

type InetConfig = ColumnConfig;

export class InetColumn<TConfig extends InetConfig> extends Column<
  TConfig,
  InetValType
> {
  static readonly id = "Column.Inet";

  get sqlTypeScalar() {
    return "inet";
  }

  get zodTypeScaler() {
    return z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()]);
  }

  toDriverScalar(value: InetValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: InetValType | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return `'${value.replace(/'/g, "''")}'`;
  }

  fromDriverScalar(value: string | null): InetValType | null {
    return value;
  }
}

/** Creates an `inet` column. PostgreSQL IPv4/IPv6 host address type, maps to `string`. */
export function inet<TConfig extends InetConfig>(
  config: TConfig,
): InetColumn<TConfig> {
  return new InetColumn(config);
}
