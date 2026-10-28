import { is, isTCol } from "../entity";
import {
  type AnySqlFn,
  containsAggregate,
  containsWindow,
  type HasAggregateOf,
  type HasAggregateOfConditions,
  type NonAggregateSqlFn,
  type RuntimeFlags,
  SqlFn,
} from "../functions";
import {
  type NormalizedOperand,
  type NormalizedScalar,
  normalizeScalar,
  type ScalarArg,
  type ScalarQueryLike,
} from "../functions/subquery";
import { Arg, type IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import { Sql, toSqlValue } from "../sql";
import type { AnyColumn } from "../table";
import type { BasicTypes, Or } from "../types";

/**
 * Abstract base class for SQL filter expressions to be used in
 * `WHERE`/`HAVING`/`ON`/`CHECK` clauses.
 *
 * Analogous to `SqlFn` but for SQL filter expressions.
 */
export abstract class Filter<
  TColumns extends AnyColumn = AnyColumn,
  THasArg extends boolean = false,
  THasAggregate extends boolean = false,
> {
  readonly $!: {
    /** The columns this filter is applied to. */
    Columns: TColumns;
    /** `true` when this filter embeds at least one `Arg` placeholder. */
    HasArg: THasArg;
  };

  /** Runtime state, including the precise aggregate/window flags. */
  readonly _: RuntimeFlags<THasAggregate>;

  constructor(hasAggregate = false, hasWindow = false) {
    this._ = {
      hasAggregate: hasAggregate as THasAggregate,
      hasWindow,
    };
  }

  /** Columns this predicate reads, or `null` when they cannot be enumerated. */
  get referencedColumns(): AnyColumn[] | null {
    return null;
  }

  abstract toQuery(query: Query, ctx?: QueryContext): void;
}

/** Convenience alias for a `Filter` with all type parameters widened to `any`. */
export type AnyFilter = Filter<AnyColumn, boolean>;

/**
 * Constrains a filter expression to columns allowed in the current query scope.
 * Accepts either a `Filter` whose `$.Columns` is assignable to `TScopeColumns`,
 * or a raw `Sql` snippet. When `TArg` is `true`, filters carrying `Arg`
 * placeholders are also accepted (prepared-query context).
 *
 * Aggregates are excluded; see `GroupedFilterExpression` for the `HAVING` shape.
 */
export type FilterExpression<
  TScopeColumns extends AnyColumn,
  TPrepare extends boolean = false,
> = Filter<TScopeColumns, TPrepare extends true ? boolean : false> | Sql;

export type StdCondition = FilterExpression<AnyColumn>;

export type AnyFilterExpression = FilterExpression<AnyColumn, boolean>;

/**
 * A `FilterExpression` that may contain an aggregate, for `HAVING` and grouped
 * `CASE WHEN` conditions.
 */
export type GroupedFilterExpression<
  TScopeColumns extends AnyColumn,
  TPrepare extends boolean = false,
> =
  | Filter<TScopeColumns, TPrepare extends true ? boolean : false, boolean>
  | Sql;

/** A `HAVING` expression; accepts aggregates. */
export type HavingExpression<
  TScopeColumns extends AnyColumn,
  TPrepare extends boolean = false,
> = GroupedFilterExpression<TScopeColumns, TPrepare>;

type HasArg<T> = T extends { $: { HasArg: true } } ? true : false;

/** Right operand accepted by a comparison whose left side is a table column. */
export type ColumnComparisonRight<TLeft extends AnyColumn> =
  | TLeft["ValType"]
  | Arg<TLeft["ValType"]>
  | AnyColumn
  | NonAggregateSqlFn
  | ScalarQueryLike;

/** Right operand accepted by a comparison whose left side is a value expression. */
export type SqlFnComparisonRight = BasicTypes | AnySqlFn | ScalarQueryLike;

export class ComparisonLeftIsColumn<
  TLeft extends AnyColumn,
  TOp extends string,
  TRight extends ColumnComparisonRight<TLeft>,
> extends Filter<TLeft, Or<IsArg<TRight>, HasArg<TRight>>> {
  readonly left: TLeft;
  readonly op: TOp;
  readonly right: TRight;
  constructor(field: TLeft, op: TOp, right: TRight) {
    super(SqlFn._hasAggregate(right), SqlFn._hasWindow(right));
    this.left = field;
    this.op = op;
    this.right = right;
  }
  get referencedColumns(): AnyColumn[] | null {
    const right = operandColumns(this.right);
    return right === null ? null : [this.left, ...right];
  }
  toQuery(query: Query, ctx?: QueryContext): void {
    this.left.toQuery(query, ctx);
    query.sql += ` ${this.op} `;
    if (is(this.right, Arg<TLeft["ValType"]>)) {
      query.addArg(this.right);
    } else if (isTCol(this.right)) {
      this.right.toQuery(query, ctx);
    } else if (this.right instanceof SqlFn) {
      this.right.toQuery(query, ctx);
    } else {
      query.sql += this.left.toSQLExpression(this.right);
    }
  }
}

export class ComparisonLeftIsSqlFn<
  TLeft extends AnySqlFn,
  TOp extends string,
  TRight extends SqlFnComparisonRight,
> extends Filter<
  | TLeft["$"]["Columns"]
  | (TRight extends NonAggregateSqlFn ? TRight["$"]["Columns"] : never),
  HasArg<TLeft> extends true ? true : HasArg<TRight>,
  HasAggregateOf<TLeft | TRight>
> {
  readonly left: TLeft;
  readonly op: TOp;
  readonly right: TRight;
  constructor(field: TLeft, op: TOp, right: TRight) {
    super(
      SqlFn._hasAggregate(field) || SqlFn._hasAggregate(right),
      SqlFn._hasWindow(field) || SqlFn._hasWindow(right),
    );
    this.left = field;
    this.op = op;
    this.right = right;
  }
  get referencedColumns(): AnyColumn[] | null {
    const left = operandColumns(this.left);
    if (left === null) return null;
    const right = operandColumns(this.right);
    return right === null ? null : [...left, ...right];
  }
  toQuery(query: Query, ctx?: QueryContext): void {
    this.left.toQuery(query, ctx);
    query.sql += ` ${this.op} `;
    if (this.right instanceof SqlFn) {
      this.right.toQuery(query, ctx);
    } else {
      query.sql += toSqlValue(this.right as never);
    }
  }
}

export function eq<TLeft extends AnyColumn, TRight extends TLeft["ValType"]>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsColumn<
  TLeft,
  "=",
  NormalizedOperand<TRight, NonAggregateSqlFn>
>;
export function eq<
  TLeft extends AnyColumn,
  TRight extends ColumnComparisonRight<TLeft>,
>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsColumn<
  TLeft,
  "=",
  NormalizedOperand<TRight, NonAggregateSqlFn>
>;
export function eq<TLeft extends AnySqlFn, TRight extends BasicTypes>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "=", NormalizedOperand<TRight, AnySqlFn>>;
export function eq<TLeft extends AnySqlFn, TRight extends SqlFnComparisonRight>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "=", NormalizedOperand<TRight, AnySqlFn>>;
export function eq<TLeft extends ScalarQueryLike, TRight extends BasicTypes>(
  left: ScalarArg<TLeft>,
  right: TRight,
): ComparisonLeftIsSqlFn<NormalizedScalar<TLeft> & AnySqlFn, "=", TRight>;
export function eq<
  TLeft extends ScalarQueryLike,
  TRight extends SqlFnComparisonRight,
>(
  left: ScalarArg<TLeft>,
  right: TRight,
): ComparisonLeftIsSqlFn<
  NormalizedScalar<TLeft> & AnySqlFn,
  "=",
  NormalizedOperand<TRight, AnySqlFn>
>;
export function eq(
  left: AnyColumn | AnySqlFn | ScalarQueryLike,
  right:
    | AnyColumn["ValType"]
    | Arg<AnyColumn["ValType"]>
    | AnyColumn
    | AnySqlFn
    | ScalarQueryLike,
): never {
  const leftExpr = normalizeScalar(left);
  const rightExpr = normalizeScalar(right);
  if (isTCol(leftExpr)) {
    return new ComparisonLeftIsColumn(
      leftExpr as never,
      "=",
      rightExpr as never,
    ) as never;
  } else {
    return new ComparisonLeftIsSqlFn(
      leftExpr as AnySqlFn,
      "=",
      rightExpr as never,
    ) as never;
  }
}

export function ne<TLeft extends AnyColumn, TRight extends TLeft["ValType"]>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsColumn<
  TLeft,
  "!=",
  NormalizedOperand<TRight, NonAggregateSqlFn>
>;
export function ne<
  TLeft extends AnyColumn,
  TRight extends ColumnComparisonRight<TLeft>,
>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsColumn<
  TLeft,
  "!=",
  NormalizedOperand<TRight, NonAggregateSqlFn>
>;
export function ne<TLeft extends AnySqlFn, TRight extends BasicTypes>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "!=", NormalizedOperand<TRight, AnySqlFn>>;
export function ne<TLeft extends AnySqlFn, TRight extends SqlFnComparisonRight>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "!=", NormalizedOperand<TRight, AnySqlFn>>;
export function ne<TLeft extends ScalarQueryLike, TRight extends BasicTypes>(
  left: ScalarArg<TLeft>,
  right: TRight,
): ComparisonLeftIsSqlFn<NormalizedScalar<TLeft> & AnySqlFn, "!=", TRight>;
export function ne<
  TLeft extends ScalarQueryLike,
  TRight extends SqlFnComparisonRight,
>(
  left: ScalarArg<TLeft>,
  right: TRight,
): ComparisonLeftIsSqlFn<
  NormalizedScalar<TLeft> & AnySqlFn,
  "!=",
  NormalizedOperand<TRight, AnySqlFn>
>;
export function ne(
  left: AnyColumn | AnySqlFn | ScalarQueryLike,
  right:
    | AnyColumn["ValType"]
    | Arg<AnyColumn["ValType"]>
    | AnyColumn
    | AnySqlFn
    | ScalarQueryLike,
): never {
  const leftExpr = normalizeScalar(left);
  const rightExpr = normalizeScalar(right);
  if (isTCol(leftExpr)) {
    return new ComparisonLeftIsColumn(
      leftExpr as never,
      "!=",
      rightExpr as never,
    ) as never;
  } else {
    return new ComparisonLeftIsSqlFn(
      leftExpr as AnySqlFn,
      "!=",
      rightExpr as never,
    ) as never;
  }
}

export function gt<TLeft extends AnyColumn, TRight extends TLeft["ValType"]>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsColumn<
  TLeft,
  ">",
  NormalizedOperand<TRight, NonAggregateSqlFn>
>;
export function gt<
  TLeft extends AnyColumn,
  TRight extends ColumnComparisonRight<TLeft>,
>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsColumn<
  TLeft,
  ">",
  NormalizedOperand<TRight, NonAggregateSqlFn>
>;
export function gt<TLeft extends AnySqlFn, TRight extends BasicTypes>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, ">", NormalizedOperand<TRight, AnySqlFn>>;
export function gt<TLeft extends AnySqlFn, TRight extends SqlFnComparisonRight>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, ">", NormalizedOperand<TRight, AnySqlFn>>;
export function gt<TLeft extends ScalarQueryLike, TRight extends BasicTypes>(
  left: ScalarArg<TLeft>,
  right: TRight,
): ComparisonLeftIsSqlFn<NormalizedScalar<TLeft> & AnySqlFn, ">", TRight>;
export function gt<
  TLeft extends ScalarQueryLike,
  TRight extends SqlFnComparisonRight,
>(
  left: ScalarArg<TLeft>,
  right: TRight,
): ComparisonLeftIsSqlFn<
  NormalizedScalar<TLeft> & AnySqlFn,
  ">",
  NormalizedOperand<TRight, AnySqlFn>
>;
export function gt(
  left: AnyColumn | AnySqlFn | ScalarQueryLike,
  right:
    | AnyColumn["ValType"]
    | Arg<AnyColumn["ValType"]>
    | AnyColumn
    | AnySqlFn
    | ScalarQueryLike,
): never {
  const leftExpr = normalizeScalar(left);
  const rightExpr = normalizeScalar(right);
  if (isTCol(leftExpr)) {
    return new ComparisonLeftIsColumn(
      leftExpr as never,
      ">",
      rightExpr as never,
    ) as never;
  } else {
    return new ComparisonLeftIsSqlFn(
      leftExpr as AnySqlFn,
      ">",
      rightExpr as never,
    ) as never;
  }
}

export function gte<TLeft extends AnyColumn, TRight extends TLeft["ValType"]>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsColumn<
  TLeft,
  ">=",
  NormalizedOperand<TRight, NonAggregateSqlFn>
>;
export function gte<
  TLeft extends AnyColumn,
  TRight extends ColumnComparisonRight<TLeft>,
>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsColumn<
  TLeft,
  ">=",
  NormalizedOperand<TRight, NonAggregateSqlFn>
>;
export function gte<TLeft extends AnySqlFn, TRight extends BasicTypes>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, ">=", NormalizedOperand<TRight, AnySqlFn>>;
export function gte<
  TLeft extends AnySqlFn,
  TRight extends SqlFnComparisonRight,
>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, ">=", NormalizedOperand<TRight, AnySqlFn>>;
export function gte<TLeft extends ScalarQueryLike, TRight extends BasicTypes>(
  left: ScalarArg<TLeft>,
  right: TRight,
): ComparisonLeftIsSqlFn<NormalizedScalar<TLeft> & AnySqlFn, ">=", TRight>;
export function gte<
  TLeft extends ScalarQueryLike,
  TRight extends SqlFnComparisonRight,
>(
  left: ScalarArg<TLeft>,
  right: TRight,
): ComparisonLeftIsSqlFn<
  NormalizedScalar<TLeft> & AnySqlFn,
  ">=",
  NormalizedOperand<TRight, AnySqlFn>
>;
export function gte(
  left: AnyColumn | AnySqlFn | ScalarQueryLike,
  right:
    | AnyColumn["ValType"]
    | Arg<AnyColumn["ValType"]>
    | AnyColumn
    | AnySqlFn
    | ScalarQueryLike,
): never {
  const leftExpr = normalizeScalar(left);
  const rightExpr = normalizeScalar(right);
  if (isTCol(leftExpr)) {
    return new ComparisonLeftIsColumn(
      leftExpr as never,
      ">=",
      rightExpr as never,
    ) as never;
  } else {
    return new ComparisonLeftIsSqlFn(
      leftExpr as AnySqlFn,
      ">=",
      rightExpr as never,
    ) as never;
  }
}

export function lt<TLeft extends AnyColumn, TRight extends TLeft["ValType"]>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsColumn<
  TLeft,
  "<",
  NormalizedOperand<TRight, NonAggregateSqlFn>
>;
export function lt<
  TLeft extends AnyColumn,
  TRight extends ColumnComparisonRight<TLeft>,
>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsColumn<
  TLeft,
  "<",
  NormalizedOperand<TRight, NonAggregateSqlFn>
>;
export function lt<TLeft extends AnySqlFn, TRight extends BasicTypes>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "<", NormalizedOperand<TRight, AnySqlFn>>;
export function lt<TLeft extends AnySqlFn, TRight extends SqlFnComparisonRight>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "<", NormalizedOperand<TRight, AnySqlFn>>;
export function lt<TLeft extends ScalarQueryLike, TRight extends BasicTypes>(
  left: ScalarArg<TLeft>,
  right: TRight,
): ComparisonLeftIsSqlFn<NormalizedScalar<TLeft> & AnySqlFn, "<", TRight>;
export function lt<
  TLeft extends ScalarQueryLike,
  TRight extends SqlFnComparisonRight,
>(
  left: ScalarArg<TLeft>,
  right: TRight,
): ComparisonLeftIsSqlFn<
  NormalizedScalar<TLeft> & AnySqlFn,
  "<",
  NormalizedOperand<TRight, AnySqlFn>
>;
export function lt(
  left: AnyColumn | AnySqlFn | ScalarQueryLike,
  right:
    | AnyColumn["ValType"]
    | Arg<AnyColumn["ValType"]>
    | AnyColumn
    | AnySqlFn
    | ScalarQueryLike,
): never {
  const leftExpr = normalizeScalar(left);
  const rightExpr = normalizeScalar(right);
  if (isTCol(leftExpr)) {
    return new ComparisonLeftIsColumn(
      leftExpr as never,
      "<",
      rightExpr as never,
    ) as never;
  } else {
    return new ComparisonLeftIsSqlFn(
      leftExpr as AnySqlFn,
      "<",
      rightExpr as never,
    ) as never;
  }
}

export function lte<TLeft extends AnyColumn, TRight extends TLeft["ValType"]>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsColumn<
  TLeft,
  "<=",
  NormalizedOperand<TRight, NonAggregateSqlFn>
>;
export function lte<
  TLeft extends AnyColumn,
  TRight extends ColumnComparisonRight<TLeft>,
>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsColumn<
  TLeft,
  "<=",
  NormalizedOperand<TRight, NonAggregateSqlFn>
>;
export function lte<TLeft extends AnySqlFn, TRight extends BasicTypes>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "<=", NormalizedOperand<TRight, AnySqlFn>>;
export function lte<
  TLeft extends AnySqlFn,
  TRight extends SqlFnComparisonRight,
>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "<=", NormalizedOperand<TRight, AnySqlFn>>;
export function lte<TLeft extends ScalarQueryLike, TRight extends BasicTypes>(
  left: ScalarArg<TLeft>,
  right: TRight,
): ComparisonLeftIsSqlFn<NormalizedScalar<TLeft> & AnySqlFn, "<=", TRight>;
export function lte<
  TLeft extends ScalarQueryLike,
  TRight extends SqlFnComparisonRight,
>(
  left: ScalarArg<TLeft>,
  right: TRight,
): ComparisonLeftIsSqlFn<
  NormalizedScalar<TLeft> & AnySqlFn,
  "<=",
  NormalizedOperand<TRight, AnySqlFn>
>;
export function lte(
  left: AnyColumn | AnySqlFn | ScalarQueryLike,
  right:
    | AnyColumn["ValType"]
    | Arg<AnyColumn["ValType"]>
    | AnyColumn
    | AnySqlFn
    | ScalarQueryLike,
): never {
  const leftExpr = normalizeScalar(left);
  const rightExpr = normalizeScalar(right);
  if (isTCol(leftExpr)) {
    return new ComparisonLeftIsColumn(
      leftExpr as never,
      "<=",
      rightExpr as never,
    ) as never;
  } else {
    return new ComparisonLeftIsSqlFn(
      leftExpr as AnySqlFn,
      "<=",
      rightExpr as never,
    ) as never;
  }
}

export class IsNullCondition<TCol extends AnyColumn> extends Filter<
  TCol,
  false
> {
  readonly field: TCol;
  constructor(field: TCol) {
    super();
    this.field = field;
  }
  get referencedColumns(): AnyColumn[] {
    return [this.field];
  }
  toQuery(query: Query, ctx?: QueryContext): void {
    this.field.toQuery(query, ctx);
    query.sql += " IS NULL";
  }
}

export function isNull<TCol extends AnyColumn>(field: TCol) {
  return new IsNullCondition(field);
}

export class IsNotNullCondition<TCol extends AnyColumn> extends Filter<
  TCol,
  false
> {
  readonly field: TCol;
  constructor(field: TCol) {
    super();
    this.field = field;
  }
  get referencedColumns(): AnyColumn[] {
    return [this.field];
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    this.field.toQuery(query, ctx);
    query.sql += " IS NOT NULL";
  }
}

export function isNotNull<TCol extends AnyColumn>(field: TCol) {
  return new IsNotNullCondition(field);
}

/** @internal Filter shape `and()`/`or()` accept, aggregate flag open. */
type AnySqlFilter = Filter<AnyColumn, boolean, boolean>;

/** @internal Union of table columns from all Filter conditions in the array. */
type Filters = AnySqlFilter | Sql | null | undefined;

type ExtractCols<T extends Filters> = T extends { $: { Columns: infer C } }
  ? C
  : never;

/** @internal `true` when at least one Filter condition in the array carries an Arg placeholder. */
type HasArgOf<T extends Filters[]> = [CondHasArg<T[number]>] extends [false]
  ? false
  : true;

type CondHasArg<T> = T extends { $: { HasArg: infer H } } ? H : false;

export class AndCondition<TConditions extends Filters[]> extends Filter<
  ExtractCols<TConditions[number]>,
  HasArgOf<TConditions>,
  HasAggregateOfConditions<TConditions>
> {
  readonly conditions: TConditions;
  constructor(...conditions: TConditions) {
    super(containsAggregate(conditions), containsWindow(conditions));
    this.conditions = conditions;
  }
  get referencedColumns(): AnyColumn[] | null {
    const cols: AnyColumn[] = [];
    for (const condition of this.conditions) {
      const refs = filterReferencedColumns(condition);
      if (refs === null) return null;
      cols.push(...refs);
    }
    return cols;
  }
  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "(";
    let first = true;
    for (const condition of this.conditions) {
      if (condition === null || condition === undefined) continue;
      if (!first) query.sql += " AND ";
      first = false;
      condition.toQuery(query, ctx);
    }
    query.sql += ")";
  }
}

export function and<TConditions extends Filters[]>(
  ...conditions: TConditions
): AndCondition<TConditions> {
  return new AndCondition(...conditions);
}

export class OrCondition<TConditions extends Filters[]> extends Filter<
  ExtractCols<TConditions[number]>,
  HasArgOf<TConditions>,
  HasAggregateOfConditions<TConditions>
> {
  readonly conditions: TConditions;
  constructor(...conditions: TConditions) {
    super(containsAggregate(conditions), containsWindow(conditions));
    this.conditions = conditions;
  }
  get referencedColumns(): AnyColumn[] | null {
    const cols: AnyColumn[] = [];
    for (const condition of this.conditions) {
      const refs = filterReferencedColumns(condition);
      if (refs === null) return null;
      cols.push(...refs);
    }
    return cols;
  }
  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "(";
    let first = true;
    for (const condition of this.conditions) {
      if (condition === null || condition === undefined) continue;
      if (!first) query.sql += " OR ";
      first = false;
      condition.toQuery(query, ctx);
    }
    query.sql += ")";
  }
}

export function or<TConditions extends Filters[]>(
  ...conditions: TConditions
): OrCondition<TConditions> {
  return new OrCondition(...conditions);
}

/** Columns a condition reads, or `null` when it does not publish them. */
export function filterReferencedColumns(filter: unknown): AnyColumn[] | null {
  if (filter === null || typeof filter !== "object") return null;
  const refs = (filter as { referencedColumns?: unknown }).referencedColumns;
  return Array.isArray(refs) ? (refs as AnyColumn[]) : null;
}

/** Columns an operand contributes as a grouping key; `null` when unknown. */
function operandColumns(operand: unknown): AnyColumn[] | null {
  if (isTCol(operand)) return [operand];
  if (operand instanceof SqlFn) {
    const refs = (operand as { referencedColumns?: unknown }).referencedColumns;
    return Array.isArray(refs) ? (refs as AnyColumn[]) : null;
  }
  if (operand instanceof Filter || operand instanceof Sql) return null;
  return [];
}
