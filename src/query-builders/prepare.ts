import type { QueryExecutor } from "../connectors/common";
import type { AnyDBorTX } from "../db";
import { entityType } from "../symbols";
import type { BasicTypes } from "../types";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class Arg<TType> {
  static readonly [entityType] = "Arg";
  $!: {
    TsType: TType;
  };
  /** `$N` placeholder number of this argument, assigned by `prepare` (0 before). */
  index: number = 0;
  /** Name of this argument in the `prepare` args object, assigned by `prepare`. */
  key: string = "";
  /** Handler function to convert the argument value to a format suitable for the database client. */
  readonly handler: (val: TType) => string | number | null;
  /** PostgreSQL cast type suffix (e.g. `"boolean"`, `"geography"`), or `null` if no cast needed. */
  readonly cast: string | null = null;
  constructor(
    handler: (val: TType) => string | number | null,
    cast: string | null = null,
  ) {
    this.handler = handler;
    this.cast = cast;
  }

  /** Creates an Arg that accepts a JS `number`. */
  static number() {
    return new Arg<number>((val) => val, null);
  }

  /** Creates an Arg that accepts a JS `bigint`. */
  static bigint() {
    return new Arg<bigint>((val) => val.toString(), null);
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnyArg = Arg<any>;

export type IsArg<T> = T extends AnyArg ? true : false;

/** One resolved argument slot, in `$N` placeholder order, for a single `run()`. */
type ArgSlot = {
  readonly key: keyof Record<string, AnyArg>;
  readonly handler: (val: never) => string | number | null;
};

export class PrepareStatement<TArgs extends Record<string, AnyArg>, TReturn> {
  readonly #query: Query<TReturn>;
  readonly #slots: readonly ArgSlot[];
  constructor(query: Query<TReturn>, slots: readonly ArgSlot[]) {
    this.#query = query;
    this.#slots = slots;
  }

  run(
    db: AnyDBorTX,
    values: { [K in keyof TArgs]: TArgs[K]["$"]["TsType"] },
  ): PrepareQuery<TReturn> {
    const slots = this.#slots;
    const count = slots.length;
    const args = new Array<BasicTypes>(count);
    for (let i = 0; i < count; i++) {
      const slot = slots[i];
      args[i] = (slot.handler as (val: unknown) => string | number | null)(
        values[slot.key as keyof TArgs],
      );
    }
    return new PrepareQuery(this.#query, args, db._.getExecutor());
  }
}

export class PrepareQuery<TReturn> extends QueryPromise<TReturn> {
  readonly query: Query<TReturn>;
  readonly arguments: BasicTypes[];
  readonly executor: QueryExecutor;
  constructor(
    query: Query<TReturn>,
    args: BasicTypes[],
    executor: QueryExecutor,
  ) {
    super();
    this.query = query;
    this.arguments = args;
    this.executor = executor;
  }

  toQuery() {
    const query = new Query<TReturn>(this.query.sql, this.query.rowsHandler);
    query.arguments = this.arguments;
    return query;
  }

  async execute(): Promise<TReturn> {
    const res = await this.executor.execStrArgs(
      this.query.sql,
      this.arguments,
      true,
    );
    const rows = this.executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: any[]) {
    return this.query.rowsHandler(rows) as TReturn;
  }
}

export function prepare<TArgs extends Record<string, AnyArg>, TReturn>(
  args: TArgs,
  statement: (
    ...args: [{ [K in keyof TArgs]: TArgs[K] }]
  ) => Promise<TReturn> & { toQuery: () => Query },
) {
  const keys = Object.keys(args).sort();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    args[key].index = i + 1;
    args[key].key = key;
  }
  const query = statement(args).toQuery() as Query<TReturn>;
  const argCount = query.arguments.length;
  const slots: ArgSlot[] = [];
  // Only the args the query actually emitted; `keys` may hold unused ones.
  for (const key of keys) {
    if (slots.length === argCount) break;
    slots.push({
      key: key as keyof TArgs & string,
      handler: args[key].handler as (val: unknown) => string | number | null,
    });
  }
  return new PrepareStatement<TArgs, TReturn>(query, slots);
}
