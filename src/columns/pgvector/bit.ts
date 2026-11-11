import * as z from "zod";
import { Sql } from "../../sql";
import { Column, type ColumnConfig } from "../common";

export type BitConfig = ColumnConfig & {
  length?: number;
};

const BIT_STRING_REGEX = /^[01]+$/;

/** Rejects anything that would not be a valid PostgreSQL bit string literal. */
function assertBitString(value: string): void {
  if (typeof value !== "string" || !BIT_STRING_REGEX.test(value)) {
    throw new Error(`Invalid bit string value: ${value}`);
  }
}

export class BitColumn<TConfig extends BitConfig> extends Column<
  TConfig,
  string,
  "string"
> {
  static readonly id = "Column.Bit";
  readonly #length: number | undefined;

  constructor(config: TConfig) {
    super(config);
    this.#length = config.length;
  }

  get sqlTypeScalar(): string {
    return this.#length ? `bit(${this.#length})` : "bit";
  }

  get sqlCastScalar(): string {
    return this.sqlTypeScalar;
  }

  get zodTypeScaler() {
    let base = z.string().regex(BIT_STRING_REGEX);
    if (this.#length !== undefined) {
      base = base.length(this.#length);
    }
    return base;
  }

  toDriverScalar(value: string | Sql | null) {
    if (value === null) return null;
    if (value instanceof Sql) return value.string;
    assertBitString(value);
    return value;
  }

  toSQLScalar(value: string | Sql | null): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;
    assertBitString(value);
    return `B'${value}'`;
  }

  fromDriverScalar(value: string | null): string | null {
    return value;
  }
}

/**
 * Creates a `bit` column. PostgreSQL bit string type, maps to `string`.
 *
 * @example
 * ```ts
 * bit({ length: 16, notNull }) // bit(16) NOT NULL
 * ```
 *
 * @param config.length - Fixed bit string length
 */
export function bit<const TConfig extends BitConfig>(
  config: TConfig = {} as TConfig,
) {
  return new BitColumn(config);
}
