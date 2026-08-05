import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import type { AnyScalarColumn } from "../table";
import type { Or } from "../types";
import { type AnySqlFn, type ExprColumns, type HasArg, SqlFn } from ".";

/**
 * Union of every valid operand for arithmetic operators:
 * a numeric column or SqlFn, a plain number literal, or an `Arg<number>`.
 */
export type NumericOperand =
  | ((AnyScalarColumn | AnySqlFn) & { $: { PgType: "numeric" } })
  | number
  | Arg<number>;

/**
 * Computes the `THasArg` slot for a two-operand arithmetic expression.
 * Resolves to `true` if either operand embeds an `Arg` or is itself an `Arg`.
 */
export type BinaryOpHasArg<
  TLeft extends NumericOperand,
  TRight extends NumericOperand,
> = Or<Or<HasArg<TLeft>, IsArg<TLeft>>, Or<HasArg<TRight>, IsArg<TRight>>>;

/**
 * Appends a single numeric operand fragment to the query.
 * Handles `Arg<number>`, literal `number`, and column/SqlFn operands.
 */
function numericExprToQuery(
  query: Query,
  ctx: QueryContext | undefined,
  operand: NumericOperand,
): void {
  if (is(operand, Arg<number>)) {
    query.addArg(operand);
  } else if (typeof operand === "number") {
    query.sql += operand.toString();
  } else {
    (operand as AnyScalarColumn | AnySqlFn).toQuery(query, ctx);
  }
}

// ============================================================================
// add
// ============================================================================

export class AddFn<
  TLeft extends NumericOperand,
  TRight extends NumericOperand,
> extends SqlFn<
  ExprColumns<TLeft> | ExprColumns<TRight>,
  BinaryOpHasArg<TLeft, TRight>,
  "scalar",
  "numeric",
  number
> {
  constructor(
    private readonly left: TLeft,
    private readonly right: TRight,
  ) {
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

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "(";
    numericExprToQuery(query, ctx, this.left);
    query.sql += " + ";
    numericExprToQuery(query, ctx, this.right);
    query.sql += ")";
  }
}

/** Returns the sum of two numeric expressions. */
export function add<
  TLeft extends NumericOperand,
  TRight extends NumericOperand,
>(left: TLeft, right: TRight): AddFn<TLeft, TRight> {
  return new AddFn(left, right);
}

// ============================================================================
// sub
// ============================================================================

export class SubFn<
  TLeft extends NumericOperand,
  TRight extends NumericOperand,
> extends SqlFn<
  ExprColumns<TLeft> | ExprColumns<TRight>,
  BinaryOpHasArg<TLeft, TRight>,
  "scalar",
  "numeric",
  number
> {
  constructor(
    private readonly left: TLeft,
    private readonly right: TRight,
  ) {
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

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "(";
    numericExprToQuery(query, ctx, this.left);
    query.sql += " - ";
    numericExprToQuery(query, ctx, this.right);
    query.sql += ")";
  }
}

/** Returns the difference of two numeric expressions. */
export function sub<
  TLeft extends NumericOperand,
  TRight extends NumericOperand,
>(left: TLeft, right: TRight): SubFn<TLeft, TRight> {
  return new SubFn(left, right);
}

// ============================================================================
// mul
// ============================================================================

export class MulFn<
  TLeft extends NumericOperand,
  TRight extends NumericOperand,
> extends SqlFn<
  ExprColumns<TLeft> | ExprColumns<TRight>,
  BinaryOpHasArg<TLeft, TRight>,
  "scalar",
  "numeric",
  number
> {
  constructor(
    private readonly left: TLeft,
    private readonly right: TRight,
  ) {
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

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "(";
    numericExprToQuery(query, ctx, this.left);
    query.sql += " * ";
    numericExprToQuery(query, ctx, this.right);
    query.sql += ")";
  }
}

/** Returns the product of two numeric expressions. */
export function mul<
  TLeft extends NumericOperand,
  TRight extends NumericOperand,
>(left: TLeft, right: TRight): MulFn<TLeft, TRight> {
  return new MulFn(left, right);
}

// ============================================================================
// div
// ============================================================================

export class DivFn<
  TLeft extends NumericOperand,
  TRight extends NumericOperand,
> extends SqlFn<
  ExprColumns<TLeft> | ExprColumns<TRight>,
  BinaryOpHasArg<TLeft, TRight>,
  "scalar",
  "numeric",
  number
> {
  constructor(
    private readonly left: TLeft,
    private readonly right: TRight,
  ) {
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

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "(";
    numericExprToQuery(query, ctx, this.left);
    query.sql += " / ";
    numericExprToQuery(query, ctx, this.right);
    query.sql += ")";
  }
}

/** Returns the quotient of two numeric expressions. */
export function div<
  TLeft extends NumericOperand,
  TRight extends NumericOperand,
>(left: TLeft, right: TRight): DivFn<TLeft, TRight> {
  return new DivFn(left, right);
}
