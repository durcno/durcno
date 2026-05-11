import type { QueryExecutor } from "../connectors/common";
import type { FilterExpression } from "../filters/index";
import type { AnyColumn, TableWithColumns } from "../table";
import type { Valueof } from "../types";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class CountQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TPrepare extends boolean = false,
> extends QueryPromise<number> {
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
    const query = new Query(
      "SELECT count(*) FROM ",
      this.handleRows.bind(this),
    );
    query.sql += this.#$table._.fullName;
    if (this.#$where) {
      query.sql += " WHERE ";
      this.#$where.toQuery(query);
    }
    return query;
  }

  async execute(): Promise<number> {
    const query = this.toQuery();
    const res = await this.#$executor.execQuery(query);
    const rows = this.#$executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: { count: string }[]): number {
    return Number(rows[0].count);
  }
}
