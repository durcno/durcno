import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type BigserialValType = number;

type BigserialConfig = Pick<ColumnConfig, "primaryKey" | "unique">;

// Internal config type that forces ValTypeInsert and ValTypeSelect to resolve correctly
type BigserialInternalConfig<TConfig extends BigserialConfig> = TConfig & {
  // Force generated: "BY DEFAULT" to make ValTypeInsert = number | undefined
  generated: "BY DEFAULT";
  // Force notNull: true to make ValTypeSelect = number (not nullable)
  notNull: true;
};

export class BigserialColumn<TConfig extends BigserialConfig> extends Column<
  BigserialInternalConfig<TConfig>,
  BigserialValType
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
    return z.coerce.number();
  }

  toDriverScalar(value: BigserialValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: number | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return value.toString();
  }

  fromDriverScalar(value: number | string | null): BigserialValType | null {
    if (value === null) return null;
    return typeof value === "string" ? parseInt(value, 10) : value;
  }
}

/** Creates a `bigserial` column. Auto-incrementing 64-bit integer, implicitly `NOT NULL`. Maps to `number`. */
export function bigserial<TConfig extends BigserialConfig>(
  config: TConfig,
): BigserialColumn<TConfig> {
  return new BigserialColumn(config);
}
