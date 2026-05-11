import type { QueryExecutor } from "../connectors/common";
import type { FilterExpression } from "../filters/index";
import type { AnyColumn, TableWithColumns } from "../table";
import type { Valueof } from "../types";
import { snakeToCamel } from "../utils";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class FirstQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TPrepare extends boolean = false,
  TReturn =
    | {
        [ColName in keyof TTableWC["_"]["columns"]]: TTableWC["_"]["columns"][ColName]["ValTypeSelect"];
      }
    | null,
> extends QueryPromise<TReturn> {
  readonly #$table: TTableWC;
  readonly #$where:
    | FilterExpression<Valueof<TTableWC["_"]["columns"]>, TPrepare>
    | undefined;
  readonly #$executor: QueryExecutor;
  readonly #$prepare: TPrepare;

  constructor(
    table: TTableWC,
    where:
      | FilterExpression<Valueof<TTableWC["_"]["columns"]>, TPrepare>
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
    const query = new Query("SELECT * FROM ", this.handleRows.bind(this));
    query.sql += this.#$table._.fullName;
    if (this.#$where) {
      query.sql += " WHERE ";
      this.#$where.toQuery(query);
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
    if (rows.length === 0) return null as TReturn;

    const row = rows[0];
    const newRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const keyCamel = snakeToCamel(key);
      const column = this.#$table._.columns[keyCamel] as AnyColumn;
      newRow[keyCamel] = column.fromDriver(value);
    }
    return newRow as TReturn;
  }
}
