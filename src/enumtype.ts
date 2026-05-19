import { type EnumedColumn, type EnumedConfig, enumed } from "./columns/enum";
import { entityType } from "./symbols";
import type { SnakeCase } from "./types";
import { camelToSnake } from "./utils";

/** Represents a PostgreSQL enum type definition. */
export class Enum<
  U extends string = string,
  TValues extends Readonly<[U, ...U[]]> = Readonly<[U, ...U[]]>,
> {
  static readonly [entityType] = "Enum";
  readonly TValue!: TValues[number];
  /** The raw schema identifier as provided by the user (may be camelCase). */
  readonly schema: string;
  /** The snake_case version of {@link schema} used in generated SQL. */
  readonly schemaSql: SnakeCase;
  /** The raw enum name as provided by the user (may be camelCase). */
  readonly name: string;
  /** The snake_case version of {@link name} used in generated SQL. */
  readonly nameSql: SnakeCase;
  /** The ordered list of allowed enum values. */
  readonly values: TValues;
  constructor(schema: string, name: string, values: TValues) {
    this.schema = schema;
    this.schemaSql = camelToSnake(schema);
    this.name = name;
    this.nameSql = camelToSnake(name);
    this.values = values;
  }
  enumed<TConfig extends EnumedConfig>(config: TConfig) {
    return enumed(this, config) as EnumedColumn<TValues[number], TConfig>;
  }
}

/**
 * Creates a typed enum definition.
 *
 * @example
 * ```ts
 * import { enumtype } from "durcno";
 *
 * export const UserTypeEnm = enumtype("public", "userType", ["admin", "user"]);
 * ```
 */
export function enumtype<
  U extends string,
  TValues extends Readonly<[U, ...U[]]>,
>(schema: string, name: string, values: TValues) {
  return new Enum(schema, name, values);
}
