import * as z from "zod";
import { Sql } from "../sql";
import { Column, type ColumnConfig } from "./common";

type DateValType = Date;

type DateConfig = ColumnConfig;

export class DateColumn<TConfig extends DateConfig> extends Column<
  TConfig,
  DateValType
> {
  static readonly id = "Column.Date";

  get sqlTypeScalar() {
    return "date";
  }

  get zodTypeScaler() {
    return z.date();
  }

  toDriverScalar(value: DateValType | Sql | null) {
    if (value === null) return null;
    return value instanceof Sql
      ? value.string
      : value.toISOString().slice(0, 10);
  }

  toSQLScalar(value: Date | Sql | null): string {
    if (value === null) return "NULL";
    return value instanceof Sql
      ? value.string
      : `'${value.toISOString().slice(0, 10)}'`;
  }

  fromDriverScalar(value: Date | string | null): DateValType | null {
    if (value === null) return null;
    // PostgreSQL date columns can return either a Date or string (YYYY-MM-DD).
    // When the driver returns a Date, it's set to midnight in local timezone,
    // which can shift the date when converted to UTC. To ensure consistent
    // UTC dates, we extract the local date components and create a UTC Date.
    if (value instanceof Date) {
      return new Date(
        Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
      );
    }
    // If it's a string (YYYY-MM-DD), parse it as UTC
    return new Date(`${value}T00:00:00Z`);
  }
}

/** Creates a `date` column. PostgreSQL calendar date (no time), maps to `Date`. */
export function date<TConfig extends DateConfig>(
  config: TConfig,
): DateColumn<TConfig> {
  return new DateColumn(config);
}
