import type { Column, SetValueType } from "../columns/common";
import type { QueryExecutor } from "../connectors/common";
import type { AnyCteWithColumns } from "../cte";
import { is, isTCol } from "../entity";
import type {
  FilterExpression,
  HavingExpression,
  StdCondition,
} from "../filters/index";
import { type InferValueType, SqlFn } from "../functions/index";
import { escIdentifier, Sql, toSqlValue } from "../sql";
import type {
  AnyColumn,
  AnyTableWithColumns,
  StdTableColumn,
  StdTableWithColumns,
  TableColumn,
  TableWithColumns,
  UnwrapTableColumn,
} from "../table";
import type {
  Prettify,
  SelfOrArray,
  UnionToIntersection,
  Valueof,
} from "../types";
import type { AnySelectableSource } from "../virtual-table";
import {
  type AnyGroupByExpression,
  type GroupByExpression,
  isScalarSqlFn,
  type StdGroupByExpression,
} from "./groupby-clause";
import { buildWithClause, type SelectAliasesView } from "./helpers";
import type { OrderExpression } from "./orderby-clause";
import { type AnyArg, Arg } from "./prepare";
import { type AnyQuery, Query } from "./query";
import { QueryPromise } from "./query-promise";

// ============================================================================
// View types — shared by all callback-based chain methods
// ============================================================================

/** Maps a table's columns to `TableColumn` with schema/table metadata. */
type ViewColumns<
  TSchema extends string,
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> = {
  [K in keyof TColumns]: TableColumn<TSchema, TName, K, TColumns[K]>;
};

type NullableColumnConfig<TConfig> = {
  [C in keyof TConfig as C extends "notNull" | "primaryKey"
    ? never
    : C]: TConfig[C];
};

type NullableColumn<TCol extends AnyColumn> =
  UnwrapTableColumn<TCol> extends infer UCol extends AnyColumn
    ? UCol extends {
        $: {
          HasValTypeOverridde: true;
          ValTypeOverride: infer TOverride;
        };
      }
      ? SetValueType<
          Column<
            NullableColumnConfig<UCol["config"]>,
            UCol["$"]["TsType"],
            UCol["$"]["PgType"]
          >,
          TOverride
        >
      : Column<
          NullableColumnConfig<UCol["config"]>,
          UCol["$"]["TsType"],
          UCol["$"]["PgType"]
        >
    : never;

/** Same as `ViewColumns` but every column is nullable (notNull/primaryKey stripped). */
type NullableViewColumns<
  TSchema extends string,
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> = {
  [K in keyof TColumns]: TableColumn<
    TSchema,
    TName,
    K,
    NullableColumn<TColumns[K]>
  >;
};

/** Maps a single join entry to `{ tableName: columns }`. Left joins get nullable columns. */
type JoinView<TJoin> = TJoin extends {
  type: "left";
  table: {
    _: {
      schema: infer S extends string;
      name: infer N extends string;
    };
    $: {
      columns: infer C extends Record<string, AnyColumn>;
    };
  };
}
  ? Record<N, NullableViewColumns<S, N, C>>
  : TJoin extends {
        table: {
          _: {
            schema: infer S extends string;
            name: infer N extends string;
          };
          $: {
            columns: infer C extends Record<string, AnyColumn>;
          };
        };
      }
    ? Record<N, ViewColumns<S, N, C>>
    : never;

/** Full per-table view: base table + all joins, keyed by table name. */
type ColumnsView<
  TTSchema extends string,
  TTName extends string,
  TColumns extends Record<string, AnyColumn>,
  TJoins,
> = Record<TTName, ViewColumns<TTSchema, TTName, TColumns>> &
  (TJoins extends readonly (infer TJoin)[]
    ? UnionToIntersection<JoinView<TJoin>>
    : Record<never, never>);

/** Union of all `TableColumn` values across the view (for type constraints). */
type AllViewColumns<
  TTSchema extends string,
  TTName extends string,
  TColumns extends Record<string, AnyColumn>,
  TJoins,
> = Valueof<ViewColumns<TTSchema, TTName, TColumns>> | JoinsViewColumns<TJoins>;

type JoinsViewColumns<TJoins> = TJoins extends readonly (infer TJoin)[]
  ? TJoin extends {
      type: "left";
      table: {
        _: {
          schema: infer S extends string;
          name: infer N extends string;
        };
        $: {
          columns: infer C extends Record<string, AnyColumn>;
        };
      };
    }
    ? Valueof<NullableViewColumns<S, N, C>>
    : TJoin extends {
          table: {
            _: {
              schema: infer S extends string;
              name: infer N extends string;
            };
            $: {
              columns: infer C extends Record<string, AnyColumn>;
            };
          };
        }
      ? Valueof<ViewColumns<S, N, C>>
      : never
  : never;

// ============================================================================
// Type helpers (used in select-all / TReturn)
// ============================================================================

type MergeJoinedColumns<
  TColumns extends Record<string, AnyColumn>,
  TJoins,
> = Prettify<
  TColumns &
    (TJoins extends readonly (infer TJoin)[]
      ? UnionToIntersection<
          TJoin extends {
            table: {
              $: {
                columns: infer TJoinColumns extends Record<string, AnyColumn>;
              };
            };
          }
            ? TJoinColumns
            : never
        >
      : Record<never, never>)
>;

/** Shared shape for a single entry in the joins tuple. */
type JoinEntry = {
  type: "inner" | "left";
  table: AnyTableWithColumns;
  on: StdCondition;
};

type TableColumns<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
> = {
  [K in keyof TTColumns]: TableColumn<TTSchema, TTName, K, TTColumns[K]>;
}[keyof TTColumns];

// ============================================================================
// Runtime helper — builds the namespaced view object
// ============================================================================

/** Builds the per-table columns view at runtime. Left join columns are cloned nullable. */
function buildColumnsView(
  table: StdTableWithColumns,
  joins: JoinEntry[] | null,
): Record<string, Record<string, StdTableColumn>> {
  const view: Record<string, Record<string, StdTableColumn>> = {};
  view[table._.name] = table._.columns;
  joins?.forEach((j) => {
    if (j.type === "left") {
      const cols: Record<string, StdTableColumn> = {};
      for (const key in j.table._.columns) {
        cols[key] = j.table._.columns[key].cloneAsNullable() as StdTableColumn;
      }
      view[j.table._.name] = cols;
    } else {
      view[j.table._.name] = j.table._.columns;
    }
  });
  return view;
}

// ============================================================================
// SelectBuilder
// ============================================================================

/** Partial view available during join — base table + already-joined tables. */
type JoinOnView<
  TTSchema extends string,
  TTName extends string,
  TColumns extends Record<string, AnyColumn>,
  TJoins,
  TJoinSchema extends string,
  TJoinName extends string,
  TJoinColumns extends Record<string, AnyColumn>,
> = ColumnsView<TTSchema, TTName, TColumns, TJoins> &
  Record<TJoinName, ViewColumns<TJoinSchema, TJoinName, TJoinColumns>>;

/**
 * Any item that can be selected in a `.select(...)` projection:
 * - TableColumn in query scope
 * - SqlFn in query scope
 * - Sql instance (raw SQL expression)
 * - `null` literal (SQL NULL)
 * - Primitive literals: `string | number | bigint | boolean`
 */
export type SelectableItem<
  TScopeColumns extends AnyColumn,
  TPrepare extends boolean = false,
> =
  | TScopeColumns
  | SqlFn<TScopeColumns, TPrepare extends true ? boolean : false>
  | Sql
  | null
  | string
  | number
  | bigint
  | boolean;

/** Resolves the TypeScript inferred return type for a single selected projection entry. */
export type InferSelectValue<T> = InferValueType<T>;

/** Infers the full row object type for an object-mapping `.select(...)` callback. */
export type InferSelectRow<TSelects> = {
  [K in keyof TSelects]: InferSelectValue<TSelects[K]>;
};

export class SelectBuilder<
  TTSchema extends string,
  TTName extends string,
  TColumns extends Record<string, AnyColumn>,
  TPrepare extends boolean,
  TJoins extends null | [JoinEntry, ...JoinEntry[]],
> {
  readonly #table: TableWithColumns<TTSchema, TTName, TColumns>;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;
  readonly #$joins: TJoins;
  readonly #$distinctOn: StdTableColumn[] | undefined;
  readonly #$ctes: readonly AnyCteWithColumns[] | null;
  #cachedView: Record<string, Record<string, StdTableColumn>> | null = null;

  constructor(
    table: TableWithColumns<TTSchema, TTName, TColumns>,
    joins: TJoins,
    distinctOn: StdTableColumn[] | undefined,
    executor: QueryExecutor,
    prepare: TPrepare,
    ctes: readonly AnyCteWithColumns[] | null = null,
  ) {
    this.#table = table;
    this.#$joins = joins;
    this.#$distinctOn = distinctOn;
    this.#executor = executor;
    this.#prepare = prepare;
    this.#$ctes = ctes;
  }

  /** Returns the memoized columns view for this builder instance. */
  #getView(): Record<string, Record<string, StdTableColumn>> {
    if (!this.#cachedView) {
      this.#cachedView = buildColumnsView(
        this.#table as unknown as StdTableWithColumns,
        this.#$joins,
      );
    }
    return this.#cachedView;
  }

  innerJoin<
    TJoinTSchema extends string,
    TJoinTName extends string,
    TJoinColumns extends Record<string, AnyColumn>,
  >(
    table: TableWithColumns<TJoinTSchema, TJoinTName, TJoinColumns>,
    on: (
      view: JoinOnView<
        TTSchema,
        TTName,
        TColumns,
        TJoins,
        TJoinTSchema,
        TJoinTName,
        TJoinColumns
      >,
    ) => FilterExpression<
      | AllViewColumns<TTSchema, TTName, TColumns, TJoins>
      | TableColumns<TJoinTSchema, TJoinTName, TJoinColumns>
    >,
  ): SelectBuilder<
    TTSchema,
    TTName,
    TColumns,
    TPrepare,
    TJoins extends unknown[]
      ? [
          ...TJoins,
          {
            type: "inner";
            table: TableWithColumns<TJoinTSchema, TJoinTName, TJoinColumns>;
            on: StdCondition;
          },
        ]
      : [
          {
            type: "inner";
            table: TableWithColumns<TJoinTSchema, TJoinTName, TJoinColumns>;
            on: StdCondition;
          },
        ]
  > {
    const view = { ...this.#getView() };
    // Add the joining table to the view
    view[table._.name] = table._.columns as never;
    const onResult = on(view as never);
    return new SelectBuilder(
      this.#table,
      this.#$joins
        ? ([
            ...this.#$joins,
            { type: "inner" as const, table, on: onResult },
          ] as never)
        : ([{ type: "inner" as const, table, on: onResult }] as never),
      undefined,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    );
  }

  leftJoin<
    TJoinTSchema extends string,
    TJoinTName extends string,
    TJoinColumns extends Record<string, AnyColumn>,
  >(
    table: TableWithColumns<TJoinTSchema, TJoinTName, TJoinColumns>,
    on: (
      view: JoinOnView<
        TTSchema,
        TTName,
        TColumns,
        TJoins,
        TJoinTSchema,
        TJoinTName,
        TJoinColumns
      >,
    ) => FilterExpression<
      | AllViewColumns<TTSchema, TTName, TColumns, TJoins>
      | TableColumns<TJoinTSchema, TJoinTName, TJoinColumns>
    >,
  ): SelectBuilder<
    TTSchema,
    TTName,
    TColumns,
    TPrepare,
    TJoins extends unknown[]
      ? [
          ...TJoins,
          {
            type: "left";
            table: TableWithColumns<TJoinTSchema, TJoinTName, TJoinColumns>;
            on: StdCondition;
          },
        ]
      : [
          {
            type: "left";
            table: TableWithColumns<TJoinTSchema, TJoinTName, TJoinColumns>;
            on: StdCondition;
          },
        ]
  > {
    const view = { ...this.#getView() };
    // Add the joining table to the view (not nullable for `on` — using original columns)
    view[table._.name] = table._.columns as never;
    const onResult = on(view as never);
    return new SelectBuilder(
      this.#table,
      this.#$joins
        ? ([
            ...this.#$joins,
            { type: "left" as const, table, on: onResult },
          ] as never)
        : ([{ type: "left" as const, table, on: onResult }] as never),
      undefined,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    );
  }

  distinctOn(
    callback: (
      view: ColumnsView<TTSchema, TTName, TColumns, TJoins>,
    ) => SelfOrArray<AllViewColumns<TTSchema, TTName, TColumns, TJoins>>,
  ): Omit<
    SelectBuilder<TTSchema, TTName, TColumns, TPrepare, TJoins>,
    "distinctOn" | "innerJoin" | "leftJoin"
  > {
    const columns = callback(this.#getView() as never);
    return new SelectBuilder(
      this.#table,
      this.#$joins,
      (Array.isArray(columns) ? columns : [columns]) as StdTableColumn[],
      this.#executor,
      this.#prepare,
      this.#$ctes,
    );
  }

  select(
    star: "*",
  ): SelectQuery<
    TTSchema,
    TTName,
    TColumns,
    TPrepare,
    TJoins,
    undefined,
    undefined,
    undefined
  >;
  select<
    TSelects extends Record<
      string,
      SelectableItem<
        AllViewColumns<TTSchema, TTName, TColumns, TJoins>,
        TPrepare
      >
    >,
  >(
    callback: (
      view: ColumnsView<TTSchema, TTName, TColumns, TJoins>,
    ) => TSelects,
  ): SelectQuery<
    TTSchema,
    TTName,
    TColumns,
    TPrepare,
    TJoins,
    TSelects,
    undefined,
    undefined
  >;
  select<
    TSelects extends
      | Record<
          string,
          SelectableItem<
            AllViewColumns<TTSchema, TTName, TColumns, TJoins>,
            TPrepare
          >
        >
      | undefined,
  >(
    starOrCallback:
      | "*"
      | ((view: ColumnsView<TTSchema, TTName, TColumns, TJoins>) => TSelects),
  ) {
    const selects =
      typeof starOrCallback === "function"
        ? starOrCallback(this.#getView() as never)
        : undefined;
    return new SelectQuery(
      this.#table,
      this.#$joins,
      selects as never,
      this.#$distinctOn,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    );
  }
}

// ============================================================================
// SelectQuery
// ============================================================================

/** Makes all values of a select-inference record nullable. */
type Nullable<S> = {
  [K in keyof S]: S[K] | null;
};

/** Infers the select type for a single join entry, making columns nullable for left joins. */
type InferJoinSelect<TJoin> = TJoin extends {
  type: "left";
  table: { $: { inferSelect: infer S } };
}
  ? Nullable<S>
  : TJoin extends { table: { $: { inferSelect: infer S } } }
    ? S
    : Record<never, never>;

export class SelectQuery<
  TTSchema extends string,
  TTName extends string,
  TColumns extends Record<string, AnyColumn>,
  TPrepare extends boolean,
  TJoins extends null | [JoinEntry, ...JoinEntry[]],
  TSelects extends
    | Record<
        string,
        SelectableItem<
          AllViewColumns<TTSchema, TTName, TColumns, TJoins>,
          TPrepare
        >
      >
    | undefined,
  TWhere extends
    | FilterExpression<
        AllViewColumns<TTSchema, TTName, TColumns, TJoins>,
        TPrepare
      >
    | undefined,
  TOrderBy extends
    | OrderExpression<
        AllViewColumns<TTSchema, TTName, TColumns, TJoins>,
        TPrepare,
        TSelects
      >
    | OrderExpression<
        AllViewColumns<TTSchema, TTName, TColumns, TJoins>,
        TPrepare,
        TSelects
      >[]
    | undefined,
  TGroupBy extends
    | [AnyGroupByExpression, ...AnyGroupByExpression[]]
    | undefined = undefined,
  THaving extends
    | HavingExpression<
        AllViewColumns<TTSchema, TTName, TColumns, TJoins>,
        TPrepare
      >
    | undefined = undefined,
  TReturn = (TSelects extends Record<string, unknown>
    ? {
        [K in keyof TSelects]: InferSelectValue<TSelects[K]>;
      }
    : Prettify<
        TableWithColumns<TTSchema, TTName, TColumns>["$"]["inferSelect"] &
          (TJoins extends unknown[]
            ? UnionToIntersection<InferJoinSelect<TJoins[number]>>
            : Record<never, never>)
      >)[],
> extends QueryPromise<TReturn> {
  readonly #table: TableWithColumns<TTSchema, TTName, TColumns>;
  readonly #$select: TSelects;
  readonly #$distinctOn: StdTableColumn[] | undefined;
  readonly #$where: TWhere;
  readonly #$joins: TJoins;
  readonly #$orderBy: TOrderBy;
  readonly #$groupBy: TGroupBy;
  readonly #$having: THaving;
  #$limit: number | bigint | AnyArg | undefined;
  #$offset: number | bigint | AnyArg | undefined;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;
  readonly #$ctes: readonly AnyCteWithColumns[] | null;
  #cachedView: Record<string, Record<string, StdTableColumn>> | null = null;
  #cachedSelectAliases: Record<string, string> | null = null;

  constructor(
    table: TableWithColumns<TTSchema, TTName, TColumns>,
    joins: TJoins,
    select: TSelects,
    distinctOn: StdTableColumn[] | undefined,
    where: TWhere,
    orderBy: TOrderBy,
    groupBy: TGroupBy,
    having: THaving,
    limit: number | bigint | AnyArg | undefined,
    offset: number | bigint | AnyArg | undefined,
    executor: QueryExecutor,
    prepare: TPrepare,
    ctes: readonly AnyCteWithColumns[] | null = null,
  ) {
    super();
    this.#table = table;
    this.#$select = select;
    this.#$distinctOn = distinctOn;
    this.#$joins = joins;
    this.#$where = where;
    this.#$orderBy = orderBy;
    this.#$groupBy = groupBy;
    this.#$having = having;
    this.#$limit = limit;
    this.#$offset = offset;
    this.#executor = executor;
    this.#prepare = prepare;
    this.#$ctes = ctes;
  }

  /** Returns the memoized columns view for this query instance. */
  #getView(): Record<string, Record<string, StdTableColumn>> {
    if (!this.#cachedView) {
      this.#cachedView = buildColumnsView(
        this.#table as unknown as StdTableWithColumns,
        this.#$joins,
      );
    }
    return this.#cachedView;
  }

  /** Returns the memoized select aliases view for this query instance. */
  #getSelectAliases(): Record<string, string> {
    if (!this.#cachedSelectAliases) {
      this.#cachedSelectAliases = this.#$select
        ? Object.fromEntries(Object.keys(this.#$select).map((k) => [k, k]))
        : {};
    }
    return this.#cachedSelectAliases;
  }

  where(
    callback: (
      view: ColumnsView<TTSchema, TTName, TColumns, TJoins>,
    ) => FilterExpression<
      AllViewColumns<TTSchema, TTName, TColumns, TJoins>,
      TPrepare
    >,
  ) {
    const filter = callback(this.#getView() as never);
    return new SelectQuery(
      this.#table,
      this.#$joins,
      this.#$select,
      this.#$distinctOn,
      filter,
      this.#$orderBy,
      this.#$groupBy,
      this.#$having,
      this.#$limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    );
  }

  orderBy<
    TOrderBys extends SelfOrArray<
      OrderExpression<
        AllViewColumns<TTSchema, TTName, TColumns, TJoins>,
        TPrepare,
        TSelects
      >
    >,
  >(
    callback: (
      view: ColumnsView<TTSchema, TTName, TColumns, TJoins>,
      selects: SelectAliasesView<TSelects>,
    ) => TOrderBys,
  ) {
    const orderBy = callback(
      this.#getView() as never,
      this.#getSelectAliases() as never,
    );
    return new SelectQuery(
      this.#table,
      this.#$joins,
      this.#$select,
      this.#$distinctOn,
      this.#$where,
      orderBy,
      this.#$groupBy,
      this.#$having,
      this.#$limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    );
  }

  /**
   * Adds an explicit GROUP BY clause. Overrides auto GROUP BY detection when set.
   *
   * ```ts
   * db.from(Users).select(({ users }) => ({ type: users.type, total: count('*') }))
   *   .groupBy(({ users }, { type }) => [type])
   * ```
   */
  groupBy<
    TItems extends SelfOrArray<
      GroupByExpression<
        AllViewColumns<TTSchema, TTName, TColumns, TJoins>,
        TPrepare,
        TSelects
      >
    >,
  >(
    callback: (
      view: ColumnsView<TTSchema, TTName, TColumns, TJoins>,
      selects: SelectAliasesView<TSelects>,
    ) => TItems,
  ): Omit<this, "groupBy"> {
    const result = callback(
      this.#getView() as never,
      this.#getSelectAliases() as never,
    );
    const items = Array.isArray(result) ? result : [result];
    return new SelectQuery(
      this.#table,
      this.#$joins,
      this.#$select,
      this.#$distinctOn,
      this.#$where,
      this.#$orderBy,
      items as unknown as [StdGroupByExpression, ...StdGroupByExpression[]],
      this.#$having,
      this.#$limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    ) as unknown as Omit<this, "groupBy">;
  }

  /**
   * Adds a HAVING clause to filter grouped results.
   *
   * ```typescript
   * db.from(Users).select(({ users }) => ({ type: users.type, total: count('*') }))
   *   .groupBy(({ users }) => [users.type])
   *   .having(() => gte(count('*'), 2))
   * ```
   */
  having<
    TH extends HavingExpression<
      AllViewColumns<TTSchema, TTName, TColumns, TJoins>,
      TPrepare
    >,
  >(
    callback: (view: ColumnsView<TTSchema, TTName, TColumns, TJoins>) => TH,
  ): Omit<this, "having"> {
    const having = callback(this.#getView() as never);
    return new SelectQuery(
      this.#table,
      this.#$joins,
      this.#$select,
      this.#$distinctOn,
      this.#$where,
      this.#$orderBy,
      this.#$groupBy,
      having,
      this.#$limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    ) as unknown as Omit<this, "having">;
  }

  limit(
    limit: TPrepare extends true
      ? number | bigint | Arg<number> | Arg<bigint>
      : number | bigint,
  ) {
    return new SelectQuery(
      this.#table,
      this.#$joins,
      this.#$select,
      this.#$distinctOn,
      this.#$where,
      this.#$orderBy,
      this.#$groupBy,
      this.#$having,
      limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    ) as unknown as Omit<this, "limit">;
  }

  offset(
    offset: TPrepare extends true
      ? number | bigint | Arg<number> | Arg<bigint>
      : number | bigint,
  ) {
    return new SelectQuery(
      this.#table,
      this.#$joins,
      this.#$select,
      this.#$distinctOn,
      this.#$where,
      this.#$orderBy,
      this.#$groupBy,
      this.#$having,
      this.#$limit,
      offset,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    ) as unknown as Omit<this, "offset">;
  }

  toQuery(parentQuery?: AnyQuery): Query<TReturn> {
    const isRoot = parentQuery === undefined;
    const query: Query<TReturn> = parentQuery
      ? (parentQuery as unknown as Query<TReturn>)
      : new Query<TReturn>("", this.handleRows.bind(this));

    if (isRoot && this.#$ctes?.length) {
      buildWithClause(this.#$ctes, query);
    }

    query.sql += "SELECT ";
    if (this.#$distinctOn?.length) {
      query.sql += `DISTINCT ON (${this.#$distinctOn.map((c) => c.fullName).join(", ")}) `;
    }
    const entries = this.#$select ? Object.entries(this.#$select) : null;
    if (entries) {
      for (let i = 0; i < entries.length; i++) {
        const [key, item] = entries[i];
        if (item === null) {
          query.sql += `NULL AS "${escIdentifier(key)}"`;
        } else if (item instanceof SqlFn) {
          item.toQuery(query);
          query.sql += ` AS "${escIdentifier(key)}"`;
        } else if (isTCol(item)) {
          query.sql += `${item.fullName} AS "${escIdentifier(key)}"`;
        } else if (item instanceof Sql) {
          item.toQuery(query);
          query.sql += ` AS "${escIdentifier(key)}"`;
        } else {
          query.sql += `${toSqlValue(item as never)} AS "${escIdentifier(key)}"`;
        }
        if (i < entries.length - 1) query.sql += ", ";
      }
    } else {
      query.sql += "*";
    }
    query.sql += " FROM ";
    query.sql += this.#table._.fullName;
    this.#$joins?.forEach((join) => {
      const keyword = join.type === "left" ? "LEFT" : "INNER";
      query.sql += ` ${keyword} JOIN ${join.table._.fullName} ON `;
      join.on.toQuery(query);
    });
    if (this.#$where) {
      query.sql += " WHERE ";
      this.#$where.toQuery(query);
    }
    if (this.#$groupBy?.length) {
      // Explicit GROUP BY — bypasses auto GROUP BY detection
      query.sql += " GROUP BY ";
      for (let i = 0; i < this.#$groupBy.length; i++) {
        const expr = this.#$groupBy[i];
        if (typeof expr === "string") {
          query.sql += `"${escIdentifier(expr)}"`;
        } else if (isScalarSqlFn(expr)) {
          expr.toQuery(query); // → floor(...)
        } else {
          query.sql += expr.fullName; // → "table"."col"
        }
        if (i < this.#$groupBy.length - 1) query.sql += ", ";
      }
    } else if (entries) {
      const hasAggregate = entries.some(
        ([, item]) => item instanceof SqlFn && item.isAggregate,
      );
      if (hasAggregate) {
        const nonAggEntries = entries.filter(
          ([, item]) =>
            isTCol(item) || (item instanceof SqlFn && !item.isAggregate),
        );
        if (nonAggEntries.length > 0) {
          query.sql += " GROUP BY ";
          for (let i = 0; i < nonAggEntries.length; i++) {
            const [, item] = nonAggEntries[i];
            (item as { toQuery: (q: Query<unknown>) => void }).toQuery(query);
            if (i < nonAggEntries.length - 1) query.sql += ", ";
          }
        }
      }
    }
    // HAVING — emitted after GROUP BY (explicit or auto)
    if (this.#$having) {
      query.sql += " HAVING ";
      this.#$having.toQuery(query);
    }
    if (this.#$orderBy) {
      const orders = Array.isArray(this.#$orderBy)
        ? this.#$orderBy
        : [this.#$orderBy];
      query.sql += " ORDER BY ";
      for (let i = 0; i < orders.length; i++) {
        orders[i].toQuery(query);
        if (i < orders.length - 1) query.sql += ", ";
      }
    }
    if (this.#$limit !== undefined) {
      query.sql += " LIMIT ";
      if (is(this.#$limit, Arg)) {
        query.addArg(this.#$limit);
      } else {
        query.sql += this.#$limit.toString();
      }
    }
    if (this.#$offset !== undefined) {
      query.sql += " OFFSET ";
      if (is(this.#$offset, Arg)) {
        query.addArg(this.#$offset);
      } else {
        query.sql += this.#$offset.toString();
      }
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

  /**
   * Returns the resolved output columns of this query.
   */
  getResolvedColumns(): Prettify<
    TSelects extends Record<string, unknown>
      ? TSelects
      : MergeJoinedColumns<TColumns, TJoins>
  > {
    if (this.#$select) {
      return { ...this.#$select } as Prettify<
        TSelects extends Record<string, unknown>
          ? TSelects
          : MergeJoinedColumns<TColumns, TJoins>
      >;
    }
    const cols: Record<string, AnySelectableSource> = {
      ...this.#table._.columns,
    };
    this.#$joins?.forEach((j) => {
      Object.assign(cols, j.table._.columns);
    });
    return cols as Prettify<
      TSelects extends Record<string, unknown>
        ? TSelects
        : MergeJoinedColumns<TColumns, TJoins>
    >;
  }

  handleRows(rows: Record<string, unknown>[]) {
    if (this.#$select !== undefined) {
      if (rows.length === 0) return [] as TReturn;
      const keys = Object.keys(rows[0]);
      rows.forEach((row) => {
        keys.forEach((key) => {
          const item = (this.#$select as Record<string, unknown>)[key];
          if (item === null) {
            row[key] = null;
          } else if (isTCol(item)) {
            row[key] = item.fromDriver(row[key]);
          } else if (item instanceof SqlFn) {
            row[key] = item.fromDriverValue(row[key]);
          } else if (typeof item === "bigint") {
            row[key] =
              row[key] === null || row[key] === undefined
                ? null
                : BigInt(row[key] as string | number);
          } else if (typeof item === "boolean") {
            row[key] =
              row[key] === null || row[key] === undefined
                ? null
                : row[key] === true || row[key] === "t" || row[key] === "true";
          } else if (typeof item === "number") {
            row[key] =
              row[key] === null || row[key] === undefined
                ? null
                : Number(row[key]);
          }
        });
      });
      return rows as TReturn;
    } else {
      if (rows.length === 0) return [] as TReturn;
      const newRows: Record<string, unknown>[] = [];
      const keys = Object.keys(rows[0]);
      rows.forEach((row) => {
        const newRow: Record<string, unknown> = {};
        keys.forEach((key) => {
          let column =
            this.#table._.columnsBySql[key] ?? this.#table._.columns[key];
          if (column === undefined) {
            this.#$joins?.forEach((join) => {
              const joinCol =
                join.table._.columnsBySql[key] ?? join.table._.columns[key];
              if (joinCol !== undefined) {
                column = joinCol;
              }
            });
          }
          if (column === undefined)
            throw new Error(`Column ${key} not found in any table`);
          newRow[column.name] = column.fromDriver(row[key]);
        });
        newRows.push(newRow);
      });
      return newRows as TReturn;
    }
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <>
type AnySQ = SelectQuery<any, any, any, any, any, any, any, any>;

export type AnySelectQuery = AnySQ;
