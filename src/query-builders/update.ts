import type { QueryExecutor } from "../connectors/common";
import type { AnyCteWithColumns } from "../cte";
import { is } from "../entity";
import type { FilterExpression } from "../filters/index";
import { Sql } from "../sql";
import type { AnyColumn, TableWithColumns } from "../table";
import type { Key } from "../types";
import type { ReturningColumns } from "../virtual-table";
import {
  buildReturningClause,
  buildWithClause,
  resolveReturningColumns,
} from "./helpers";
import { Arg } from "./pre";
import { type AnyQuery, Query } from "./query";
import { QueryPromise } from "./query-promise";

export class UpdateBuilder<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TPrepare extends boolean,
> {
  readonly #table: TTableWC;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;
  readonly #$ctes: readonly AnyCteWithColumns[] | null;
  constructor(
    table: TTableWC,
    executor: QueryExecutor,
    prepare: TPrepare,
    ctes: readonly AnyCteWithColumns[] | null = null,
  ) {
    this.#table = table;
    this.#executor = executor;
    this.#prepare = prepare;
    this.#$ctes = ctes;
  }

  set<
    TValues extends {
      [ColName in keyof TTableWC["_"]["columns"] as TTableWC["_"]["columns"][ColName]["ValTypeUpdate"] extends never
        ? never
        : ColName]?:
        | Exclude<TTableWC["_"]["columns"][ColName]["ValTypeUpdate"], undefined>
        | Sql
        | (TPrepare extends true
            ? Arg<TTableWC["_"]["columns"][ColName]["ValType"]>
            : never);
    },
  >(values: TValues) {
    return new UpdateQuery(
      this.#table,
      values,
      undefined,
      undefined,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    );
  }
}

export class UpdateQuery<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TPrepare extends boolean,
  TValues extends {
    [ColName in keyof TTableWC["_"]["columns"] as TTableWC["_"]["columns"][ColName]["ValTypeUpdate"] extends never
      ? never
      : ColName]?:
      | Exclude<TTableWC["_"]["columns"][ColName]["ValTypeUpdate"], undefined>
      | Sql
      | (TPrepare extends true
          ? Arg<TTableWC["_"]["columns"][ColName]["ValType"]>
          : never);
  },
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
  readonly #table: TTableWC;
  readonly #values: TValues;
  readonly #$where: TWhere;
  readonly #$returning: TReturning;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;
  readonly #$ctes: readonly AnyCteWithColumns[] | null;

  constructor(
    table: TTableWC,
    values: TValues,
    where: TWhere,
    returnings: TReturning,
    executor: QueryExecutor,
    prepare: TPrepare,
    ctes: readonly AnyCteWithColumns[] | null = null,
  ) {
    super();
    this.#table = table;
    this.#values = values;
    this.#$where = where;
    this.#$returning = returnings;
    this.#executor = executor;
    this.#prepare = prepare;
    this.#$ctes = ctes;
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
      this.#$ctes,
    );
  }

  /** Return all columns using `RETURNING *`. */
  returning(all: "*"): UpdateQuery<TTableWC, TPrepare, TValues, TWhere, "*">;
  /** Return a subset of columns. */
  returning<
    TReturnings extends
      | {
          [ColName in keyof TTableWC["_"]["columns"]]?: true;
        }
      | {
          [ColName in keyof TTableWC["_"]["columns"]]?: false;
        },
  >(
    returnings: TReturnings,
  ): UpdateQuery<TTableWC, TPrepare, TValues, TWhere, TReturnings>;
  returning(
    returnings: "*" | { [ColName in keyof TTableWC["_"]["columns"]]?: boolean },
  ) {
    return new UpdateQuery(
      this.#table,
      this.#values,
      this.#$where,
      returnings as never,
      this.#executor,
      this.#prepare,
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
    query.sql += "UPDATE ";
    query.sql += this.#table._.fullName;

    query.sql += " SET ";

    // Collect fields from set values
    const explicitFields = new Set<string>(Object.keys(this.#values));

    // Build the combined values map with updateFn values
    const allFields: string[] = [];
    const allValues: unknown[] = [];

    // First, add explicit values
    for (const field of explicitFields) {
      allFields.push(field);
      allValues.push((this.#values as Record<string, unknown>)[field]);
    }

    // Then, add updateFn values for columns not explicitly provided
    for (const colName in this.#table._.columns) {
      const column = this.#table._.columns[colName];
      if (!explicitFields.has(colName) && column.hasUpdateFn) {
        allFields.push(colName);
        allValues.push(column.getUpdateFnVal);
      }
    }

    allFields.forEach((field, index) => {
      const column = this.#table._.columns[field];
      const value = allValues[index];

      query.sql += `"${column.nameSql}" = `;
      if (value instanceof Sql) {
        query.sql += value.string;
      } else if (is(value, Arg)) {
        const cast = value.cast ?? column.sqlCast ?? null;
        const castSuffix = cast ? `::${cast}` : "";
        query.sql += `$${value.index}${castSuffix}`;
        query.arguments.push(value.key);
      } else {
        query.sql += column.toSQL(value, { cast: true });
      }

      if (index !== allFields.length - 1) {
        query.sql += ", ";
      }
    });

    if (this.#$where) {
      query.sql += ` WHERE `;
      this.#$where.toQuery(query);
    }
    buildReturningClause(
      this.#table._.columns,
      this.#$returning as "*" | Record<string, boolean> | undefined,
      query,
    );
    return query;
  }

  async execute(): Promise<TReturn> {
    const query = this.toQuery();
    query.sql += ";";
    const res = await this.#executor.execQuery(query);
    const rows = this.#executor.getRows(res);
    return this.handleRows(rows);
  }

  /** Returns the table's columns (used when this UPDATE has a RETURNING clause). */
  getResolvedColumns(): ReturningColumns<TTableWC["_"]["columns"], TReturning> {
    return resolveReturningColumns(this.#table._.columns, this.#$returning);
  }

  handleRows(rows: Record<string, unknown>[]) {
    const newRows: Record<string, unknown>[] = [];
    rows.forEach((row) => {
      const newRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        const column = this.#table._.columnsBySql[key];
        newRow[column.name] = column.fromDriver(value);
      }
      newRows.push(newRow);
    });
    return newRows as TReturn;
  }
}
