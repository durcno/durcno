import type { QueryExecutor } from "../connectors/common";
import type { AnyCteWithColumns } from "../cte";
import type { FilterExpression } from "../filters/index";
import type { AnyColumn, TableWithColumns } from "../table";
import type { Key, Valueof } from "../types";
import type { ReturningColumns } from "../virtual-table";
import {
  buildReturningClause,
  buildWithClause,
  resolveReturningColumns,
} from "./helpers";
import { type AnyQuery, Query } from "./query";
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
    | "*"
    | undefined,
  TReturn = TReturning extends "*"
    ? {
        [ColName in keyof TTableWC["_"]["columns"]]: TTableWC["_"]["columns"][ColName]["ValTypeSelect"];
      }[]
    : TReturning extends Record<Key, boolean>
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
    | FilterExpression<Valueof<TTableWC["_"]["columns"]>, TPrepare>
    | undefined;
  readonly #$returning: TReturning;
  readonly #$executor: QueryExecutor;
  readonly #$prepare: TPrepare;
  readonly #$ctes: readonly AnyCteWithColumns[] | null;

  constructor(
    table: TTableWC,
    where:
      | FilterExpression<Valueof<TTableWC["_"]["columns"]>, TPrepare>
      | undefined,
    returnings: TReturning,
    executor: QueryExecutor,
    prepare: TPrepare,
    ctes: readonly AnyCteWithColumns[] | null = null,
  ) {
    super();
    this.#$table = table;
    this.#$where = where;
    this.#$returning = returnings;
    this.#$executor = executor;
    this.#$prepare = prepare;
    this.#$ctes = ctes;
  }

  where<
    TWhere extends FilterExpression<
      Valueof<TTableWC["_"]["columns"]>,
      TPrepare
    >,
  >(where: TWhere) {
    return new DeleteQuery(
      this.#$table,
      where,
      this.#$returning,
      this.#$executor,
      this.#$prepare,
      this.#$ctes,
    );
  }

  /** Return all columns using `RETURNING *`. */
  returning(all: "*"): DeleteQuery<TTableWC, TPrepare, "*">;
  /** Return a subset of columns. */
  returning<
    TReturnings extends
      | {
          [ColName in keyof TTableWC["_"]["columns"]]?: true;
        }
      | {
          [ColName in keyof TTableWC["_"]["columns"]]?: false;
        },
  >(returnings: TReturnings): DeleteQuery<TTableWC, TPrepare, TReturnings>;
  returning<
    TReturnings extends
      | "*"
      | {
          [ColName in keyof TTableWC["_"]["columns"]]?: true;
        }
      | {
          [ColName in keyof TTableWC["_"]["columns"]]?: false;
        },
  >(returnings: TReturnings): DeleteQuery<TTableWC, TPrepare, TReturnings> {
    return new DeleteQuery(
      this.#$table,
      this.#$where,
      returnings,
      this.#$executor,
      this.#$prepare,
      this.#$ctes,
    );
  }

  toQuery(parentQuery?: AnyQuery): Query<TReturn> {
    const isRoot = parentQuery === undefined;
    const query: Query<TReturn> = parentQuery
      ? (parentQuery as unknown as Query<TReturn>)
      : new Query<TReturn>("", this.handleRows.bind(this));
    if (isRoot && this.#$ctes?.length) {
      buildWithClause(this.#$ctes, query);
    }
    query.sql += "DELETE FROM ";
    query.sql += this.#$table._.fullName;
    if (this.#$where) {
      query.sql += " WHERE ";
      this.#$where.toQuery(query);
    }
    buildReturningClause(
      this.#$table._.columns,
      this.#$returning as "*" | Record<string, boolean> | undefined,
      query,
    );
    return query;
  }

  async execute(): Promise<TReturn> {
    const query = this.toQuery();
    query.sql += ";";
    const res = await this.#$executor.execQuery(query);
    const rows = this.#$executor.getRows(res);
    return this.handleRows(rows);
  }

  /** Returns the table's columns (used when this DELETE has a RETURNING clause). */
  getResolvedColumns(): ReturningColumns<TTableWC["_"]["columns"], TReturning> {
    return resolveReturningColumns(this.#$table._.columns, this.#$returning);
  }

  handleRows(rows: Record<string, unknown>[]) {
    const newRows: Record<string, unknown>[] = [];
    rows.forEach((row) => {
      const newRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        const column = this.#$table._.columnsBySql[key];
        newRow[column.name] = column.fromDriver(value);
      }
      newRows.push(newRow);
    });
    return newRows as TReturn;
  }
}
