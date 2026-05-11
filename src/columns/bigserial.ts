import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig, type GeneratedByDefault } from "./common";

type BigserialValType = bigint;

type BigserialConfig = Pick<ColumnConfig, "primaryKey" | "unique">;

type BigserialInternalConfig<TConfig extends BigserialConfig> = TConfig & {
  // Force notNull: true to make ValTypeSelect = number (not nullable)
  notNull: true;
};

export class BigserialColumn<TConfig extends BigserialConfig> extends Column<
  BigserialInternalConfig<TConfig>,
  BigserialValType,
  "numeric"
> {
  static readonly id = "Column.Bigserial";

  constructor(config: TConfig) {
    // Pass config with internal type forcing
    super(config as BigserialInternalConfig<TConfig>);
  }

  get sqlTypeScalar() {
    return "bigserial";
  }

  get sqlCastScalar() {
    return null;
  }

  get zodTypeScaler() {
    return z.coerce.bigint();
  }

  toDriverScalar(value: BigserialValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value.toString();
  }

  toSQLScalar(value: BigserialValType | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return value.toString();
  }

  fromDriverScalar(
    value: BigserialValType | string | null,
  ): BigserialValType | null {
    if (value === null) return null;
    return BigInt(value);
  }
}

/** Creates a `bigserial` column. Auto-incrementing 64-bit integer, implicitly `NOT NULL`. Maps to `bigint`. */
export function bigserial<TConfig extends BigserialConfig>(config: TConfig) {
  return new BigserialColumn(config) as GeneratedByDefault<
    BigserialColumn<TConfig>
  >;
}
