import type { QueryExecutor } from "../connectors/common";
import type { AnyColumn, TableWithColumns } from "../table";
import { snakeToCamel } from "../utils";
import { InsertQuery } from "./insert";
import type { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class InsertReturningQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TReturn = {
    [ColName in keyof TTableWC["_"]["columns"]]: TTableWC["_"]["columns"][ColName]["ValTypeSelect"];
  },
> extends QueryPromise<TReturn> {
  readonly #$table: TTableWC;
  readonly #$values: Record<string, unknown>;
  readonly #$executor: QueryExecutor;

  constructor(
    table: TTableWC,
    values: Record<string, unknown>,
    executor: QueryExecutor,
  ) {
    super();
    this.#$table = table;
    this.#$values = values;
    this.#$executor = executor;
  }

  toQuery() {
    // Build an all-columns-true returning object to replicate RETURNING * behaviour
    const returningAll = Object.fromEntries(
      Object.keys(this.#$table._.columns).map((k) => [k, true as const]),
    );

    const insertQuery = new InsertQuery(
      this.#$table,
      this.#$values,
      returningAll as Record<string, true>,
      this.#$executor,
      false,
    );

    const query = insertQuery.toQuery();
    // biome-ignore lint/suspicious/noExplicitAny: rowsHandler cast needed due to never inference from returningAll as never
    (query as any).rowsHandler = this.handleRows.bind(this);
    return query as Query<TReturn>;
  }

  async execute(): Promise<TReturn> {
    const query = this.toQuery();
    const res = await this.#$executor.execQuery(query);
    const rows = this.#$executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: Record<string, unknown>[]) {
    const row = rows[0];
    const newRow: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const keyCamel = snakeToCamel(key);
      const column = this.#$table._.columns[keyCamel];
      newRow[keyCamel] = column.fromDriver(value);
    }
    return newRow as TReturn;
  }
}
