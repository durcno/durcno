import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type ByteaValType = Buffer;

type ByteaConfig = ColumnConfig;

export class ByteaColumn<TConfig extends ByteaConfig> extends Column<
  TConfig,
  ByteaValType,
  "bytea"
> {
  static readonly id = "Column.Bytea";

  get sqlTypeScalar() {
    return "bytea";
  }

  get sqlCastScalar() {
    return "bytea";
  }

  get zodTypeScaler() {
    return z.instanceof(Buffer);
  }

  toDriverScalar(value: ByteaValType | Sql | null): string | null {
    if (value === null) return null;
    if (value instanceof Sql) return value.string;
    // Convert Buffer to hex string format
    return `\\x${value.toString("hex")}`;
  }

  toSQLScalar(value: ByteaValType | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    // Convert Buffer to PostgreSQL hex format: E'\\x...'
    return `'\\x${value.toString("hex")}'`;
  }

  fromDriverScalar(value: Buffer | string | null): ByteaValType | null {
    if (value === null) return null;
    if (typeof value === "string") {
      return value.startsWith("\\x")
        ? Buffer.from(value.slice(2), "hex")
        : Buffer.from(value, "binary");
    }
    return value;
  }
}

/** Creates a `bytea` column. PostgreSQL binary data type, maps to `Buffer`. */
export function bytea<TConfig extends ByteaConfig>(
  config: TConfig,
): ByteaColumn<TConfig> {
  return new ByteaColumn(config);
}
