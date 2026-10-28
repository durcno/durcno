/**
 * PostgreSQL window functions and the `OVER (...)` clause.
 *
 * `.over()` is provided by `WindowableSqlFn`, the base of `AggregateSqlFn`
 * (aggregates used as window functions) and `PureWindowSqlFn` (`row_number`,
 * `rank`, ...). The result is a `WindowedSqlFn` that renders
 * `fn(...) OVER (spec)` and keeps the wrapped function's types.
 */

import { isCol } from "../entity";
import type { AnyFilterExpression } from "../filters";
import type { AnyOrder } from "../query-builders/orderby-clause";
import type { Query, QueryContext } from "../query-builders/query";
import { Sql } from "../sql";
import type { AnyColumn } from "../table";
import type { Or } from "../types";
import type { AggregateInput, OrderColumns, OrderHasArg } from "./aggregate";
import {
  type AnySqlFn,
  appendOperand,
  type ExprColumns,
  type HasArg,
  type NonAggregateSqlFn,
  SqlFn,
  type SqlFnRuntime,
  type SqlFnType,
} from "./index";

// ============================================================================
// Window spec
// ============================================================================

/** An expression allowed in `PARTITION BY`: a column, a non-aggregate function, or raw SQL. */
export type WindowPartitionItem = AnyColumn | NonAggregateSqlFn | Sql;

/** A single `PARTITION BY` item, or a list of them. */
export type WindowPartitionItems =
  | WindowPartitionItem
  | readonly WindowPartitionItem[];

/** Unions the referenced columns across the `PARTITION BY` items. */
export type WindowPartitionColumns<T> = T extends readonly (infer U)[]
  ? ExprColumns<U>
  : ExprColumns<T>;

/** A single `ORDER BY` item inside `OVER (...)`, or a list of them. */
export type WindowOrderItems = AnyOrder | readonly AnyOrder[];

/** Unions the referenced columns across the window `ORDER BY` items. */
export type WindowOrderColumns<T> = T extends readonly (infer U)[]
  ? OrderColumns<U>
  : OrderColumns<T>;

/** `true` when any window `ORDER BY` item may embed an `Arg` placeholder. */
export type WindowOrderHasArg<T> = T extends readonly (infer U)[]
  ? OrderHasArg<U>
  : OrderHasArg<T>;

// ============================================================================
// Frame clause
// ============================================================================

export type FrameKind = "rows" | "range" | "groups";

export type FrameExclude = "currentRow" | "group" | "ties" | "noOthers";

export type FrameEndpointKind =
  | "unboundedPreceding"
  | "preceding"
  | "currentRow"
  | "following"
  | "unboundedFollowing";

/** One endpoint of a frame clause: `UNBOUNDED PRECEDING`, `offset PRECEDING`, ... */
export class FrameEndpoint {
  constructor(
    readonly kind: FrameEndpointKind,
    readonly offset?: number | bigint | Sql,
  ) {}

  toQuery(query: Query): void {
    switch (this.kind) {
      case "unboundedPreceding":
        query.sql += "UNBOUNDED PRECEDING";
        break;
      case "preceding":
        this.appendOffset(query);
        query.sql += " PRECEDING";
        break;
      case "currentRow":
        query.sql += "CURRENT ROW";
        break;
      case "following":
        this.appendOffset(query);
        query.sql += " FOLLOWING";
        break;
      case "unboundedFollowing":
        query.sql += "UNBOUNDED FOLLOWING";
        break;
    }
  }

  private appendOffset(query: Query): void {
    if (this.offset instanceof Sql) {
      this.offset.toQuery(query);
    } else if (this.offset !== undefined) {
      query.sql += this.offset.toString();
    } else {
      throw new Error(`Frame endpoint "${this.kind}" requires an offset.`);
    }
  }
}

/** The `[ROWS | RANGE | GROUPS ...]` part of an `OVER` clause. */
export class FrameClause {
  constructor(
    readonly type: FrameKind,
    readonly start: FrameEndpoint,
    readonly end?: FrameEndpoint,
    readonly exclude?: FrameExclude,
  ) {}

  toQuery(query: Query): void {
    query.sql +=
      this.type === "rows"
        ? "ROWS"
        : this.type === "range"
          ? "RANGE"
          : "GROUPS";
    if (this.end) {
      query.sql += " BETWEEN ";
      this.start.toQuery(query);
      query.sql += " AND ";
      this.end.toQuery(query);
    } else {
      query.sql += " ";
      this.start.toQuery(query);
    }
    if (this.exclude) {
      query.sql +=
        this.exclude === "currentRow"
          ? " EXCLUDE CURRENT ROW"
          : this.exclude === "group"
            ? " EXCLUDE GROUP"
            : this.exclude === "ties"
              ? " EXCLUDE TIES"
              : " EXCLUDE NO OTHERS";
    }
  }
}

/** `ROWS [BETWEEN start AND end]` frame; without `end`, up to `CURRENT ROW`. */
export function rows(
  start: FrameEndpoint,
  end?: FrameEndpoint,
  exclude?: FrameExclude,
): FrameClause {
  return new FrameClause("rows", start, end, exclude);
}

/** `RANGE [BETWEEN start AND end]` frame; without `end`, up to `CURRENT ROW`. */
export function range(
  start: FrameEndpoint,
  end?: FrameEndpoint,
  exclude?: FrameExclude,
): FrameClause {
  return new FrameClause("range", start, end, exclude);
}

/** `GROUPS [BETWEEN start AND end]` frame; without `end`, up to `CURRENT ROW`. */
export function groups(
  start: FrameEndpoint,
  end?: FrameEndpoint,
  exclude?: FrameExclude,
): FrameClause {
  return new FrameClause("groups", start, end, exclude);
}

/** Frame endpoint `UNBOUNDED PRECEDING`. */
export function unboundedPreceding(): FrameEndpoint {
  return new FrameEndpoint("unboundedPreceding");
}

/** Frame endpoint `<offset> PRECEDING`. */
export function preceding(offset: number | bigint | Sql): FrameEndpoint {
  return new FrameEndpoint("preceding", offset);
}

/** Frame endpoint `CURRENT ROW`. */
export function currentRow(): FrameEndpoint {
  return new FrameEndpoint("currentRow");
}

/** Frame endpoint `<offset> FOLLOWING`. */
export function following(offset: number | bigint | Sql): FrameEndpoint {
  return new FrameEndpoint("following", offset);
}

/** Frame endpoint `UNBOUNDED FOLLOWING`. */
export function unboundedFollowing(): FrameEndpoint {
  return new FrameEndpoint("unboundedFollowing");
}

// ============================================================================
// WindowedSqlFn — a function with an `OVER (...)` clause attached
// ============================================================================

/**
 * A `SqlFn` with an `OVER (...)` clause: `fn(...) OVER (spec)`.
 * Value conversion is delegated to the wrapped function, so the result keeps
 * the wrapped function's types.
 *
 * `_.hasAggregate` is `true` on purpose: a windowed expression is refused in
 * the same clauses as an aggregate (`WHERE`, `ON`, `GROUP BY`, insert/set
 * values). `_.hasWindow` is `true` too, which keeps the auto-`GROUP BY` scan
 * from treating it as a grouped projection.
 *
 * @template TFn - The wrapped aggregate or pure window function.
 * @template TPartitionCols - Columns referenced by `PARTITION BY`.
 * @template TOrderCols - Columns referenced by the window `ORDER BY`.
 * @template THasArg - Whether any part embeds an `Arg` placeholder.
 */
export class WindowedSqlFn<
  TFn extends AnySqlFn,
  TPartitionCols extends AnyColumn = never,
  TOrderCols extends AnyColumn = never,
  THasArg extends boolean = false,
> extends SqlFn<
  TFn["$"]["Columns"] | TPartitionCols | TOrderCols,
  "window",
  TFn["$"]["PgType"],
  TFn["$"]["TsType"],
  THasArg,
  true
> {
  constructor(
    private readonly fn: TFn,
    private readonly partition: readonly WindowPartitionItem[] | undefined,
    private readonly orders: readonly AnyOrder[] | undefined,
    private readonly frame: FrameClause | undefined,
  ) {
    super(true, true, "window");
  }

  /** Appends `fn(...) OVER (spec)` to the query SQL. */
  toQuery(query: Query, ctx?: QueryContext): void {
    this.fn.toQuery(query, ctx);
    query.sql += " OVER (";
    let empty = true;
    if (this.partition?.length) {
      query.sql += "PARTITION BY ";
      for (let i = 0; i < this.partition.length; i++) {
        if (i !== 0) query.sql += ", ";
        this.partition[i].toQuery(query, ctx);
      }
      empty = false;
    }
    if (this.orders?.length) {
      if (!empty) query.sql += " ";
      query.sql += "ORDER BY ";
      for (let i = 0; i < this.orders.length; i++) {
        if (i !== 0) query.sql += ", ";
        this.orders[i].toQuery(query, ctx);
      }
      empty = false;
    }
    if (this.frame) {
      if (!empty) query.sql += " ";
      this.frame.toQuery(query);
      empty = false;
    }
    query.sql += ")";
  }

  toDriverValue(value: TFn["$"]["TsType"] | null): unknown {
    return this.fn.toDriverValue(value);
  }

  toSQLValue(value: TFn["$"]["TsType"] | null): string {
    return this.fn.toSQLValue(value);
  }

  fromDriverValue(value: unknown): TFn["$"]["TsType"] | null {
    return this.fn.fromDriverValue(value);
  }
}

// ============================================================================
// WindowableSqlFn — base for functions that accept an `OVER (...)` clause
// ============================================================================

/**
 * Base class for functions that can carry an `OVER (...)` clause: aggregates
 * used as window functions and pure window functions. `.over()` wraps the
 * function in a `WindowedSqlFn`.
 *
 * `_.hasAggregate` is `true` so a windowable expression is refused wherever an
 * aggregate is; `_.hasWindow` is what keeps it out of auto `GROUP BY`.
 *
 * @template TSqlFnType - `"aggregate"` for aggregates, `"window"` for pure window functions.
 */
export abstract class WindowableSqlFn<
  TColumn extends AnyColumn,
  TSqlFnType extends SqlFnType,
  TPgType extends string = string,
  TTsType = unknown,
  THasArg extends boolean = false,
> extends SqlFn<TColumn, TSqlFnType, TPgType, TTsType, THasArg, true> {
  declare readonly _: SqlFnRuntime<TSqlFnType, true> & {
    /** Appended `FILTER (WHERE ...)` condition. */
    filter?: AnyFilterExpression;
    /** Appended aggregate `ORDER BY` items. */
    orderBy?: AnyOrder[];
  };

  constructor(hasAggregate: boolean, hasWindow: boolean, sqlFnType: SqlFnType) {
    super(hasAggregate, hasWindow, sqlFnType);
  }

  /**
   * Attaches an `OVER (...)` clause, turning this function into a window
   * function call.
   *
   * @example
   * sum(orders.amount).over()
   * sum(orders.amount).over({ partitionBy: [orders.userId] })
   * count(orders.id).over({
   *   orderBy: [desc(orders.createdAt)],
   *   frame: rows(unboundedPreceding(), currentRow()),
   * })
   * rowNumber().over({ partitionBy: [orders.userId] })
   */
  over<
    TPartitionItems extends WindowPartitionItems | undefined = undefined,
    TOrderItems extends WindowOrderItems | undefined = undefined,
  >(spec?: {
    partitionBy?: TPartitionItems;
    orderBy?: TOrderItems;
    frame?: FrameClause;
  }): WindowedSqlFn<
    this,
    WindowPartitionColumns<TPartitionItems>,
    WindowOrderColumns<TOrderItems>,
    Or<this["$"]["HasArg"], WindowOrderHasArg<TOrderItems>>
  > {
    if (this._.orderBy?.length) {
      throw new Error(
        "Aggregate ORDER BY is not implemented for window functions. Move the ordering into the `.over({ orderBy })` spec.",
      );
    }
    const partition = spec?.partitionBy;
    const orders = spec?.orderBy;
    return new WindowedSqlFn(
      this,
      partition === undefined
        ? undefined
        : ((Array.isArray(partition)
            ? partition
            : [partition]) as readonly WindowPartitionItem[]),
      orders === undefined
        ? undefined
        : ((Array.isArray(orders) ? orders : [orders]) as readonly AnyOrder[]),
      spec?.frame,
    );
  }
}

// ============================================================================
// Pure window functions
// ============================================================================

/**
 * Base class for pure (non-aggregate) window functions — `row_number`, `rank`,
 * `lag`, and friends. PostgreSQL requires an `OVER (...)` clause on these;
 * without one, executing the query is rejected.
 */
export abstract class PureWindowSqlFn<
  TColumn extends AnyColumn,
  TPgType extends string,
  TTsType,
  THasArg extends boolean = false,
> extends WindowableSqlFn<TColumn, "window", TPgType, TTsType, THasArg> {
  constructor() {
    super(true, true, "window");
  }
}

/**
 * Shared value conversion for pure window functions whose result mirrors
 * their expression argument (`lag`, `lead`, `firstValue`, ...), the same way
 * `min`/`max` delegate to their operand.
 */
abstract class WindowExprFn<
  TExpr extends AggregateInput,
> extends PureWindowSqlFn<
  ExprColumns<TExpr>,
  string,
  TExpr["$"]["TsType"] | null,
  HasArg<TExpr>
> {
  constructor(protected readonly expr: TExpr) {
    super();
  }

  toDriverValue(value: TExpr["$"]["TsType"] | null): unknown {
    return value;
  }

  toSQLValue(value: TExpr["$"]["TsType"] | null): string {
    if (isCol(this.expr)) return this.expr.toSQLScalar(value as never);
    return this.expr.toSQLValue(value as never) as string;
  }

  fromDriverValue(value: unknown): TExpr["$"]["TsType"] | null {
    if (value === null) return null;
    if (isCol(this.expr))
      return this.expr.fromDriverScalar(value) as TExpr["$"]["TsType"];
    return this.expr.fromDriverValue(value) as TExpr["$"]["TsType"];
  }

  /** Appends `name(expr[, offset[, default]])` to the query SQL. */
  protected appendOffsetCall(
    query: Query,
    ctx: QueryContext | undefined,
    name: string,
    offset: number | bigint | undefined,
    fallback: TExpr["$"]["TsType"] | undefined,
  ): void {
    query.sql += `${name}(`;
    this.expr.toQuery(query, ctx);
    if (offset !== undefined) query.sql += `, ${offset.toString()}`;
    if (fallback !== undefined) {
      if (offset === undefined) query.sql += ", 1";
      query.sql += ", ";
      appendOperand(query, fallback, ctx);
    }
    query.sql += ")";
  }
}

/** SQL window expression `lag(expr[, offset[, default]])` — the previous partition row's value. */
export class LagFn<TExpr extends AggregateInput> extends WindowExprFn<TExpr> {
  constructor(
    expr: TExpr,
    private readonly offset?: number | bigint,
    private readonly fallback?: TExpr["$"]["TsType"],
  ) {
    super(expr);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    this.appendOffsetCall(query, ctx, "lag", this.offset, this.fallback);
  }
}

/** SQL window expression `lead(expr[, offset[, default]])` — the next partition row's value. */
export class LeadFn<TExpr extends AggregateInput> extends WindowExprFn<TExpr> {
  constructor(
    expr: TExpr,
    private readonly offset?: number | bigint,
    private readonly fallback?: TExpr["$"]["TsType"],
  ) {
    super(expr);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    this.appendOffsetCall(query, ctx, "lead", this.offset, this.fallback);
  }
}

/** SQL window expression `first_value(expr)` — the first row of the frame. */
export class FirstValueFn<
  TExpr extends AggregateInput,
> extends WindowExprFn<TExpr> {
  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "first_value(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/** SQL window expression `last_value(expr)` — the last row of the frame. */
export class LastValueFn<
  TExpr extends AggregateInput,
> extends WindowExprFn<TExpr> {
  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "last_value(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/** SQL window expression `nth_value(expr, n)` — the n-th row of the frame, 1-based. */
export class NthValueFn<
  TExpr extends AggregateInput,
> extends WindowExprFn<TExpr> {
  constructor(
    expr: TExpr,
    private readonly n: number | bigint,
  ) {
    super(expr);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "nth_value(";
    this.expr.toQuery(query, ctx);
    query.sql += `, ${this.n.toString()})`;
  }
}

// row_number / rank / dense_rank / percent_rank / cume_dist / ntile

/** SQL window expression `row_number()` — the row's 1-based position in its partition. */
export class RowNumberFn extends PureWindowSqlFn<never, "numeric", number> {
  toDriverValue(value: number | null): unknown {
    return value;
  }
  toSQLValue(value: number | null): string {
    return SqlFn._numericToSQL(value);
  }
  fromDriverValue(value: unknown): number | null {
    return SqlFn._numericFromDriver(value);
  }
  toQuery(query: Query): void {
    query.sql += "row_number()";
  }
}

/** SQL window expression `rank()` — rank with gaps for peer rows. */
export class RankFn extends PureWindowSqlFn<never, "numeric", number> {
  toDriverValue(value: number | null): unknown {
    return value;
  }
  toSQLValue(value: number | null): string {
    return SqlFn._numericToSQL(value);
  }
  fromDriverValue(value: unknown): number | null {
    return SqlFn._numericFromDriver(value);
  }
  toQuery(query: Query): void {
    query.sql += "rank()";
  }
}

/** SQL window expression `dense_rank()` — rank without gaps for peer rows. */
export class DenseRankFn extends PureWindowSqlFn<never, "numeric", number> {
  toDriverValue(value: number | null): unknown {
    return value;
  }
  toSQLValue(value: number | null): string {
    return SqlFn._numericToSQL(value);
  }
  fromDriverValue(value: unknown): number | null {
    return SqlFn._numericFromDriver(value);
  }
  toQuery(query: Query): void {
    query.sql += "dense_rank()";
  }
}

/** SQL window expression `percent_rank()` — relative rank between 0 and 1. */
export class PercentRankFn extends PureWindowSqlFn<never, "float", number> {
  toDriverValue(value: number | null): unknown {
    return value;
  }
  toSQLValue(value: number | null): string {
    return SqlFn._numericToSQL(value);
  }
  fromDriverValue(value: unknown): number | null {
    if (value === null) return null;
    return Number(value);
  }
  toQuery(query: Query): void {
    query.sql += "percent_rank()";
  }
}

/** SQL window expression `cume_dist()` — cumulative distribution between 0 and 1. */
export class CumeDistFn extends PureWindowSqlFn<never, "float", number> {
  toDriverValue(value: number | null): unknown {
    return value;
  }
  toSQLValue(value: number | null): string {
    return SqlFn._numericToSQL(value);
  }
  fromDriverValue(value: unknown): number | null {
    if (value === null) return null;
    return Number(value);
  }
  toQuery(query: Query): void {
    query.sql += "cume_dist()";
  }
}

/** SQL window expression `ntile(n)` — distributes rows into n roughly equal buckets. */
export class NtileFn extends PureWindowSqlFn<never, "numeric", number> {
  constructor(private readonly buckets: number | bigint) {
    super();
  }
  toDriverValue(value: number | null): unknown {
    return value;
  }
  toSQLValue(value: number | null): string {
    return SqlFn._numericToSQL(value);
  }
  fromDriverValue(value: unknown): number | null {
    return SqlFn._numericFromDriver(value);
  }
  toQuery(query: Query): void {
    query.sql += "ntile(";
    query.sql += this.buckets.toString();
    query.sql += ")";
  }
}

// ============================================================================
// Factories
// ============================================================================

/**
 * SQL window expression `row_number()` — the row's 1-based position within
 * its partition. Requires `.over(...)`.
 *
 * @example
 * db.from(Orders).select({
 *   position: rowNumber().over({ partitionBy: [Orders.userId] }),
 * });
 */
export function rowNumber(): RowNumberFn {
  return new RowNumberFn();
}

/**
 * SQL window expression `rank()` — the row's rank with gaps for peer rows.
 * Requires `.over(...)`.
 *
 * @example
 * db.from(Users).select({ rank: rank().over({ orderBy: [desc(Users.score)] }) });
 */
export function rank(): RankFn {
  return new RankFn();
}

/**
 * SQL window expression `dense_rank()` — the row's rank without gaps for
 * peer rows. Requires `.over(...)`.
 *
 * @example
 * db.from(Users).select({ rank: denseRank().over({ orderBy: [desc(Users.score)] }) });
 */
export function denseRank(): DenseRankFn {
  return new DenseRankFn();
}

/**
 * SQL window expression `percent_rank()` — the row's relative rank, between
 * 0 and 1. Requires `.over(...)`.
 *
 * @example
 * db.from(Users).select({ percentile: percentRank().over({ orderBy: [desc(Users.score)] }) });
 */
export function percentRank(): PercentRankFn {
  return new PercentRankFn();
}

/**
 * SQL window expression `cume_dist()` — the cumulative distribution of the
 * row, between 0 and 1. Requires `.over(...)`.
 *
 * @example
 * db.from(Users).select({ dist: cumeDist().over({ orderBy: [asc(Users.score)] }) });
 */
export function cumeDist(): CumeDistFn {
  return new CumeDistFn();
}

/**
 * SQL window expression `ntile(n)` — distributes the partition's rows into n
 * roughly equal buckets. Requires `.over(...)`.
 *
 * @example
 * db.from(Users).select({ quartile: ntile(4).over({ orderBy: [desc(Users.score)] }) });
 */
export function ntile(buckets: number | bigint): NtileFn {
  return new NtileFn(buckets);
}

/**
 * SQL window expression `lag(expr[, offset[, default]])` — the value of
 * `expr` from the row `offset` places before the current one (1 by default),
 * or `default` when out of the partition. Requires `.over(...)`.
 *
 * @example
 * db.from(Orders).select({
 *   previousTotal: lag(Orders.total, 1).over({ orderBy: [asc(Orders.createdAt)] }),
 * });
 */
export function lag<TExpr extends AggregateInput>(
  expr: TExpr,
  offset?: number | bigint,
  fallback?: TExpr["$"]["TsType"],
): LagFn<TExpr> {
  return new LagFn(expr, offset, fallback);
}

/**
 * SQL window expression `lead(expr[, offset[, default]])` — the value of
 * `expr` from the row `offset` places after the current one (1 by default),
 * or `default` when out of the partition. Requires `.over(...)`.
 *
 * @example
 * db.from(Orders).select({
 *   nextTotal: lead(Orders.total).over({ orderBy: [asc(Orders.createdAt)] }),
 * });
 */
export function lead<TExpr extends AggregateInput>(
  expr: TExpr,
  offset?: number | bigint,
  fallback?: TExpr["$"]["TsType"],
): LeadFn<TExpr> {
  return new LeadFn(expr, offset, fallback);
}

/**
 * SQL window expression `first_value(expr)` — the value of `expr` from the
 * first row of the frame. Requires `.over(...)`.
 *
 * @example
 * db.from(Orders).select({
 *   firstOrder: firstValue(Orders.createdAt).over({ partitionBy: [Orders.userId] }),
 * });
 */
export function firstValue<TExpr extends AggregateInput>(
  expr: TExpr,
): FirstValueFn<TExpr> {
  return new FirstValueFn(expr);
}

/**
 * SQL window expression `last_value(expr)` — the value of `expr` from the
 * last row of the frame. Requires `.over(...)`.
 *
 * @example
 * db.from(Orders).select({
 *   latestOrder: lastValue(Orders.createdAt).over({ partitionBy: [Orders.userId] }),
 * });
 */
export function lastValue<TExpr extends AggregateInput>(
  expr: TExpr,
): LastValueFn<TExpr> {
  return new LastValueFn(expr);
}

/**
 * SQL window expression `nth_value(expr, n)` — the value of `expr` from the
 * n-th row of the frame, 1-based. Requires `.over(...)`.
 *
 * @example
 * db.from(Orders).select({
 *   secondOrder: nthValue(Orders.createdAt, 2).over({ partitionBy: [Orders.userId] }),
 * });
 */
export function nthValue<TExpr extends AggregateInput>(
  expr: TExpr,
  n: number | bigint,
): NthValueFn<TExpr> {
  return new NthValueFn(expr, n);
}
