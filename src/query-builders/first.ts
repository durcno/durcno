import type { QueryExecutor } from "../connectors/common";
import type { BuildFilterExpression } from "../filters/index";
import type { Config } from "../index";
import type { AnyColumn, TableWithColumns, TColsToLeftRight } from "../table";
import { snakeToCamel } from "../utils";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class FirstQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TReturn =
    | {
        [ColName in keyof TTableWC["_"]["columns"]]: TTableWC["_"]["columns"][ColName]["ValTypeSelect"];
      }
    | null,
> extends QueryPromise<TReturn> {
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
    const query = new Query("SELECT * FROM ", this.handleRows.bind(this));
    query.sql += this.#$table._.fullName;
    if (this.#$where) {
      query.sql += " WHERE ";
      query.sql += this.#$where.toSQL();
    }
    query.sql += " LIMIT 1";
    return query;
  }

  async execute(): Promise<TReturn> {
    const query = this.toQuery();
    const res = await this.#$executor.execQuery(query);
    const rows = this.#$executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: Record<string, unknown>[]): TReturn {
    if (rows.length === 0) {
      return null as TReturn;
    }
    const row = rows[0];
    const { columns } = this.#$table._;
    for (const [key, value] of Object.entries(row)) {
      const keyCamel = snakeToCamel(key);
      const column = columns[keyCamel] as AnyColumn;
      row[keyCamel] = column.fromDriver(value as never);
      if (keyCamel !== key) delete row[key];
    }
    return row as TReturn;
  }
}
