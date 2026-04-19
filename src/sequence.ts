import { Sql } from "./sql";
import { entityType } from "./symbols";

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

export class Sequence<TConfig extends SequenceOptions = SequenceOptions> {
  static readonly [entityType] = "Sequence";
  readonly #schema: string;
  readonly #name: string;
  readonly #config: TConfig;

  constructor(schema: string, name: string, config: TConfig) {
    this.#schema = schema;
    this.#name = name;
    this.#config = config;
  }

  get schema() {
    return this.#schema;
  }
  get name() {
    return this.#name;
  }
  get config() {
    return this.#config;
  }

  /** Returns SQL: nextval('schema.sequence_name') for use in column defaults or queries */
  nextval(): Sql {
    const fullName = this.#schema
      ? `"${this.#schema}"."${this.#name}"`
      : `"${this.#name}"`;
    return new Sql(`nextval('${fullName}')`);
  }

  /** Returns SQL: currval('schema.sequence_name') */
  currval(): Sql {
    const fullName = this.#schema
      ? `"${this.#schema}"."${this.#name}"`
      : `"${this.#name}"`;
    return new Sql(`currval('${fullName}')`);
  }

  /** Returns SQL: setval('schema.sequence_name', value) */
  setval(value: number): Sql {
    const fullName = this.#schema
      ? `"${this.#schema}"."${this.#name}"`
      : `"${this.#name}"`;
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
 * export const UserIdSeq = sequence("public", "user_id_seq", {
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
