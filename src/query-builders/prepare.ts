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
  index: number = 0;
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

export type IsArg<T> = T extends Arg<any> ? true : false;

export class PrepareStatement<TArgs extends Record<string, AnyArg>, TReturn> {
  readonly #query: Query<TReturn>;
  readonly #args: TArgs;
  constructor(query: Query<TReturn>, args: TArgs) {
    this.#query = query;
    this.#args = args;
  }
  run(
    db: AnyDBorTX,
    values: { [K in keyof TArgs]: TArgs[K]["$"]["TsType"] },
  ): PrepareQuery<TReturn> {
    const args = [] as BasicTypes[];
    for (const k of this.#query.arguments) {
      args.push(this.#args[k as keyof TArgs].handler(values[k as keyof TArgs]));
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
    const res = await this.executor.execStrArgs(this.query.sql, this.arguments);
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
  return new PrepareStatement<TArgs, TReturn>(query, args);
}
