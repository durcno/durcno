import { type EnumedColumn, type EnumedConfig, enumed } from "./columns/enum";
import { entityType } from "./symbols";

export class Enum<
  U extends string = string,
  TValues extends Readonly<[U, ...U[]]> = Readonly<[U, ...U[]]>,
> {
  static readonly [entityType] = "Enum";
  readonly TValue!: TValues[number];
  readonly #schema: string;
  readonly #name: string;
  readonly #values: TValues;
  constructor(schema: string, name: string, values: TValues) {
    this.#schema = schema;
    this.#name = name;
    this.#values = values;
  }
  get schema() {
    return this.#schema;
  }
  get name() {
    return this.#name;
  }
  get values() {
    return this.#values;
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
 * export const UserTypeEnm = enumtype("public", "user_type", ["admin", "user"]);
 * ```
 */
export function enumtype<
  U extends string,
  TValues extends Readonly<[U, ...U[]]>,
>(schema: string, name: string, values: TValues) {
  return new Enum(schema, name, values);
}
