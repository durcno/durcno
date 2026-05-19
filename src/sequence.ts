import { Sql } from "./sql";
import { entityType } from "./symbols";
import type { SnakeCase } from "./types";
import { camelToSnake } from "./utils";

export interface SequenceOptions {
  /** The starting value of the sequence */
  startWith?: number;
  /** The increment value for the sequence */
  increment?: number;
  /** The minimum value of the sequence */
  minValue?: number;
  /** The maximum value of the sequence */
  maxValue?: number;
  /** Whether the sequence should cycle when it reaches its max/min value */
  cycle?: boolean;
  /** The number of sequence values to cache for faster access */
  cache?: number;
}

/** Represents a PostgreSQL sequence definition. */
export class Sequence<TConfig extends SequenceOptions = SequenceOptions> {
  static readonly [entityType] = "Sequence";
  /** The raw schema identifier as provided by the user (may be camelCase). */
  readonly schema: string;
  /** The snake_case version of {@link schema} used in generated SQL. */
  readonly schemaSql: SnakeCase<string>;
  /** The raw sequence name as provided by the user (may be camelCase). */
  readonly name: string;
  /** The snake_case version of {@link name} used in generated SQL. */
  readonly nameSql: SnakeCase<string>;
  /** The sequence configuration options. */
  readonly config: TConfig;

  constructor(schema: string, name: string, config: TConfig) {
    this.schema = schema;
    this.schemaSql = camelToSnake(schema);
    this.name = name;
    this.nameSql = camelToSnake(name);
    this.config = config;
  }

  /** Returns SQL: nextval('schema.sequence_name') for use in column defaults or queries */
  nextval(): Sql {
    const fullName = this.schemaSql
      ? `"${this.schemaSql}"."${this.nameSql}"`
      : `"${this.nameSql}"`;
    return new Sql(`nextval('${fullName}')`);
  }

  /** Returns SQL: currval('schema.sequence_name') */
  currval(): Sql {
    const fullName = this.schemaSql
      ? `"${this.schemaSql}"."${this.nameSql}"`
      : `"${this.nameSql}"`;
    return new Sql(`currval('${fullName}')`);
  }

  /** Returns SQL: setval('schema.sequence_name', value) */
  setval(value: number): Sql {
    const fullName = this.schemaSql
      ? `"${this.schemaSql}"."${this.nameSql}"`
      : `"${this.nameSql}"`;
    return new Sql(`setval('${fullName}', ${value})`);
  }
}

/**
 * Creates a typed PostgreSQL sequence definition.
 *
 * @example
 * ```ts
 * import { sequence } from "durcno";
 *
 * export const UserIdSeq = sequence("public", "userIdSeq", {
 *   startWith: 1,
 *   increment: 1,
 * });
 * ```
 */
export function sequence<TConfig extends SequenceOptions>(
  schema: string,
  name: string,
  config: TConfig = {} as TConfig,
) {
  return new Sequence(schema, name, config);
}
