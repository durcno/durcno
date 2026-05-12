import type { QueryExecutor } from "../connectors/common";
import { is } from "../entity";
import type { AnyColumn, TableWithColumns } from "../table";
import type { Key } from "../types";
import { snakeToCamel } from "../utils";

import { Arg } from "./pre";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class InsertBuilder<
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
              [colName in keyof TValues]: TValues[colName];
            }
          | {
              [colName in keyof TValues]: TValues[colName];
            }[]
      : never,
  ) {
    return new InsertQuery(
      this.#table,
      values,
      undefined,
      this.#executor,
      this.#prepare,
    );
  }
}

export class InsertQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TPrepare extends boolean,
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
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;

  constructor(
    table: TTableWC,
    values: Record<string, unknown> | Record<string, unknown>[],
    returnings: TReturning,
    executor: QueryExecutor,
    prepare: TPrepare,
  ) {
    super();
    this.#table = table;
    this.#$values = values;
    this.#$returning = returnings;
    this.#executor = executor;
    this.#prepare = prepare;
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
      this.#executor,
      this.#prepare,
    );
  }

  toQuery() {
    const query = new Query("INSERT INTO ", this.handleRows.bind(this));
    query.sql += this.#table._.fullName;
    const valuesArray = Array.isArray(this.#$values)
      ? this.#$values
      : [this.#$values];

    const fields = Object.keys(this.#table._.columns);
    query.sql += " ( ";
    query.sql += fields
      .map((field) => `"${this.#table._.columns[field].nameSql}"`)
      .join(", ");
    query.sql += " ) VALUES";

    valuesArray.forEach((row, i) => {
      query.sql += " (";
      fields.forEach((fieldName, j) => {
        const value = row[fieldName];
        const column = this.#table._.columns[fieldName];
        if (value === undefined) {
          if (column.hasInsertFn) {
            query.sql += column.toSQL(column.getInsertFnVal, { cast: true });
          } else {
            query.sql += "DEFAULT";
          }
        } else if (is(value, Arg)) {
          const cast = value.cast ?? column.sqlCast ?? null;
          const castSuffix = cast ? `::${cast}` : "";
          query.sql += `$${value.index}${castSuffix}`;
          query.arguments.push(value.key);
        } else {
          query.sql += column.toSQL(value, { cast: true });
        }
        if (j !== fields.length - 1) {
          query.sql += ", ";
        }
      });
      query.sql += ")";
      if (i !== valuesArray.length - 1) {
        query.sql += ",\n";
      }
    });

    if (this.#$returning) {
      query.sql += " RETURNING ";
      const returningFields = Object.keys(this.#$returning).filter(
        (k) => this.#$returning?.[k] === true,
      );
      query.sql += returningFields
        .map((field) => `"${this.#table._.columns[field].nameSql}"`)
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
