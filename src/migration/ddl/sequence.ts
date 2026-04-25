import type { Snapshot } from "../snapshot";
import { DDLStatement } from "./statement";
import { buildRelation } from "./utils";

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
 * DDL statement that creates a new PostgreSQL sequence.
 *
 * Generates: `CREATE SEQUENCE "schema"."name" [START WITH n] [INCREMENT BY n] ...;`
 *
 * @example
 * ```typescript
 * ddl.createSequence('public', 'order_seq', {
 *   startWith: 1000,
 *   increment: 1,
 *   cache: 10,
 * });
 * // CREATE SEQUENCE "public"."order_seq" START WITH 1000 INCREMENT BY 1 CACHE 10;
 * ```
 */
export class CreateSequenceStatement extends DDLStatement {
  readonly type = "createSequence" as const;

  /**
   * @param schema - The schema the sequence belongs to.
   * @param name - The sequence name.
   * @param options - Optional sequence configuration.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
    private readonly options: SequenceOptions = {},
  ) {
    super();
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.name);
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
 * DDL statement that drops an existing PostgreSQL sequence.
 *
 * Generates: `DROP SEQUENCE "schema"."name";`
 *
 * @example
 * ```typescript
 * ddl.dropSequence('public', 'order_seq');
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
    const relation = buildRelation(this.schema, this.name);
    return `DROP SEQUENCE ${relation};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    delete snapshot.sequences[key];
  }
}
