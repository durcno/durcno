import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type SerialValType = number;

type SerialConfig = Pick<ColumnConfig, "primaryKey" | "unique">;

// Internal config type that forces ValTypeInsert and ValTypeSelect to resolve correctly
type SerialInternalConfig<TConfig extends SerialConfig> = TConfig & {
  // Force generated: "BY DEFAULT" to make ValTypeInsert = number | undefined
  generated: "BY DEFAULT";
  // Force notNull: true to make ValTypeSelect = number (not nullable)
  notNull: true;
};

export class SerialColumn<TConfig extends SerialConfig> extends Column<
  SerialInternalConfig<TConfig>,
  SerialValType
> {
  static readonly id = "Column.Serial";

  constructor(config: TConfig) {
    // Pass config with internal type forcing
    super(config as SerialInternalConfig<TConfig>);
  }

  get sqlTypeScalar() {
    return "serial";
  }

  get sqlCastScalar() {
    return null;
  }

  get zodTypeScaler() {
    return z.coerce.number();
  }

  toDriverScalar(value: SerialValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: number | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return value.toString();
  }

  fromDriverScalar(value: number | string | null): SerialValType | null {
    if (value === null) return null;
    return typeof value === "string" ? parseInt(value, 10) : value;
  }
}

/** Creates a `serial` column. Auto-incrementing 32-bit integer, implicitly `NOT NULL`. Maps to `number`. */
export function serial<TConfig extends SerialConfig>(
  config: TConfig,
): SerialColumn<TConfig> {
  return new SerialColumn(config);
}
