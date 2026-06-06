import type { SnakeCase } from "../../types";
import { camelToSnake } from "../../utils";
import type { Snapshot } from "../snapshot";
import { DDLStatement } from "./index";

/**
 * Options for configuring a PostgreSQL sequence.
 *
 * @see {@link CreateSequenceStatement}
 */
export interface SequenceOptions {
  /** The `START WITH` value for the sequence. */
  startWith?: number;
  /** The `INCREMENT BY` value. */
  increment?: number;
  /** The minimum value (`MINVALUE`). */
  minValue?: number;
  /** The maximum value (`MAXVALUE`). */
  maxValue?: number;
  /** Whether the sequence wraps around when it reaches min/max (`CYCLE`). */
  cycle?: boolean;
  /** Number of sequence values to pre-allocate (`CACHE`). */
  cache?: number;
}

/**
 * Create a new sequence.
 *
 * @param schema - The schema the sequence belongs to.
 * @param name - The sequence name.
 * @param options - Optional sequence configuration.
 * @returns A {@link CreateSequenceStatement}.
 */
export function createSequence(
  schema: string,
  name: string,
  options?: SequenceOptions,
): CreateSequenceStatement {
  return new CreateSequenceStatement(schema, name, options);
}

/**
 * DDL statement that creates a new PostgreSQL sequence.
 *
 * Generates: `CREATE SEQUENCE "schema"."name" [START WITH n] [INCREMENT BY n] ...;`
 *
 * @example
 * ```typescript
 * ddl.createSequence('public', 'orderSeq', {
 *   startWith: 1000,
 *   increment: 1,
 *   cache: 10,
 * });
 * // CREATE SEQUENCE "public"."order_seq" START WITH 1000 INCREMENT BY 1 CACHE 10;
 * ```
 */
export class CreateSequenceStatement extends DDLStatement {
  readonly type = "createSequence" as const;
  private readonly schema: SnakeCase;
  private readonly name: SnakeCase;
  private readonly options: SequenceOptions;

  /**
   * @param schema - The schema the sequence belongs to.
   * @param name - The sequence name.
   * @param options - Optional sequence configuration.
   */
  constructor(schema: string, name: string, options: SequenceOptions = {}) {
    super();
    this.schema = camelToSnake(schema);
    this.name = camelToSnake(name);
    this.options = options;
  }

  toSQL(): string {
    const relation = `"${this.schema}"."${this.name}"`;
    let sql = `CREATE SEQUENCE ${relation}`;
    if (this.options.startWith !== undefined)
      sql += ` START WITH ${this.options.startWith}`;
    if (this.options.increment !== undefined)
      sql += ` INCREMENT BY ${this.options.increment}`;
    if (this.options.minValue !== undefined)
      sql += ` MINVALUE ${this.options.minValue}`;
    if (this.options.maxValue !== undefined)
      sql += ` MAXVALUE ${this.options.maxValue}`;
    if (this.options.cycle) sql += " CYCLE";
    if (this.options.cache !== undefined) sql += ` CACHE ${this.options.cache}`;
    return `${sql};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    snapshot.sequences[key] = {
      schema: this.schema,
      name: this.name,
      startWith: this.options.startWith,
      increment: this.options.increment,
      minValue: this.options.minValue,
      maxValue: this.options.maxValue,
      cycle: this.options.cycle,
      cache: this.options.cache,
    };
  }
}

/**
 * Drop a sequence.
 *
 * @param schema - The schema the sequence belongs to.
 * @param name - The sequence name.
 * @returns A {@link DropSequenceStatement}.
 */
export function dropSequence(
  schema: string,
  name: string,
): DropSequenceStatement {
  return new DropSequenceStatement(schema, name);
}

/**
 * DDL statement that drops an existing PostgreSQL sequence.
 *
 * Generates: `DROP SEQUENCE "schema"."name";`
 *
 * @example
 * ```typescript
 * ddl.dropSequence('public', 'orderSeq');
 * // DROP SEQUENCE "public"."order_seq";
 * ```
 */
export class DropSequenceStatement extends DDLStatement {
  readonly type = "dropSequence" as const;

  /**
   * @param schema - The schema the sequence belongs to.
   * @param name - The sequence name to drop.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
  ) {
    super();
  }

  toSQL(): string {
    const relation = `"${this.schema}"."${this.name}"`;
    return `DROP SEQUENCE ${relation};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    delete snapshot.sequences[key];
  }
}
