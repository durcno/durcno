import type { QueryExecutor } from "../connectors/common";
import type { Config } from "../index";
import type { AnyColumn, TableWithColumns } from "../table";
import { snakeToCamel } from "../utils";

import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class InsertBuilder<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
> {
  readonly #table: TTableWC;
  readonly #config: Config;
  readonly #executor: QueryExecutor;
  constructor(table: TTableWC, config: Config, executor: QueryExecutor) {
    this.#table = table;
    this.#config = config;
    this.#executor = executor;
  }
  values(
    values: {
      [colName in keyof TTableWC["_"]["columns"] as TTableWC["_"]["columns"][colName]["ValTypeInsert"] extends never
        ? never
        : undefined extends TTableWC["_"]["columns"][colName]["ValTypeInsert"]
          ? never
          : colName]: TTableWC["_"]["columns"][colName]["ValTypeInsert"];
    } & {
      [colName in keyof TTableWC["_"]["columns"] as TTableWC["_"]["columns"][colName]["ValTypeInsert"] extends never
        ? never
        : undefined extends TTableWC["_"]["columns"][colName]["ValTypeInsert"]
          ? colName
          : never]?: Exclude<
        TTableWC["_"]["columns"][colName]["ValTypeInsert"],
        undefined
      >;
    } extends infer TValues
      ?
          | {
              [colName in keyof TValues as TValues[colName] extends never
                ? never
                : colName]: TValues[colName];
            }
          | {
              [colName in keyof TValues as TValues[colName] extends never
                ? never
                : colName]: TValues[colName];
            }[]
      : never,
  ) {
    return new InsertQuery(
      this.#table,
      values,
      undefined,
      this.#config,
      this.#executor,
    );
  }
}

class InsertQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TReturning extends
    | {
        [ColName in keyof TTableWC["_"]["columns"]]?: true;
      }
    | {
        [ColName in keyof TTableWC["_"]["columns"]]?: false;
      }
    | undefined,
  TReturn = TReturning extends Record<Key, boolean>
    ? TReturning extends {
        [ColName in keyof TTableWC["_"]["columns"]]?: false;
      }
      ? {
          [ColName in keyof TTableWC["_"]["columns"] as TReturning[ColName] extends false
            ? never
            : ColName]: TTableWC["_"]["columns"][ColName]["ValTypeSelect"];
        }[]
      : {
          [ColName in keyof TTableWC["_"]["columns"] as TReturning[ColName] extends true
            ? ColName
            : never]: TTableWC["_"]["columns"][ColName]["ValTypeSelect"];
        }[]
    : null,
> extends QueryPromise<TReturn> {
  readonly #table: TTableWC;
  readonly #$values: Record<string, unknown> | Record<string, unknown>[];
  readonly #$returning: TReturning;
  readonly #config: Config;
  readonly #executor: QueryExecutor;

  constructor(
    table: TTableWC,
    values: Record<string, unknown> | Record<string, unknown>[],
    returnings: TReturning,
    config: Config,
    executor: QueryExecutor,
  ) {
    super();
    this.#table = table;
    this.#$values = values;
    this.#$returning = returnings;
    this.#config = config;
    this.#executor = executor;
  }

  returning<
    TReturnings extends
      | {
          [ColName in keyof TTableWC["_"]["columns"]]?: true;
        }
      | {
          [ColName in keyof TTableWC["_"]["columns"]]?: false;
        },
  >(returnings: TReturnings) {
    return new InsertQuery(
      this.#table,
      this.#$values,
      returnings,
      this.#config,
      this.#executor,
    );
  }

  toQuery() {
    const query = new Query("INSERT INTO ", this.handleRows.bind(this));
    query.sql += this.#table._.fullName;
    const valuesArray = Array.isArray(this.#$values)
      ? this.#$values
      : [this.#$values];

    // Get all unique fields from all rows
    const allFields = new Set<string>();
    for (const row of valuesArray) {
      for (const field of Object.keys(row)) {
        allFields.add(field);
      }
    }

    // Add default fields that are missing from all rows
    for (const col in this.#table._.columns) {
      const column = this.#table._.columns[col];
      if (!allFields.has(col) && column.hasInsertFn) {
        allFields.add(column.name);
      }
    }

    const fields = Array.from(allFields);
    query.sql += " ( ";
    query.sql += fields
      .map((field) => `"${this.#table._.columns[field].nameSnake}"`)
      .join(", ");
    query.sql += " ) VALUES";

    // Build values array and placeholders for all rows
    const rowPlaceholders: string[] = [];

    for (let rowIndex = 0; rowIndex < valuesArray.length; rowIndex++) {
      const row = valuesArray[rowIndex];
      const rowValues: string[] = [];

      for (const field of fields) {
        let value = row[field];

        // Handle missing values with defaults
        if (value === undefined) {
          const column = this.#table._.columns[field];
          if (column?.hasInsertFn) {
            value = column.getInsertFnVal();
          }
        }

        const driverValue = this.#table._.columns[field]?.toDriver(
          value as never,
        );
        query.arguments.push(driverValue);
        rowValues.push(`$${query.arguments.length}`);
      }

      rowPlaceholders.push(`(${rowValues.join(", ")})`);
    }

    query.sql += rowPlaceholders.join(",\n  ");
    if (this.#$returning) {
      query.sql += " RETURNING ";
      const returningFields = Object.keys(this.#$returning).filter(
        (k) => this.#$returning?.[k] === true,
      );
      query.sql += returningFields
        .map((field) => `"${this.#table._.columns[field].nameSnake}"`)
        .join(", ");
    }
    query.sql += ";";
    return query;
  }

  async execute(): Promise<TReturn> {
    const query = this.toQuery();
    const res = await this.#executor.query(query.sql, query.arguments);
    const rows = this.#executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: Record<string, unknown>[]) {
    const { columns } = this.#table._;
    rows.forEach((row) => {
      for (const [key, value] of Object.entries(row)) {
        const keyCamel = snakeToCamel(key);
        const column = columns[keyCamel] as AnyColumn;
        row[keyCamel] = column.fromDriver(value);
        if (keyCamel !== key) delete row[key];
      }
    });
    return rows as TReturn;
  }
}
