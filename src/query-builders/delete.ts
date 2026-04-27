import type { QueryExecutor } from "../connectors/common";
import type { BuildFilterExpression } from "../filters/index";
import type { AnyColumn, TableWithColumns, TColsToLeftRight } from "../table";
import type { Key } from "../types";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class DeleteQuery<
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
  readonly #$table: TTableWC;
  readonly #$where:
    | BuildFilterExpression<
        TColsToLeftRight<TTableWC["_"]["columns"]>,
        TPrepare
      >
    | undefined;
  readonly #$returning: TReturning;
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
    returnings: TReturning,
    executor: QueryExecutor,
    prepare: TPrepare,
  ) {
    super();
    this.#$table = table;
    this.#$where = where;
    this.#$returning = returnings;
    this.#$executor = executor;
    this.#$prepare = prepare;
  }

  where<
    TWhere extends BuildFilterExpression<
      TColsToLeftRight<TTableWC["_"]["columns"]>,
      TPrepare
    >,
  >(where: TWhere) {
    return new DeleteQuery(
      this.#$table,
      where,
      this.#$returning,
      this.#$executor,
      this.#$prepare,
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
    return new DeleteQuery(
      this.#$table,
      this.#$where,
      returnings,
      this.#$executor,
      this.#$prepare,
    );
  }

  toQuery() {
    const query = new Query("DELETE FROM ", this.handleRows.bind(this));
    query.sql += this.#$table._.fullName;
    if (this.#$where) {
      query.sql += " WHERE ";
      this.#$where.toQuery(query);
    }
    if (this.#$returning) {
      query.sql += " RETURNING ";
      const returningFields = Object.keys(this.#$returning).filter(
        (k) => this.#$returning?.[k] === true,
      );
      query.sql += returningFields
        .map((field) => `"${this.#$table._.columns[field].nameSnake}"`)
        .join(", ");
    }
    query.sql += ";";
    return query;
  }

  async execute(): Promise<TReturn> {
    const query = this.toQuery();
    const res = await this.#$executor.execQuery(query);
    const rows = this.#$executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: Record<string, unknown>[]) {
    const { columns } = this.#$table._;
    rows.forEach((row) => {
      for (const [key, value] of Object.entries(row)) {
        const column = columns[key] as AnyColumn;
        row[key] = column.fromDriver(value);
      }
    });
    return rows as TReturn;
  }
}
