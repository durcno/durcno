import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import { Sql } from "../sql";
import type { AnyScalarColumn } from "../table";
import type { Or } from "../types";
import {
  type AnySqlFn,
  type ExprColumns,
  type HasAggregateOf,
  type HasArg,
  SqlFn,
  type StrictFnReturn,
} from "./index";
import {
  type NormalizedTypedOperand,
  normalizeTypedScalar,
  type PgTypedOperand,
  type ScalarQueryLike,
  type TypedScalarArg,
} from "./subquery";

export type NumericExpr =
  | PgTypedOperand<"numeric" | "float">
  | ScalarQueryLike
  | number
  | bigint
  | Arg<number>
  | Arg<bigint>
  | Sql<number>
  | Sql<bigint>
  | null;

/** A numeric expression after scalar-query normalization. */
type NormalizedNumeric<T> = NormalizedTypedOperand<T, "numeric" | "float">;

/** Normalizes a numeric operand and narrows it to the numeric expression branch. */
function normalizeNumeric<T extends NumericExpr>(
  expr: TypedScalarArg<T, "numeric" | "float">,
): NormalizedNumeric<T> {
  return normalizeTypedScalar(expr);
}

function appendNumericExpr(
  query: Query,
  expr: NumericExpr,
  ctx?: QueryContext,
) {
  if (expr === null) {
    query.sql += "NULL";
  } else if (typeof expr === "number" || typeof expr === "bigint") {
    query.sql += expr.toString();
  } else if (is(expr, Arg)) {
    query.addArg(expr);
  } else if (expr instanceof Sql) {
    expr.toQuery(query, ctx);
  } else {
    (expr as AnyScalarColumn | AnySqlFn).toQuery(query, ctx);
  }
}

// ============================================================================
// abs
// ============================================================================

export class AbsFn<
  TExpr extends NumericExpr,
  TTsType = StrictFnReturn<[TExpr], number>,
> extends SqlFn<
  ExprColumns<TExpr>,
  "scalar",
  "numeric",
  TTsType,
  Or<IsArg<TExpr>, HasArg<TExpr>>,
  HasAggregateOf<TExpr>
> {
  constructor(private readonly expr: TExpr) {
    super(SqlFn._hasAggregate(expr), SqlFn._hasWindow(expr));
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
    query.sql += "abs(";
    appendNumericExpr(query, this.expr, ctx);
    query.sql += ")";
  }
}

/** Returns the absolute value of a numeric expression. */
export function abs<TExpr extends NumericExpr>(
  expr: TypedScalarArg<TExpr, "numeric" | "float">,
): AbsFn<
  NormalizedNumeric<TExpr>,
  StrictFnReturn<[NormalizedNumeric<TExpr>], number>
> {
  return new AbsFn(normalizeNumeric(expr));
}

// ============================================================================
// mod
// ============================================================================

export class ModFn<
  TExpr extends NumericExpr,
  TN extends number | bigint | Arg<number> | Arg<bigint> | null,
  TTsType = StrictFnReturn<[TExpr, TN], number>,
> extends SqlFn<
  ExprColumns<TExpr>,
  "scalar",
  "numeric",
  TTsType,
  Or<Or<IsArg<TExpr>, HasArg<TExpr>>, IsArg<TN>>,
  HasAggregateOf<TExpr>
> {
  constructor(
    private readonly expr: TExpr,
    private readonly n: TN,
  ) {
    super(SqlFn._hasAggregate(expr), SqlFn._hasWindow(expr));
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
    query.sql += "mod(";
    appendNumericExpr(query, this.expr, ctx);
    query.sql += ", ";
    if (this.n === null) {
      query.sql += "NULL";
    } else if (is(this.n, Arg)) {
      query.addArg(this.n);
    } else {
      query.sql += this.n.toString();
    }
    query.sql += ")";
  }
}

/** Returns the remainder of `expr` divided by `n`. */
export function mod<
  TExpr extends NumericExpr,
  TN extends number | bigint | Arg<number> | Arg<bigint> | null,
>(
  expr: TypedScalarArg<TExpr, "numeric" | "float">,
  n: TN,
): ModFn<
  NormalizedNumeric<TExpr>,
  TN,
  StrictFnReturn<[NormalizedNumeric<TExpr>, TN], number>
> {
  return new ModFn(normalizeNumeric(expr), n);
}

// ============================================================================
// round
// ============================================================================

export class RoundFn<
  TExpr extends NumericExpr,
  TDecimals extends number | Arg<number> | null | undefined = undefined,
  TTsType = TDecimals extends undefined
    ? StrictFnReturn<[TExpr], number>
    : StrictFnReturn<[TExpr, TDecimals], number>,
> extends SqlFn<
  ExprColumns<TExpr>,
  "scalar",
  "numeric",
  TTsType,
  Or<Or<IsArg<TExpr>, HasArg<TExpr>>, IsArg<TDecimals>>,
  HasAggregateOf<TExpr>
> {
  constructor(
    private readonly expr: TExpr,
    private readonly decimals?: TDecimals,
  ) {
    super(SqlFn._hasAggregate(expr), SqlFn._hasWindow(expr));
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
    query.sql += "round(";
    appendNumericExpr(query, this.expr, ctx);
    if (this.decimals !== undefined) {
      query.sql += ", ";
      if (this.decimals === null) {
        query.sql += "NULL";
      } else if (is(this.decimals, Arg<number>)) {
        query.addArg(this.decimals);
      } else {
        query.sql += this.decimals.toString();
      }
    }
    query.sql += ")";
  }
}

/** Rounds a numeric expression to the nearest integer, or to `decimals` decimal places. */
export function round<TExpr extends NumericExpr>(
  expr: TypedScalarArg<TExpr, "numeric" | "float">,
): RoundFn<
  NormalizedNumeric<TExpr>,
  undefined,
  StrictFnReturn<[NormalizedNumeric<TExpr>], number>
>;
export function round<
  TExpr extends NumericExpr,
  TDecimals extends number | Arg<number> | null,
>(
  expr: TypedScalarArg<TExpr, "numeric" | "float">,
  decimals: TDecimals,
): RoundFn<
  NormalizedNumeric<TExpr>,
  TDecimals,
  StrictFnReturn<[NormalizedNumeric<TExpr>, TDecimals], number>
>;
export function round<
  TExpr extends NumericExpr,
  TDecimals extends number | Arg<number> | null | undefined = undefined,
>(
  expr: TypedScalarArg<TExpr, "numeric" | "float">,
  decimals?: TDecimals,
): RoundFn<
  NormalizedNumeric<TExpr>,
  TDecimals,
  TDecimals extends undefined
    ? StrictFnReturn<[NormalizedNumeric<TExpr>], number>
    : StrictFnReturn<[NormalizedNumeric<TExpr>, TDecimals], number>
> {
  return new RoundFn(normalizeNumeric(expr), decimals);
}

// ============================================================================
// ceil
// ============================================================================

export class CeilFn<
  TExpr extends NumericExpr,
  TTsType = StrictFnReturn<[TExpr], number>,
> extends SqlFn<
  ExprColumns<TExpr>,
  "scalar",
  "numeric",
  TTsType,
  Or<IsArg<TExpr>, HasArg<TExpr>>,
  HasAggregateOf<TExpr>
> {
  constructor(private readonly expr: TExpr) {
    super(SqlFn._hasAggregate(expr), SqlFn._hasWindow(expr));
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
    query.sql += "ceil(";
    appendNumericExpr(query, this.expr, ctx);
    query.sql += ")";
  }
}

/** Returns the smallest integer greater than or equal to the numeric expression. */
export function ceil<TExpr extends NumericExpr>(
  expr: TypedScalarArg<TExpr, "numeric" | "float">,
): CeilFn<
  NormalizedNumeric<TExpr>,
  StrictFnReturn<[NormalizedNumeric<TExpr>], number>
> {
  return new CeilFn(normalizeNumeric(expr));
}

// ============================================================================
// floor
// ============================================================================

export class FloorFn<
  TExpr extends NumericExpr,
  TTsType = StrictFnReturn<[TExpr], number>,
> extends SqlFn<
  ExprColumns<TExpr>,
  "scalar",
  "numeric",
  TTsType,
  Or<IsArg<TExpr>, HasArg<TExpr>>,
  HasAggregateOf<TExpr>
> {
  constructor(private readonly expr: TExpr) {
    super(SqlFn._hasAggregate(expr), SqlFn._hasWindow(expr));
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
    query.sql += "floor(";
    appendNumericExpr(query, this.expr, ctx);
    query.sql += ")";
  }
}

/** Returns the largest integer less than or equal to the numeric expression. */
export function floor<TExpr extends NumericExpr>(
  expr: TypedScalarArg<TExpr, "numeric" | "float">,
): FloorFn<
  NormalizedNumeric<TExpr>,
  StrictFnReturn<[NormalizedNumeric<TExpr>], number>
> {
  return new FloorFn(normalizeNumeric(expr));
}

// ============================================================================
// trunc
// ============================================================================

export class TruncFn<
  TExpr extends NumericExpr,
  TDecimals extends number | Arg<number> | null | undefined = undefined,
  TTsType = TDecimals extends undefined
    ? StrictFnReturn<[TExpr], number>
    : StrictFnReturn<[TExpr, TDecimals], number>,
> extends SqlFn<
  ExprColumns<TExpr>,
  "scalar",
  "numeric",
  TTsType,
  Or<Or<IsArg<TExpr>, HasArg<TExpr>>, IsArg<TDecimals>>,
  HasAggregateOf<TExpr>
> {
  constructor(
    private readonly expr: TExpr,
    private readonly decimals?: TDecimals,
  ) {
    super(SqlFn._hasAggregate(expr), SqlFn._hasWindow(expr));
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
    query.sql += "trunc(";
    appendNumericExpr(query, this.expr, ctx);
    if (this.decimals !== undefined) {
      query.sql += ", ";
      if (this.decimals === null) {
        query.sql += "NULL";
      } else if (is(this.decimals, Arg<number>)) {
        query.addArg(this.decimals);
      } else {
        query.sql += this.decimals.toString();
      }
    }
    query.sql += ")";
  }
}

/** Truncates a numeric expression to the nearest integer, or to `decimals` decimal places. */
export function trunc<TExpr extends NumericExpr>(
  expr: TypedScalarArg<TExpr, "numeric" | "float">,
): TruncFn<
  NormalizedNumeric<TExpr>,
  undefined,
  StrictFnReturn<[NormalizedNumeric<TExpr>], number>
>;
export function trunc<
  TExpr extends NumericExpr,
  TDecimals extends number | Arg<number> | null,
>(
  expr: TypedScalarArg<TExpr, "numeric" | "float">,
  decimals: TDecimals,
): TruncFn<
  NormalizedNumeric<TExpr>,
  TDecimals,
  StrictFnReturn<[NormalizedNumeric<TExpr>, TDecimals], number>
>;
export function trunc<
  TExpr extends NumericExpr,
  TDecimals extends number | Arg<number> | null | undefined = undefined,
>(
  expr: TypedScalarArg<TExpr, "numeric" | "float">,
  decimals?: TDecimals,
): TruncFn<
  NormalizedNumeric<TExpr>,
  TDecimals,
  TDecimals extends undefined
    ? StrictFnReturn<[NormalizedNumeric<TExpr>], number>
    : StrictFnReturn<[NormalizedNumeric<TExpr>, TDecimals], number>
> {
  return new TruncFn(normalizeNumeric(expr), decimals);
}

// ============================================================================
// power
// ============================================================================

export class PowerFn<
  TExpr extends NumericExpr,
  TN extends number | bigint | Arg<number> | Arg<bigint> | null,
  TTsType = StrictFnReturn<[TExpr, TN], number>,
> extends SqlFn<
  ExprColumns<TExpr>,
  "scalar",
  "numeric",
  TTsType,
  Or<Or<IsArg<TExpr>, HasArg<TExpr>>, IsArg<TN>>,
  HasAggregateOf<TExpr>
> {
  constructor(
    private readonly expr: TExpr,
    private readonly exponent: TN,
  ) {
    super(SqlFn._hasAggregate(expr), SqlFn._hasWindow(expr));
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
    query.sql += "power(";
    appendNumericExpr(query, this.expr, ctx);
    query.sql += ", ";
    if (this.exponent === null) {
      query.sql += "NULL";
    } else if (is(this.exponent, Arg)) {
      query.addArg(this.exponent);
    } else {
      query.sql += this.exponent.toString();
    }
    query.sql += ")";
  }
}

/** Returns the numeric expression raised to the power of `exponent`. */
export function power<
  TExpr extends NumericExpr,
  TN extends number | bigint | Arg<number> | Arg<bigint> | null,
>(
  expr: TypedScalarArg<TExpr, "numeric" | "float">,
  exponent: TN,
): PowerFn<
  NormalizedNumeric<TExpr>,
  TN,
  StrictFnReturn<[NormalizedNumeric<TExpr>, TN], number>
> {
  return new PowerFn(normalizeNumeric(expr), exponent);
}
