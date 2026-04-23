import type { QueryExecutor } from "../connectors/common";
import type { Config } from "../index";
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
  readonly #$config: Config;
  readonly #$executor: QueryExecutor;

  constructor(
    table: TTableWC,
    values: Record<string, unknown>,
    config: Config,
    executor: QueryExecutor,
  ) {
    super();
    this.#$table = table;
    this.#$values = values;
    this.#$config = config;
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
      returningAll as never,
      this.#$config,
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
    const res = await this.#$executor.query(query.sql, query.arguments);
    const rows = this.#$executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: Record<string, unknown>[]): TReturn {
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
