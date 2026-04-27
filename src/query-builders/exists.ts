import type { QueryExecutor } from "../connectors/common";
import type { BuildFilterExpression } from "../filters/index";
import type { AnyColumn, TableWithColumns, TColsToLeftRight } from "../table";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class ExistsQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TPrepare extends boolean = false,
> extends QueryPromise<boolean> {
  readonly #$table: TTableWC;
  readonly #$where:
    | BuildFilterExpression<
        TColsToLeftRight<TTableWC["_"]["columns"]>,
        TPrepare
      >
    | undefined;
  readonly #$executor: QueryExecutor;
  readonly #$prepare: TPrepare;

  constructor(
    table: TTableWC,
    where:
      | BuildFilterExpression<
          TColsToLeftRight<TTableWC["_"]["columns"]>,
          TPrepare
        >
      | undefined,
    executor: QueryExecutor,
    prepare: TPrepare = false as TPrepare,
  ) {
    super();
    this.#$table = table;
    this.#$where = where;
    this.#$executor = executor;
    this.#$prepare = prepare;
  }

  toQuery() {
    const query = new Query(
      "SELECT EXISTS(SELECT 1 FROM ",
      this.handleRows.bind(this),
    );
    query.sql += this.#$table._.fullName;
    if (this.#$where) {
      query.sql += " WHERE ";
      this.#$where.toQuery(query);
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
