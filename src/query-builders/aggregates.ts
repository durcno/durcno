import type { QueryExecutor } from "../connectors/common";
import type { FilterExpression } from "../filters/index";
import type { AnyColumn, StdTableColumn, TableWithColumns } from "../table";
import type { Valueof } from "../types";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

type AggregateFunction = "SUM" | "AVG" | "MIN" | "MAX";

export class AggregateQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TColumn extends StdTableColumn,
  TReturn extends number | null,
  TPrepare extends boolean = false,
> extends QueryPromise<TReturn> {
  readonly #$table: TTableWC;
  readonly #$column: TColumn;
  readonly #$fn: AggregateFunction;
  readonly #$where:
    | FilterExpression<Valueof<TTableWC["_"]["columns"]>, TPrepare>
    | undefined;
  readonly #$executor: QueryExecutor;
  readonly #$prepare: TPrepare;

  constructor(
    table: TTableWC,
    column: TColumn,
    fn: AggregateFunction,
    where:
      | FilterExpression<Valueof<TTableWC["_"]["columns"]>, TPrepare>
      | undefined,
    executor: QueryExecutor,
    prepare: TPrepare = false as TPrepare,
  ) {
    super();
    this.#$table = table;
    this.#$column = column;
    this.#$fn = fn;
    this.#$where = where;
    this.#$executor = executor;
    this.#$prepare = prepare;
  }

  toQuery() {
    const columnName = this.#$column.fullName;
    const query = new Query(
      `SELECT ${this.#$fn}(${columnName}) as result FROM `,
      this.handleRows.bind(this),
    );
    query.sql += this.#$table._.fullName;
    if (this.#$where) {
      query.sql += " WHERE ";
      this.#$where.toQuery(query);
    }
    return query;
  }

  async execute(): Promise<TReturn> {
    const query = this.toQuery();
    const res = await this.#$executor.execQuery(query);
    const rows = this.#$executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: { result: string | null }[]): TReturn {
    const result = rows[0].result;
    if (result === null) {
      return null as TReturn;
    }
    return Number(result) as TReturn;
  }
}
