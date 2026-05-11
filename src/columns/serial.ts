import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig, type GeneratedByDefault } from "./common";

type SerialValType = number;

type SerialConfig = Pick<ColumnConfig, "primaryKey" | "unique">;

type SerialInternalConfig<TConfig extends SerialConfig> = TConfig & {
  // Force notNull: true to make ValTypeSelect = number (not nullable)
  notNull: true;
};

export class SerialColumn<TConfig extends SerialConfig> extends Column<
  SerialInternalConfig<TConfig>,
  SerialValType,
  "numeric"
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
export function serial<TConfig extends SerialConfig>(config: TConfig) {
  return new SerialColumn(config) as GeneratedByDefault<SerialColumn<TConfig>>;
}
