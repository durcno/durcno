import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type SmallserialValType = number;

type SmallserialConfig = Pick<ColumnConfig, "primaryKey" | "unique">;

// Internal config type that forces ValTypeInsert and ValTypeSelect to resolve correctly
type SmallserialInternalConfig<TConfig extends SmallserialConfig> = TConfig & {
  // Force generated: "BY DEFAULT" to make ValTypeInsert = number | undefined
  generated: "BY DEFAULT";
  // Force notNull: true to make ValTypeSelect = number (not nullable)
  notNull: true;
};

export class SmallserialColumn<
  TConfig extends SmallserialConfig,
> extends Column<SmallserialInternalConfig<TConfig>, SmallserialValType> {
  static readonly id = "Column.Smallserial";

  constructor(config: TConfig) {
    // Pass config with internal type forcing
    super(config as SmallserialInternalConfig<TConfig>);
  }

  get sqlTypeScalar() {
    return "smallserial";
  }

  get sqlCastScalar() {
    return null;
  }

  get zodTypeScaler() {
    return z.coerce.number();
  }

  toDriverScalar(value: SmallserialValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql ? value.string : value;
  }

  toSQLScalar(value: number | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    return value.toString();
  }

  fromDriverScalar(value: number | string | null): SmallserialValType | null {
    if (value === null) return null;
    return typeof value === "string" ? parseInt(value, 10) : value;
  }
}

/** Creates a `smallserial` column. Auto-incrementing 16-bit integer, implicitly `NOT NULL`. Maps to `number`. */
export function smallserial<TConfig extends SmallserialConfig>(
  config: TConfig,
): SmallserialColumn<TConfig> {
  return new SmallserialColumn(config);
}
