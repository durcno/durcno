import type { QueryExecutor } from "../connectors/common";
import type { Config } from "../index";
import type { AnyColumn, TableWithColumns } from "../table";
import { snakeToCamel } from "../utils";

import { Query } from "./query";
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
    const query = new Query("INSERT INTO ", this.handleRows.bind(this));
    query.sql += this.#$table._.fullName;

    // Get fields from values and add default insertFn fields
    const allFields = new Set<string>();
    for (const field of Object.keys(this.#$values)) {
      allFields.add(field);
    }

    // Add default fields that are missing
    for (const col in this.#$table._.columns) {
      const column = this.#$table._.columns[col];
      if (!allFields.has(col) && column.hasInsertFn) {
        allFields.add(column.name);
      }
    }

    const fields = Array.from(allFields);
    query.sql += " ( ";
    query.sql += fields
      .map((field) => `"${this.#$table._.columns[field].nameSnake}"`)
      .join(", ");
    query.sql += " ) VALUES ( ";

    const rowValues: string[] = [];
    for (const field of fields) {
      let value = this.#$values[field];

      // Handle missing values with defaults
      if (value === undefined) {
        const column = this.#$table._.columns[field];
        if (column?.hasInsertFn) {
          value = column.getInsertFnVal();
        }
      }

      const driverValue = this.#$table._.columns[field]?.toDriver(
        value as never,
      );
      query.arguments.push(driverValue);
      rowValues.push(`$${query.arguments.length}`);
    }

    query.sql += rowValues.join(", ");
    query.sql += " ) RETURNING *;";
    return query;
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
