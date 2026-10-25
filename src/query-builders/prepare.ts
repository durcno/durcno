import type { QueryExecutor } from "../connectors/common";
import type { AnyDBorTX } from "../db";
import { entityType } from "../symbols";
import type { BasicTypes, RawRow } from "../types";
import { type PreparedSlot, Query } from "./query";
import { QueryPromise } from "./query-promise";

export class Arg<TType> {
  static readonly [entityType] = "Arg";
  $!: {
    TsType: TType;
  };
  /** Last assigned `$N` placeholder number (0 before its first use in a query). */
  index: number = 0;
  /** Name of this argument in the `prepare` args object, assigned by `prepare`. */
  key: string = "";
  /** Handler function to convert the argument value to a format suitable for the database client. */
  readonly handler: (val: TType) => string | number | null;
  /** PostgreSQL cast type suffix (e.g. `"boolean"`, `"geography"`), or `null` if no cast needed. */
  readonly cast: string | null = null;
  /** Converts a raw driver value back to `TType`, when the argument's type is known. */
  readonly fromDriver?: (value: unknown) => unknown;
  /** Cast used when the argument is serialized into JSON without a column cast. */
  readonly jsonCast: string | null = null;
  constructor(
    handler: (val: TType) => string | number | null,
    cast: string | null = null,
    fromDriver?: (value: unknown) => unknown,
    jsonCast: string | null = null,
  ) {
    this.handler = handler;
    this.cast = cast;
    this.fromDriver = fromDriver;
    this.jsonCast = jsonCast;
  }

  /** Creates an Arg that accepts a JS `number`. */
  static number() {
    return new Arg<number>((val) => val, null, Number, "numeric");
  }

  /** Creates an Arg that accepts a JS `bigint`. */
  static bigint() {
    return new Arg<bigint>(
      (val) => val.toString(),
      null,
      (value) => BigInt(value as string | number),
      "int8",
    );
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnyArg = Arg<any>;

export type IsArg<T> = T extends AnyArg ? true : false;

export class PrepareStatement<TArgs extends Record<string, AnyArg>, TReturn> {
  readonly #query: Query<TReturn>;
  readonly #slots: readonly PreparedSlot[];
  constructor(query: Query<TReturn>, slots: readonly PreparedSlot[]) {
    this.#query = query;
    this.#slots = slots;
  }

  run(
    db: AnyDBorTX,
    values: { [K in keyof TArgs]: TArgs[K]["$"]["TsType"] },
  ): PrepareQuery<TReturn> {
    const slots = this.#slots;
    const args = new Array<BasicTypes>(slots.length);
    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      args[i] =
        slot.kind === "arg"
          ? slot.handler(values[slot.key as keyof TArgs])
          : slot.value();
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

  handleRows(rows: RawRow[]) {
    return this.query.rowsHandler(rows) as TReturn;
  }
}

export function prepare<TArgs extends Record<string, AnyArg>, TReturn>(
  args: TArgs,
  statement: (
    ...args: [{ [K in keyof TArgs]: TArgs[K] }]
  ) => Promise<TReturn> & { toQuery: () => Query },
) {
  for (const key of Object.keys(args)) {
    args[key].key = key;
    args[key].index = 0;
  }
  const query = statement(args).toQuery() as Query<TReturn>;
  return new PrepareStatement<TArgs, TReturn>(query, query.getPreparedSlots());
}
