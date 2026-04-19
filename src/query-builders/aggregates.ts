import type { QueryExecutor } from "../connectors/common";
import type { BuildFilterExpression } from "../filters/index";
import type { Config } from "../index";
import type {
  AnyColumn,
  TableColumn,
  TableWithColumns,
  TColsToLeftRight,
} from "../table";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

type AggregateFunction = "SUM" | "AVG" | "MIN" | "MAX";

export class AggregateQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TColumn extends TableColumn<string, string, Key, AnyColumn>,
  TReturn extends number | null,
> extends QueryPromise<TReturn> {
  readonly #$table: TTableWC;
  readonly #$column: TColumn;
  readonly #$fn: AggregateFunction;
  readonly #$where:
    | BuildFilterExpression<TColsToLeftRight<TTableWC["_"]["columns"]>>
    | undefined;
  readonly #$config: Config;
  readonly #$executor: QueryExecutor;

  constructor(
    table: TTableWC,
    column: TColumn,
    fn: AggregateFunction,
    where:
      | BuildFilterExpression<TColsToLeftRight<TTableWC["_"]["columns"]>>
      | undefined,
    config: Config,
    executor: QueryExecutor,
  ) {
    super();
    this.#$table = table;
    this.#$column = column;
    this.#$fn = fn;
    this.#$where = where;
    this.#$config = config;
    this.#$executor = executor;
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
      query.sql += this.#$where.toSQL();
    }
    return query;
  }

  async execute(): Promise<TReturn> {
    const query = this.toQuery();
    const res = await this.#$executor.query(query.sql, query.arguments);
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
