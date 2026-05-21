import type { QueryExecutor } from "../connectors/common";
import type { AnyDBorTX } from "../db";
import { entityType } from "../symbols";
import type { Query } from "./query";
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

export class PreparedStatement<TArgs extends Record<string, AnyArg>, TReturn> {
  readonly #query: Query;
  readonly #args: TArgs;
  constructor(query: Query, args: TArgs) {
    this.#query = query;
    this.#args = args;
  }
  run(db: AnyDBorTX, values: { [K in keyof TArgs]: TArgs[K]["$"]["TsType"] }) {
    const args = [];
    for (const k of this.#query.arguments) {
      args.push(this.#args[k as keyof TArgs].handler(values[k as keyof TArgs]));
    }
    this.#query.arguments = args;
    return new PreparedQuery<TReturn>(this.#query, db._.getExecutor());
  }
}

export class PreparedQuery<TReturn> extends QueryPromise<TReturn> {
  readonly query: Query;
  readonly executor: QueryExecutor;
  constructor(query: Query, executor: QueryExecutor) {
    super();
    this.query = query;
    this.executor = executor;
  }

  toQuery() {
    return this.query as Query<TReturn>;
  }

  async execute(): Promise<TReturn> {
    const res = await this.executor.execQuery(this.query);
    const rows = this.executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: any[]) {
    return this.query.rowsHandler(rows) as TReturn;
  }
}

export function prequery<TArgs extends Record<string, AnyArg>, TReturn>(
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
  const query = statement(args).toQuery();
  return new PreparedStatement<TArgs, TReturn>(query, args);
}
