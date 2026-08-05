import type { QueryExecutor } from "../connectors/common";
import type { AnyCteWithColumns } from "../cte";
import { is, isCol } from "../entity";
import type { FilterExpression } from "../filters/index";
import { Sql } from "../sql";
import {
  type AnyColumn,
  Table,
  type TableAnyColumn,
  type TableColumn,
  type TableWithColumns,
} from "../table";
import type { Key, Valueof } from "../types";
import type { ReturningColumns } from "../virtual-table";

import { buildWithClause, resolveReturningColumns } from "./helpers";
import { Arg } from "./pre";
import { type AnyQuery, Query } from "./query";
import { QueryPromise } from "./query-promise";

/** Internal state for a DO NOTHING or DO UPDATE SET conflict clause. */
type ConflictClause =
  | { action: "nothing"; columns: AnyColumn[] }
  | {
      action: "update";
      columns: AnyColumn[];
      setValues: Record<string, unknown>;
      where?: FilterExpression<any, any>;
    };

type ToExcludeColumn<T extends TableAnyColumn> =
  T extends TableColumn<string, string, infer CName, infer Column>
    ? TableColumn<"", "EXCLUDED", CName, Column>
    : never;

/** Builder returned by `InsertQuery#onConflict()`. */
export class ConflictBuilder<
  TTableWC extends TableWithColumns<string, string, Record<string, AnyColumn>>,
  TPrepare extends boolean,
  TReturning extends
    | { [ColName in keyof TTableWC["_"]["columns"]]?: true }
    | { [ColName in keyof TTableWC["_"]["columns"]]?: false }
    | "*"
    | undefined,
  THasColumns extends boolean,
> {
  readonly #table: TTableWC;
  readonly #factory: (
    conflict: ConflictClause,
  ) => InsertQuery<TTableWC, TPrepare, TReturning>;
  readonly #columns: AnyColumn[];

  constructor(
    table: TTableWC,
    factory: (
      conflict: ConflictClause,
    ) => InsertQuery<TTableWC, TPrepare, TReturning>,
    columns: AnyColumn[],
  ) {
    this.#table = table;
    this.#factory = factory;
    this.#columns = columns;
  }

  /** Adds `ON CONFLICT DO NOTHING` clause. */
  doNothing(): InsertQuery<TTableWC, TPrepare, TReturning> {
    return this.#factory({ action: "nothing", columns: this.#columns });
  }

  /** Adds `ON CONFLICT DO UPDATE SET` clause. */
  doUpdateSet(
    set: (ctx: {
      excluded: {
        [ColName in keyof TTableWC["_"]["columns"]]: ToExcludeColumn<
          TTableWC["_"]["columns"][ColName]
        >;
      };
    }) => {
      [ColName in keyof TTableWC["_"]["columns"] as TTableWC["_"]["columns"][ColName]["ValTypeUpdate"] extends never
        ? never
        : ColName]?:
        | Exclude<TTableWC["_"]["columns"][ColName]["ValTypeUpdate"], undefined>
        | Valueof<Omit<TTableWC["_"]["columns"], ColName>>
        | ToExcludeColumn<Valueof<TTableWC["_"]["columns"]>>;
    },
    where?: (ctx: {
      excluded: {
        [ColName in keyof TTableWC["_"]["columns"]]: ToExcludeColumn<
          TTableWC["_"]["columns"][ColName]
        >;
      };
    }) => FilterExpression<
      | TTableWC["_"]["columns"][keyof TTableWC["_"]["columns"]]
      | ToExcludeColumn<
          TTableWC["_"]["columns"][keyof TTableWC["_"]["columns"]]
        >,
      TPrepare
    >,
  ): THasColumns extends true
    ? InsertQuery<TTableWC, TPrepare, TReturning>
    : never {
    const excluded = this.#buildExcludedTable();
    const setValues = set({ excluded });
    return this.#factory({
      action: "update",
      columns: this.#columns,
      setValues: setValues as Record<string, unknown>,
      where: where ? where({ excluded }) : undefined,
    }) as THasColumns extends true
      ? InsertQuery<TTableWC, TPrepare, TReturning>
      : never;
  }

  /** Builds a `Table` instance for the PostgreSQL `EXCLUDED` pseudo-table. */
  #buildExcludedTable() {
    const clonedColumns: Record<string, AnyColumn> = {};
    for (const [colName, col] of Object.entries(this.#table._.columns)) {
      clonedColumns[colName] = col.clone();
    }
    const excludedTable = new Table("", "EXCLUDED", clonedColumns, {});
    return excludedTable._.columns as unknown as {
      [Col in keyof TTableWC["_"]["columns"]]: ToExcludeColumn<
        TTableWC["_"]["columns"][Col]
      >;
    };
  }
}

export class InsertBuilder<
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
  values(
    values: {
      [colName in keyof TTableWC["_"]["columns"] as TTableWC["_"]["columns"][colName]["ValTypeInsert"] extends never
        ? never
        : undefined extends TTableWC["_"]["columns"][colName]["ValTypeInsert"]
          ? never
          : colName]:
        | TTableWC["_"]["columns"][colName]["ValTypeInsert"]
        | Sql
        | (TPrepare extends true
            ? Arg<TTableWC["_"]["columns"][colName]["ValType"]>
            : never);
    } & {
      [colName in keyof TTableWC["_"]["columns"] as TTableWC["_"]["columns"][colName]["ValTypeInsert"] extends never
        ? never
        : undefined extends TTableWC["_"]["columns"][colName]["ValTypeInsert"]
          ? colName
          : never]?:
        | Exclude<TTableWC["_"]["columns"][colName]["ValTypeInsert"], undefined>
        | Sql
        | (TPrepare extends true
            ? Arg<TTableWC["_"]["columns"][colName]["ValType"]>
            : never);
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
      this.#$ctes,
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
  readonly #values: Record<string, unknown> | Record<string, unknown>[];
  readonly #$returning: TReturning;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;
  readonly #$ctes: readonly AnyCteWithColumns[] | null;
  readonly #$conflict: ConflictClause | undefined;

  constructor(
    table: TTableWC,
    values: Record<string, unknown> | Record<string, unknown>[],
    returnings: TReturning,
    executor: QueryExecutor,
    prepare: TPrepare,
    ctes: readonly AnyCteWithColumns[] | null = null,
    conflict?: ConflictClause,
  ) {
    super();
    this.#table = table;
    this.#values = values;
    this.#$returning = returnings;
    this.#executor = executor;
    this.#prepare = prepare;
    this.#$ctes = ctes;
    this.#$conflict = conflict;
  }

  /** Return all columns using `RETURNING *`. */
  returning(all: "*"): InsertQuery<TTableWC, TPrepare, "*">;
  /** Return a subset of columns. */
  returning<
    TReturnings extends
      | {
          [ColName in keyof TTableWC["_"]["columns"]]?: true;
        }
      | {
          [ColName in keyof TTableWC["_"]["columns"]]?: false;
        },
  >(returnings: TReturnings): InsertQuery<TTableWC, TPrepare, TReturnings>;
  returning(
    returnings: "*" | { [ColName in keyof TTableWC["_"]["columns"]]?: boolean },
  ) {
    return new InsertQuery(
      this.#table,
      this.#values,
      returnings as never,
      this.#executor,
      this.#prepare,
      this.#$ctes,
      this.#$conflict,
    );
  }

  /** Begins an `ON CONFLICT` clause with no target columns. */
  onConflict(): ConflictBuilder<TTableWC, TPrepare, TReturning, false>;
  /** Begins an `ON CONFLICT` clause with target columns. */
  onConflict(
    ...columns: [
      Valueof<TTableWC["_"]["columns"]>,
      ...Valueof<TTableWC["_"]["columns"]>[],
    ]
  ): ConflictBuilder<TTableWC, TPrepare, TReturning, true>;
  onConflict(
    ...columns: Valueof<TTableWC["_"]["columns"]>[]
  ): ConflictBuilder<TTableWC, TPrepare, TReturning, boolean> {
    const table = this.#table;
    // biome-ignore lint/suspicious/noExplicitAny: <>
    const factory = (clause: ConflictClause): any =>
      new InsertQuery(
        table,
        this.#values,
        this.#$returning,
        this.#executor,
        this.#prepare,
        this.#$ctes,
        clause,
      );
    return new ConflictBuilder(table, factory, columns) as ConflictBuilder<
      TTableWC,
      TPrepare,
      TReturning,
      boolean
    >;
  }

  toQuery(parentQuery?: AnyQuery): Query<TReturn> {
    const isRoot = parentQuery === undefined;
    const query: Query<TReturn> = parentQuery
      ? (parentQuery as unknown as Query<TReturn>)
      : new Query<TReturn>("", this.handleRows.bind(this));
    if (isRoot && this.#$ctes?.length) {
      buildWithClause(this.#$ctes, query);
    }
    query.sql += "INSERT INTO ";
    query.sql += this.#table._.fullName;
    const valuesArray = Array.isArray(this.#values)
      ? this.#values
      : [this.#values];

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
        } else if (value instanceof Sql) {
          query.sql += value.string;
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

    if (this.#$conflict) {
      const { action, columns } = this.#$conflict;

      query.sql += " ON CONFLICT";

      if (columns.length > 0) {
        query.sql += " (";
        query.sql += columns.map((col) => `"${col.nameSql}"`).join(", ");
        query.sql += ")";
      }

      if (action === "nothing") {
        query.sql += " DO NOTHING";
      } else {
        query.sql += " DO UPDATE SET ";
        const setEntries = Object.entries(this.#$conflict.setValues);
        setEntries.forEach(([fieldName, value], idx) => {
          const col = this.#table._.columns[fieldName];
          query.sql += `"${col.nameSql}" = `;
          if (isCol(value)) {
            value.toQuery(query);
          } else {
            query.sql += col.toSQL(value, { cast: true });
          }
          if (idx < setEntries.length - 1) {
            query.sql += ", ";
          }
        });
        if (this.#$conflict.where) {
          query.sql += " WHERE ";
          this.#$conflict.where.toQuery(query);
        }
      }
    }

    if (this.#$returning === "*") {
      query.sql += " RETURNING *";
    } else if (this.#$returning) {
      query.sql += " RETURNING ";
      const returningFields = Object.keys(this.#$returning).filter(
        (k) => (this.#$returning as Record<string, boolean>)?.[k] === true,
      );
      query.sql += returningFields
        .map((field) => `"${this.#table._.columns[field].nameSql}"`)
        .join(", ");
    }

    return query;
  }

  async execute(): Promise<TReturn> {
    const query = this.toQuery();
    query.sql += ";";
    const res = await this.#executor.execQuery(query);
    const rows = this.#executor.getRows(res);
    return this.handleRows(rows);
  }

  /** Returns the table's columns (used when this INSERT has a RETURNING clause). */
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
