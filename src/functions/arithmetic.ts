import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import { Sql } from "../sql";
import type { AnyScalarColumn } from "../table";
import type { Or } from "../types";
import {
  type AnySqlFn,
  type ExprColumns,
  type HasArg,
  SqlFn,
  type StrictFnReturn,
} from "./index";

/**
 * Union of every valid operand for arithmetic operators:
 * a numeric column or SqlFn, a plain number/bigint literal, an `Arg`, or a typed `Sql`.
 */
export type NumericOperand =
  | ((AnyScalarColumn | AnySqlFn) & { $: { PgType: "numeric" | "float" } })
  | number
  | bigint
  | Arg<number>
  | Arg<bigint>
  | Sql<number>
  | Sql<bigint>
  | null;

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
 * Handles `null`, `Arg`, literal numbers/bigints, `Sql`, and column/SqlFn operands.
 */
function numericExprToQuery(
  query: Query,
  ctx: QueryContext | undefined,
  operand: NumericOperand,
): void {
  if (operand === null) {
    query.sql += "NULL";
  } else if (is(operand, Arg)) {
    query.addArg(operand);
  } else if (typeof operand === "number" || typeof operand === "bigint") {
    query.sql += operand.toString();
  } else if (operand instanceof Sql) {
    operand.toQuery(query, ctx);
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
  TTsType = StrictFnReturn<[TLeft, TRight], number>,
> extends SqlFn<
  ExprColumns<TLeft> | ExprColumns<TRight>,
  BinaryOpHasArg<TLeft, TRight>,
  "scalar",
  "numeric",
  TTsType
> {
  constructor(
    private readonly left: TLeft,
    private readonly right: TRight,
  ) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return SqlFn._numericToSQL(value as number | null);
  }
  fromDriverValue(value: unknown): TTsType | null {
    return SqlFn._numericFromDriver(value) as TTsType | null;
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
>(
  left: TLeft,
  right: TRight,
): AddFn<TLeft, TRight, StrictFnReturn<[TLeft, TRight], number>> {
  return new AddFn(left, right);
}

// ============================================================================
// sub
// ============================================================================

export class SubFn<
  TLeft extends NumericOperand,
  TRight extends NumericOperand,
  TTsType = StrictFnReturn<[TLeft, TRight], number>,
> extends SqlFn<
  ExprColumns<TLeft> | ExprColumns<TRight>,
  BinaryOpHasArg<TLeft, TRight>,
  "scalar",
  "numeric",
  TTsType
> {
  constructor(
    private readonly left: TLeft,
    private readonly right: TRight,
  ) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return SqlFn._numericToSQL(value as number | null);
  }
  fromDriverValue(value: unknown): TTsType | null {
    return SqlFn._numericFromDriver(value) as TTsType | null;
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
>(
  left: TLeft,
  right: TRight,
): SubFn<TLeft, TRight, StrictFnReturn<[TLeft, TRight], number>> {
  return new SubFn(left, right);
}

// ============================================================================
// mul
// ============================================================================

export class MulFn<
  TLeft extends NumericOperand,
  TRight extends NumericOperand,
  TTsType = StrictFnReturn<[TLeft, TRight], number>,
> extends SqlFn<
  ExprColumns<TLeft> | ExprColumns<TRight>,
  BinaryOpHasArg<TLeft, TRight>,
  "scalar",
  "numeric",
  TTsType
> {
  constructor(
    private readonly left: TLeft,
    private readonly right: TRight,
  ) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return SqlFn._numericToSQL(value as number | null);
  }
  fromDriverValue(value: unknown): TTsType | null {
    return SqlFn._numericFromDriver(value) as TTsType | null;
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
>(
  left: TLeft,
  right: TRight,
): MulFn<TLeft, TRight, StrictFnReturn<[TLeft, TRight], number>> {
  return new MulFn(left, right);
}

// ============================================================================
// div
// ============================================================================

export class DivFn<
  TLeft extends NumericOperand,
  TRight extends NumericOperand,
  TTsType = StrictFnReturn<[TLeft, TRight], number>,
> extends SqlFn<
  ExprColumns<TLeft> | ExprColumns<TRight>,
  BinaryOpHasArg<TLeft, TRight>,
  "scalar",
  "numeric",
  TTsType
> {
  constructor(
    private readonly left: TLeft,
    private readonly right: TRight,
  ) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return SqlFn._numericToSQL(value as number | null);
  }
  fromDriverValue(value: unknown): TTsType | null {
    return SqlFn._numericFromDriver(value) as TTsType | null;
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
>(
  left: TLeft,
  right: TRight,
): DivFn<TLeft, TRight, StrictFnReturn<[TLeft, TRight], number>> {
  return new DivFn(left, right);
}
