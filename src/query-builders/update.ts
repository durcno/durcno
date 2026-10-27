import type { QueryExecutor } from "../connectors/common";
import type { AnyCteWithColumns } from "../cte";
import { is, isCol } from "../entity";
import type { FilterExpression } from "../filters/index";
import { type NonAggregateSqlFn, SqlFn } from "../functions/index";
import { Sql } from "../sql";
import type {
  AnyColumn,
  AnyTableWithColumns,
  StdTableColumn,
  StdTableWithColumns,
} from "../table";
import type { Key, RawRow } from "../types";
import type { AnyValuesWithColumns } from "../values";
import {
  buildReturningClause,
  buildUpdateFromClause,
  buildWithClause,
  generatedValueSQL,
  mapStarRows,
  type ReturningColumns,
  resolveReturningColumns,
} from "./helpers";
import { Arg } from "./prepare";
import { type AnyQuery, Query } from "./query";
import { QueryPromise } from "./query-promise";

/**
 * Source accepted by `UpdateBuilder.from()`: a real table, a CTE, or a values alias.
 */
export type UpdateFromSource = AnyTableWithColumns | AnyValuesWithColumns;

/** The columns record of a single `FROM` source. */
export type UpdateSourceColumns<TSource> = TSource extends AnyTableWithColumns
  ? TSource["_"]["columns"]
  : never;

/**
 * Union of the accessor-typed columns referenceable through the `FROM` sources.
 * Each source contributes its own column union so distinct keys never collapse.
 */
export type UpdateFromColumns<TFroms extends readonly unknown[]> = {
  [S in keyof TFroms]: UpdateSourceColumns<TFroms[S]>[keyof UpdateSourceColumns<
    TFroms[S]
  >];
}[number];

/**
 * Columns of `TColumns` whose select type is assignable to the update type of
 * `ColName` on `TTableWC`; used for both the target table and the `FROM` sources.
 */
export type CompatibleColumns<
  TTableWC extends AnyTableWithColumns,
  ColName extends keyof TTableWC["_"]["columns"],
  TColumns extends Record<string, AnyColumn>,
> = {
  [K in keyof TColumns]: TColumns[K]["ValTypeSelect"] extends Exclude<
    TTableWC["_"]["columns"][ColName]["ValTypeUpdate"],
    undefined
  >
    ? TColumns[K]
    : never;
}[keyof TColumns];

/**
 * Allowed expression for an individual column in an `UPDATE .set()` payload.
 * Accepts literals, prepared args, compatible columns (target table or `FROM`
 * sources), scalar SQL functions, or raw SQL.
 */
export type UpdateableItem<
  TTableWC extends AnyTableWithColumns,
  ColName extends keyof TTableWC["_"]["columns"],
  TPrepare extends boolean = false,
  TFroms extends readonly unknown[] = readonly [],
> =
  | Exclude<TTableWC["_"]["columns"][ColName]["ValTypeUpdate"], undefined>
  | (TPrepare extends true
      ? Arg<TTableWC["_"]["columns"][ColName]["ValType"]>
      : never)
  | CompatibleColumns<TTableWC, ColName, TTableWC["_"]["columns"]>
  | {
      [S in keyof TFroms]: CompatibleColumns<
        TTableWC,
        ColName,
        UpdateSourceColumns<TFroms[S]>
      >;
    }[number]
  | NonAggregateSqlFn<
      TTableWC["_"]["columns"][keyof TTableWC["_"]["columns"]],
      Exclude<TTableWC["_"]["columns"][ColName]["ValTypeUpdate"], undefined>,
      TPrepare extends true ? boolean : false
    >
  | Sql;

/**
 * Column values payload for `UpdateBuilder.set()`.
 * Excludes primary key columns.
 */
export type UpdateValues<
  TTableWC extends AnyTableWithColumns,
  TPrepare extends boolean = false,
  TFroms extends readonly unknown[] = readonly [],
> = {
  [ColName in keyof TTableWC["_"]["columns"] as TTableWC["_"]["columns"][ColName]["ValTypeUpdate"] extends never
    ? never
    : ColName]?: UpdateableItem<TTableWC, ColName, TPrepare, TFroms>;
};

/** Alias for `UpdateValues`. */
export type UpdateSetValues<
  TTableWC extends AnyTableWithColumns,
  TPrepare extends boolean = false,
  TFroms extends readonly unknown[] = readonly [],
> = UpdateValues<TTableWC, TPrepare, TFroms>;

/**
 * Columns carrying a `$updateFn`, resolved once per table.
 */
const updateFnColumnsCache = new WeakMap<
  StdTableWithColumns,
  readonly StdTableColumn[]
>();

function updateFnColumnsOf(
  table: StdTableWithColumns,
): readonly StdTableColumn[] {
  let columns = updateFnColumnsCache.get(table);
  if (columns === undefined) {
    const found: StdTableColumn[] = [];
    for (const key in table._.columns) {
      const column = table._.columns[key] as StdTableColumn;
      if (column.hasUpdateFn) found.push(column);
    }
    columns = found;
    updateFnColumnsCache.set(table, columns);
  }
  return columns;
}

/**
 * Intermediate builder for constructing an `UPDATE` statement.
 * Provides `.from()` to declare joined sources and `.set()` to specify column updates.
 */
export class UpdateBuilder<
  TTableWC extends AnyTableWithColumns,
  TPrepare extends boolean,
  TFroms extends readonly UpdateFromSource[] = readonly [],
> {
  readonly #table: TTableWC;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;
  readonly #$ctes: readonly AnyCteWithColumns[] | null;
  readonly #$froms: TFroms;
  constructor(
    table: TTableWC,
    executor: QueryExecutor,
    prepare: TPrepare,
    ctes: readonly AnyCteWithColumns[] | null = null,
    froms: TFroms = [] as unknown as TFroms,
  ) {
    this.#table = table;
    this.#executor = executor;
    this.#prepare = prepare;
    this.#$ctes = ctes;
    this.#$froms = froms;
  }

  /**
   * Adds `FROM` sources to the update: a real table, a CTE, or a values alias
   * created via `db.values(name, columns).as(rows)`.
   *
   * @param sources One or more sources; repeated calls append.
   * @returns An `UpdateBuilder` whose `.set()` accepts the sources' columns.
   */
  from<TNewFroms extends readonly [UpdateFromSource, ...UpdateFromSource[]]>(
    ...sources: TNewFroms
  ): UpdateBuilder<TTableWC, TPrepare, [...TFroms, ...TNewFroms]> {
    return new UpdateBuilder(
      this.#table,
      this.#executor,
      this.#prepare,
      this.#$ctes,
      [...this.#$froms, ...sources] as [...TFroms, ...TNewFroms],
    );
  }

  /**
   * Specifies the column-value pairs to update on the target table.
   *
   * @param values An object mapping table column names to updated expressions (literals, columns, SQL functions, or raw SQL).
   * @returns An `UpdateQuery` instance to chain `.where()` and `.returning()` clauses.
   */
  set<TValues extends UpdateValues<TTableWC, TPrepare, TFroms>>(
    values: TValues,
  ) {
    return new UpdateQuery(
      this.#table,
      values,
      undefined,
      undefined,
      this.#executor,
      this.#prepare,
      this.#$ctes,
      this.#$froms,
    );
  }
}

/**
 * Executable query representation of an `UPDATE` statement.
 * Supports chaining `.where()` and `.returning()` clauses.
 */
export class UpdateQuery<
  TTableWC extends AnyTableWithColumns,
  TPrepare extends boolean,
  TValues extends UpdateValues<TTableWC, TPrepare>,
  TWhere extends
    | FilterExpression<
        | TTableWC["_"]["columns"][keyof TTableWC["_"]["columns"]]
        | UpdateFromColumns<TFroms>,
        TPrepare
      >
    | undefined,
  TReturning extends
    | "*"
    | Partial<Record<keyof TTableWC["_"]["columns"], true>>
    | Partial<Record<keyof TTableWC["_"]["columns"], false>>
    | undefined,
  TFroms extends readonly UpdateFromSource[] = readonly [],
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
  readonly #$froms: TFroms;

  constructor(
    table: TTableWC,
    values: TValues,
    where: TWhere,
    returnings: TReturning,
    executor: QueryExecutor,
    prepare: TPrepare,
    ctes: readonly AnyCteWithColumns[] | null = null,
    froms: TFroms = [] as unknown as TFroms,
  ) {
    super();
    this.#table = table;
    this.#values = values;
    this.#$where = where;
    this.#$returning = returnings;
    this.#executor = executor;
    this.#prepare = prepare;
    this.#$ctes = ctes;
    this.#$froms = froms;
  }

  /**
   * Adds a `WHERE` condition to filter which rows are updated.
   *
   * @param where Filter condition expression.
   */
  where<
    TWhere extends FilterExpression<
      | TTableWC["_"]["columns"][keyof TTableWC["_"]["columns"]]
      | UpdateFromColumns<TFroms>,
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
      this.#$froms,
    );
  }

  /** Return all columns using `RETURNING *`. */
  returning(
    all: "*",
  ): UpdateQuery<TTableWC, TPrepare, TValues, TWhere, "*", TFroms>;
  /** Return a subset of columns. */
  returning<
    TReturnings extends
      | Partial<Record<keyof TTableWC["_"]["columns"], true>>
      | Partial<Record<keyof TTableWC["_"]["columns"], false>>,
  >(
    returnings: TReturnings,
  ): UpdateQuery<TTableWC, TPrepare, TValues, TWhere, TReturnings, TFroms>;
  returning<
    TReturnings extends
      | "*"
      | Partial<Record<keyof TTableWC["_"]["columns"], true>>
      | Partial<Record<keyof TTableWC["_"]["columns"], false>>,
  >(returnings: TReturnings) {
    return new UpdateQuery(
      this.#table,
      this.#values,
      this.#$where,
      returnings,
      this.#executor,
      this.#prepare,
      this.#$ctes,
      this.#$froms,
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

    let hasSet = false;
    const values = this.#values as Record<string, unknown>;
    const columns = this.#table._.columns;
    const prepare = this.#prepare;

    // Emit explicitly provided non-undefined values
    for (const field in values) {
      const value = values[field];
      if (value === undefined) continue;
      const column = columns[field];
      if (!column) continue;

      if (hasSet) query.sql += ", ";
      hasSet = true;

      query.sql += `"${column.nameSql}" = `;
      if (isCol(value)) {
        value.toQuery(query);
      } else if (value instanceof SqlFn) {
        value.toQuery(query);
      } else if (value instanceof Sql) {
        value.toQuery(query);
      } else if (is(value, Arg)) {
        query.addArg(value, value.cast ?? column.sqlCast ?? null);
      } else {
        query.sql += column.toSQL(value, { cast: true });
      }
    }

    // Add updateFn values for columns not explicitly provided
    for (const column of updateFnColumnsOf(
      this.#table as unknown as StdTableWithColumns,
    )) {
      if (values[column.name as string] !== undefined) continue;
      if (hasSet) query.sql += ", ";
      hasSet = true;

      query.sql += `"${column.nameSql}" = `;
      query.sql += generatedValueSQL(
        query,
        column,
        () => column.getUpdateFnVal,
        prepare,
      );
    }

    if (!hasSet) {
      throw new Error("No columns to set in UPDATE query.");
    }

    if (this.#$froms.length) {
      query.sql += " FROM ";
      buildUpdateFromClause(this.#$froms, query);
    }

    if (this.#$where) {
      query.sql += ` WHERE `;
      this.#$where.toQuery(query);
    }
    buildReturningClause(
      this.#table._.columns,
      this.#$returning as "*" | Record<string, boolean> | undefined,
      query,
      // FROM sources can carry same-named columns; qualify the target's ones.
      this.#table._.nameSql,
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

  handleRows(rows: RawRow[]) {
    return mapStarRows(
      rows,
      this.#table as unknown as StdTableWithColumns,
    ) as TReturn;
  }
}
