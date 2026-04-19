import type { QueryExecutor } from "../connectors/common";
import type { BuildFilterExpression } from "../filters/index";
import type { Config } from "../index";
import type { AnyColumn, TableWithColumns, TColsToLeftRight } from "../table";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class CountQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
> extends QueryPromise<number> {
  readonly #$table: TTableWC;
  readonly #$where:
    | BuildFilterExpression<TColsToLeftRight<TTableWC["_"]["columns"]>>
    | undefined;
  readonly #$config: Config;
  readonly #$executor: QueryExecutor;

  constructor(
    table: TTableWC,
    where:
      | BuildFilterExpression<TColsToLeftRight<TTableWC["_"]["columns"]>>
      | undefined,
    config: Config,
    executor: QueryExecutor,
  ) {
    super();
    this.#$table = table;
    this.#$where = where;
    this.#$config = config;
    this.#$executor = executor;
  }

  toQuery() {
    const query = new Query(
      "SELECT count(*) FROM ",
      this.handleRows.bind(this),
    );
    query.sql += this.#$table._.fullName;
    if (this.#$where) {
      query.sql += " WHERE ";
      query.sql += this.#$where.toSQL();
    }
    return query;
  }

  async execute(): Promise<number> {
    const query = this.toQuery();
    const res = await this.#$executor.query(query.sql, query.arguments);
    const rows = this.#$executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: { count: string }[]): number {
    return Number(rows[0].count);
  }
}
