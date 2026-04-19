import type { QueryExecutor } from "../connectors/common";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class RawQuery<TReturn> extends QueryPromise<TReturn> {
  readonly #queryStr: string;
  readonly #args: (string | number | null)[];
  readonly #executor: QueryExecutor;
  readonly handleRows: (rows: unknown[]) => TReturn;
  constructor(
    query: string,
    args: (string | number | null)[] = [],
    rowsHandler: ((rows: unknown[]) => TReturn) | undefined,
    executor: QueryExecutor,
  ) {
    super();
    this.#queryStr = query;
    this.#args = args;
    this.handleRows = rowsHandler ?? ((rows: unknown[]) => rows as TReturn);
    this.#executor = executor;
  }

  toQuery() {
    return new Query(this.#queryStr, this.handleRows.bind(this));
  }

  async execute(): Promise<TReturn> {
    const res = await this.#executor.query(this.#queryStr, this.#args);
    const rows = this.#executor.getRows(res);
    return this.handleRows(rows);
  }
}
