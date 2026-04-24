import type { QueryExecutor } from "../connectors/common";
import type { BuildFilterExpression } from "../filters/index";
import type {
  AnyColumn,
  TableColumn,
  TableWithColumns,
  TColsToLeftRight,
} from "../table";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class DistinctQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TColumn extends TableColumn<string, string, Key, AnyColumn>,
  TReturn = TColumn["ValTypeSelect"][],
> extends QueryPromise<TReturn> {
  readonly #$table: TTableWC;
  readonly #$column: TColumn;
  readonly #$where:
    | BuildFilterExpression<TColsToLeftRight<TTableWC["_"]["columns"]>>
    | undefined;
  readonly #$executor: QueryExecutor;

  constructor(
    table: TTableWC,
    column: TColumn,
    where:
      | BuildFilterExpression<TColsToLeftRight<TTableWC["_"]["columns"]>>
      | undefined,
    executor: QueryExecutor,
  ) {
    super();
    this.#$table = table;
    this.#$column = column;
    this.#$where = where;
    this.#$executor = executor;
  }

  toQuery() {
    const columnName = this.#$column.fullName;
    const query = new Query(
      `SELECT DISTINCT ${columnName} as value FROM `,
      this.handleRows.bind(this),
    );
    query.sql += this.#$table._.fullName;
    if (this.#$where) {
      query.sql += " WHERE ";
      query.sql += this.#$where.toSQL();
    }
    query.sql += ` ORDER BY ${columnName}`;
    return query;
  }

  async execute(): Promise<TReturn> {
    const query = this.toQuery();
    const res = await this.#$executor.execQuery(query);
    const rows = this.#$executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: { value: unknown }[]): TReturn {
    return rows.map((row) => {
      return this.#$column.fromDriver(row.value as never);
    }) as TReturn;
  }
}
