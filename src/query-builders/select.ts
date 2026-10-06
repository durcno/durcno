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
import { SubquerySqlFn } from "../functions/subquery";
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
import {
  applyStarRowsPlan,
  buildStarRowsPlan,
  buildWithClause,
  type SelectAliasesView,
  type StarRowsPlan,
} from "./helpers";
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

/** Columns view passed to clause callbacks, keyed by table name. */
type ColumnsViewRecord = Record<string, Record<string, StdTableColumn>>;

/**
 * Nullable column records, memoised per joined table.
 *
 * A `LEFT JOIN` needs every column of the joined table cloned nullable, and a
 * chain of joins asks for the same tables again and again. Tables are
 * per-schema singletons, so keying on the table object bounds the cache.
 *
 * The clones are shared by every view that mentions the table, so they must be
 * treated as read-only — the columns view exists only to be handed to
 * `eq(...)`, `asc(...)` and friends.
 */
const nullableColumnsCache = new WeakMap<
  StdTableWithColumns,
  Record<string, StdTableColumn>
>();

/** Returns the nullable clone of every column of `table`, built once per table. */
function buildNullableColumns(
  table: StdTableWithColumns,
): Record<string, StdTableColumn> {
  let cols = nullableColumnsCache.get(table);
  if (cols === undefined) {
    cols = {};
    for (const key in table._.columns) {
      cols[key] = table._.columns[key].cloneAsNullable() as StdTableColumn;
    }
    nullableColumnsCache.set(table, cols);
  }
  return cols;
}

/**
 * Builds the per-table columns view at runtime. Left join columns are cloned
 * nullable; the clones themselves come from {@link buildNullableColumns}.
 *
 * The result is a fresh top-level object — join methods copy it before adding
 * the table they join — but its per-table records are shared.
 */
function buildColumnsView(
  table: StdTableWithColumns,
  joins: JoinEntry[] | null,
): ColumnsViewRecord {
  const view: ColumnsViewRecord = {};
  view[table._.name] = table._.columns;
  if (joins) {
    for (const join of joins) {
      view[join.table._.name] =
        join.type === "left"
          ? buildNullableColumns(join.table)
          : join.table._.columns;
    }
  }
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
  #cachedView: ColumnsViewRecord | null;

  /**
   * @param cachedView - Columns view of the builder this one derives from.
   *   Pass it only when `table` and `joins` are both forwarded unchanged; a
   *   stale view would hand callbacks the wrong nullability.
   */
  constructor(
    table: TableWithColumns<TTSchema, TTName, TColumns>,
    joins: TJoins,
    distinctOn: StdTableColumn[] | undefined,
    executor: QueryExecutor,
    prepare: TPrepare,
    ctes: readonly AnyCteWithColumns[] | null = null,
    cachedView: ColumnsViewRecord | null = null,
  ) {
    this.#table = table;
    this.#$joins = joins;
    this.#$distinctOn = distinctOn;
    this.#executor = executor;
    this.#prepare = prepare;
    this.#$ctes = ctes;
    this.#cachedView = cachedView;
  }

  /** Returns the memoized columns view for this builder instance. */
  #getView(): ColumnsViewRecord {
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
      // `joins` changed, so the parent's view no longer matches.
      null,
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
      // `joins` changed — the joined table is only reachable through this
      // method's own `on` view, so the parent's view must not be reused.
      null,
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
      this.#cachedView,
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
      this.#cachedView,
    );
  }
}

// ============================================================================
// Runtime helpers — row conversion
// ============================================================================

/**
 * Precomputed conversion of an explicit `.select({...})` projection.
 * Which converter a key needs depends only on the projection, never on the
 * row, so the type dispatch is resolved once and replayed per row.
 * Keys needing no conversion (raw `Sql` and string literals) are left out.
 */
type SelectRowsPlan = {
  keys: string[];
  converts: ((value: unknown) => unknown)[];
};

/** Replaces any driver value with `null` — used for `null` projections. */
function toNull(): unknown {
  return null;
}

/** Converts a driver value to `bigint`, mapping NULL to `null`. */
function fromDriverBigInt(value: unknown): bigint | null {
  return value === null || value === undefined
    ? null
    : BigInt(value as string | number);
}

/** Converts a driver value to `boolean`, mapping NULL to `null`. */
function fromDriverBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return value === true || value === "t" || value === "true";
}

/** Converts a driver value to `number`, mapping NULL to `null`. */
function fromDriverNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/**
 * Returns the driver-to-JS converter for a single projection item, or null
 * when the value passes through untouched (raw `Sql`, string literals).
 */
function buildSelectItemConverter(
  item: unknown,
): ((value: unknown) => unknown) | null {
  if (item === null) return toNull;
  if (isTCol(item)) {
    const column = item as unknown as AnyColumn;
    // Not `resolveFromDriver` — keeping the closure local to this function
    // avoids polymorphism at the call site (~20% faster on mixed projections).
    return (value) => column.fromDriver(value);
  }
  if (item instanceof SqlFn) {
    return (value) => item.fromDriverValue(value);
  }
  const type = typeof item;
  if (type === "bigint") return fromDriverBigInt;
  if (type === "boolean") return fromDriverBoolean;
  if (type === "number") return fromDriverNumber;
  return null;
}

/** Builds the conversion plan of an explicit projection for the given keys. */
function buildSelectRowsPlan(
  select: Record<string, unknown>,
  keys: readonly string[],
): SelectRowsPlan {
  const planKeys: string[] = [];
  const converts: ((value: unknown) => unknown)[] = [];
  for (const key of keys) {
    const convert = buildSelectItemConverter(select[key]);
    if (convert === null) continue;
    planKeys.push(key);
    converts.push(convert);
  }
  return { keys: planKeys, converts };
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
  #cachedView: ColumnsViewRecord | null;
  #cachedSelectAliases: Record<string, string> | null = null;
  #selectRowsPlan: SelectRowsPlan | null = null;
  #starRowsPlan: StarRowsPlan | null = null;

  /**
   * @param cachedView - Columns view of the query this one derives from. Pass
   *   it only when `table` and `joins` are both forwarded unchanged; a stale
   *   view would hand callbacks the wrong nullability.
   */
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
    cachedView: ColumnsViewRecord | null = null,
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
    this.#cachedView = cachedView;
  }

  /** Returns the memoized columns view for this query instance. */
  #getView(): ColumnsViewRecord {
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
      const select = this.#$select;
      const aliases: Record<string, string> = {};
      if (select) {
        for (const key in select) {
          aliases[key] = key;
        }
      }
      this.#cachedSelectAliases = aliases;
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
      this.#cachedView,
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
      this.#cachedView,
    );
  }

  /**
   * Adds an explicit GROUP BY clause. Overrides auto GROUP BY detection when set.
   *
   * ```ts
   * db.from(Users).select(() => ({ type: Users.type, total: count('*') }))
   *   .groupBy((_, { type }) => [type])
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
      this.#cachedView,
    ) as unknown as Omit<this, "groupBy">;
  }

  /**
   * Adds a HAVING clause to filter grouped results.
   *
   * ```typescript
   * db.from(Users).select(() => ({ type: Users.type, total: count('*') }))
   *   .groupBy(() => [Users.type])
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
      this.#cachedView,
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
      this.#cachedView,
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
      this.#cachedView,
    ) as unknown as Omit<this, "offset">;
  }

  toQuery(parentQuery?: AnyQuery): Query<TReturn> {
    const query: Query<TReturn> = parentQuery
      ? (parentQuery as unknown as Query<TReturn>)
      : new Query<TReturn>("", this.handleRows.bind(this));

    if (this.#$ctes?.length) {
      buildWithClause(this.#$ctes, query);
    }

    query.sql += "SELECT ";
    const distinctOn = this.#$distinctOn;
    if (distinctOn?.length) {
      query.sql += "DISTINCT ON (";
      for (let i = 0; i < distinctOn.length; i++) {
        if (i !== 0) query.sql += ", ";
        query.sql += distinctOn[i].fullName;
      }
      query.sql += ") ";
    }
    const select = this.#$select;
    // Keys rather than entries: a projection of N items would otherwise allocate
    // N `[key, value]` pairs per query.
    const keys = select ? Object.keys(select) : [];
    if (select) {
      for (let i = 0; i < keys.length; i++) {
        if (i !== 0) query.sql += ", ";
        const key = keys[i];
        const item = select[key];
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
      }
    } else {
      query.sql += "*";
    }
    query.sql += " FROM ";
    query.sql += this.#table._.fullName;
    const joins = this.#$joins;
    if (joins) {
      for (const join of joins) {
        query.sql += join.type === "left" ? " LEFT JOIN " : " INNER JOIN ";
        query.sql += join.table._.fullName;
        query.sql += " ON ";
        join.on.toQuery(query);
      }
    }
    if (this.#$where) {
      query.sql += " WHERE ";
      this.#$where.toQuery(query);
    }
    if (this.#$groupBy?.length) {
      // Explicit GROUP BY — bypasses auto GROUP BY detection
      const groupBy = this.#$groupBy;
      query.sql += " GROUP BY ";
      for (let i = 0; i < groupBy.length; i++) {
        if (i !== 0) query.sql += ", ";
        const expr = groupBy[i];
        if (typeof expr === "string") {
          query.sql += `"${escIdentifier(expr)}"`;
        } else if (isScalarSqlFn(expr)) {
          expr.toQuery(query); // → floor(...)
        } else {
          query.sql += expr.fullName; // → "table"."col"
        }
      }
    } else if (select) {
      let hasAggregate = false;
      for (const key of keys) {
        const item = select[key];
        if (item instanceof SqlFn && item.isAggregate) {
          hasAggregate = true;
          break;
        }
      }
      if (hasAggregate) {
        const nonAggItems: Array<{ toQuery: (q: Query<unknown>) => void }> = [];
        // Columns are per-table singletons, so identity is a free key.
        const seenCols = new Set<StdTableColumn>();

        for (const key of keys) {
          const item = select[key];
          if (isTCol(item)) {
            const col = item as unknown as StdTableColumn;
            if (!seenCols.has(col)) {
              seenCols.add(col);
              nonAggItems.push(col);
            }
          } else if (item instanceof SqlFn && !item.isAggregate) {
            // `referencedColumns` is a rebuilding getter, so read it once.
            const refs =
              "referencedColumns" in item ? item.referencedColumns : undefined;
            if (Array.isArray(refs) && refs.length > 0) {
              for (const col of refs) {
                if (isTCol(col)) {
                  const tableCol = col;
                  if (!seenCols.has(tableCol)) {
                    seenCols.add(tableCol);
                    nonAggItems.push(tableCol);
                  }
                }
              }
            } else if (!(item instanceof SubquerySqlFn)) {
              nonAggItems.push(item);
            }
          }
        }

        if (nonAggItems.length > 0) {
          query.sql += " GROUP BY ";
          for (let i = 0; i < nonAggItems.length; i++) {
            if (i !== 0) query.sql += ", ";
            nonAggItems[i].toQuery(query);
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
        if (i !== 0) query.sql += ", ";
        orders[i].toQuery(query);
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
      if (!this.#selectRowsPlan) {
        this.#selectRowsPlan = buildSelectRowsPlan(
          this.#$select as Record<string, unknown>,
          Object.keys(rows[0]),
        );
      }
      const plan = this.#selectRowsPlan;
      const keys = plan.keys;
      const converts = plan.converts;
      const width = keys.length;
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        for (let i = 0; i < width; i++) {
          const key = keys[i];
          row[key] = converts[i](row[key]);
        }
      }
      return rows as TReturn;
    }
    if (rows.length === 0) return [] as TReturn;
    if (!this.#starRowsPlan) {
      this.#starRowsPlan = buildStarRowsPlan(
        this.#table as unknown as StdTableWithColumns,
        this.#$joins,
        Object.keys(rows[0]),
      );
    }
    return applyStarRowsPlan(rows, this.#starRowsPlan) as TReturn;
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <>
type AnySQ = SelectQuery<any, any, any, any, any, any, any, any>;

export type AnySelectQuery = AnySQ;
