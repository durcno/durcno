import type { QueryExecutor } from "../connectors/common";
import type { RawRow, SqlArgType } from "../types";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class RawQuery<TReturn> extends QueryPromise<TReturn> {
  readonly #queryStr: string;
  readonly #args: SqlArgType[];
  readonly #executor: QueryExecutor;
  readonly handleRows: (rows: RawRow[]) => TReturn;
  constructor(
    query: string,
    args: SqlArgType[] = [],
    rowsHandler: ((rows: RawRow[]) => TReturn) | undefined,
    executor: QueryExecutor,
  ) {
    super();
    this.#queryStr = query;
    this.#args = args;
    this.handleRows = rowsHandler ?? ((rows: RawRow[]) => rows as TReturn);
    this.#executor = executor;
  }

  toQuery() {
    return new Query(this.#queryStr, this.handleRows.bind(this));
  }

  async execute(): Promise<TReturn> {
    const res = await this.#executor.execStrArgs(this.#queryStr, this.#args);
    const rows = this.#executor.getRows(res);
    return this.handleRows(rows);
  }
}
