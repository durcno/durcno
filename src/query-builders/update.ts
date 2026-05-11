import type { QueryExecutor } from "../connectors/common";
import type { FilterExpression } from "../filters/index";
import type { AnyColumn, TableWithColumns } from "../table";
import type { Key } from "../types";
import { snakeToCamel } from "../utils";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class UpdateBuilder<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TPrepare extends boolean,
> {
  readonly #table: TTableWC;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;
  constructor(table: TTableWC, executor: QueryExecutor, prepare: TPrepare) {
    this.#table = table;
    this.#executor = executor;
    this.#prepare = prepare;
  }

  set<
    TValues extends {
      [colName in keyof TTableWC["_"]["columns"]]?: TTableWC["_"]["columns"][colName]["ValTypeUpdate"];
    },
  >(values: TValues) {
    return new UpdateQuery(
      this.#table,
      values,
      undefined,
      undefined,
      this.#executor,
      this.#prepare,
    );
  }
}

class UpdateQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TValues extends {
    [colName in keyof TTableWC["_"]["columns"]]?: TTableWC["_"]["columns"][colName]["ValTypeUpdate"];
  },
  TPrepare extends boolean,
  TWhere extends
    | FilterExpression<
        TTableWC["_"]["columns"][keyof TTableWC["_"]["columns"]],
        TPrepare
      >
    | undefined,
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
  readonly #values: TValues;
  readonly #$where: TWhere;
  readonly #$returning: TReturning;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;

  constructor(
    table: TTableWC,
    values: TValues,
    where: TWhere,
    returnings: TReturning,
    executor: QueryExecutor,
    prepare: TPrepare,
  ) {
    super();
    this.#table = table;
    this.#values = values;
    this.#$where = where;
    this.#$returning = returnings;
    this.#executor = executor;
    this.#prepare = prepare;
  }

  where<
    TWhere extends FilterExpression<
      TTableWC["_"]["columns"][keyof TTableWC["_"]["columns"]],
      TPrepare
    >,
  >(where: TWhere) {
    return new UpdateQuery(
      this.#table,
      this.#values,
      where,
      this.#$returning,
      this.#executor,
      this.#prepare,
    );
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
    return new UpdateQuery(
      this.#table,
      this.#values,
      this.#$where,
      returnings,
      this.#executor,
      this.#prepare,
    );
  }

  toQuery(): Query<TReturn> {
    const query = new Query<TReturn>("UPDATE ", this.handleRows.bind(this));
    query.sql += this.#table._.fullName;

    query.sql += " SET ";

    // Collect fields from explicit values
    const explicitFields = new Set(Object.keys(this.#values));

    // Build the combined values map with updateFn values
    const allFields: string[] = [];
    const allValues: unknown[] = [];

    // First, add explicit values
    for (const field of explicitFields) {
      allFields.push(field);
      allValues.push(this.#values[field]);
    }

    // Then, add updateFn values for columns not explicitly provided
    for (const colName in this.#table._.columns) {
      const column = this.#table._.columns[colName];
      if (!explicitFields.has(colName) && column.hasUpdateFn) {
        allFields.push(colName);
        allValues.push(column.getUpdateFnVal);
      }
    }

    query.sql += allFields
      .map(
        (field, index) =>
          `"${this.#table._.columns[field].nameSnake}" = ${this.#table._.columns[field].toSQL(allValues[index], { cast: true })}`,
      )
      .join(", ");

    if (this.#$where) {
      query.sql += ` WHERE `;
      this.#$where.toQuery(query);
    }
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
    const res = await this.#executor.execQuery(query);
    const rows = this.#executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: Record<string, unknown>[]) {
    const newRows: Record<string, unknown>[] = [];
    rows.forEach((row) => {
      const newRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        const keyCamel = snakeToCamel(key);
        const column = this.#table._.columns[keyCamel];
        newRow[keyCamel] = column.fromDriver(value);
      }
      newRows.push(newRow);
    });
    return newRows as TReturn;
  }
}
