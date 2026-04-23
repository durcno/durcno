import type { QueryExecutor } from "../connectors/common";
import type { BuildFilterExpression } from "../filters/index";
import type { Config } from "../index";
import type { AnyColumn, TableWithColumns, TColsToLeftRight } from "../table";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class ExistsQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
> extends QueryPromise<boolean> {
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
      "SELECT EXISTS(SELECT 1 FROM ",
      this.handleRows.bind(this),
    );
    query.sql += this.#$table._.fullName;
    if (this.#$where) {
      query.sql += " WHERE ";
      query.sql += this.#$where.toSQL();
    }
    query.sql += ")";
    return query;
  }

  async execute(): Promise<boolean> {
    const query = this.toQuery();
    const res = await this.#$executor.execQuery(query);
    const rows = this.#$executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: { exists: boolean }[]): boolean {
    return rows[0].exists;
  }
}
