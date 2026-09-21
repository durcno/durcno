import { is, isCol } from "../entity";
import { type AnyArg, Arg, type IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import { Sql, toSqlValue } from "../sql";
import type { AnyColumn } from "../table";
import type { Or } from "../types";
import {
  type AnySqlFn,
  type ExprColumns,
  type HasArg,
  type InferValueType,
  SqlFn,
} from "./index";

/**
 * Union of every valid operand for `coalesce` and `nullif`:
 * columns, SqlFns, raw Sql instances, prepared arguments, primitive literals, and null.
 */
export type CoalesceOperand =
  | AnyColumn
  | AnySqlFn
  | Sql
  | AnyArg
  | string
  | number
  | bigint
  | boolean
  | null;

/**
 * Resolves the TypeScript return type of `coalesce(...)`:
 * Iterates left-to-right. If an operand is guaranteed non-null, iteration terminates.
 * If an operand is nullable, its non-null part is unioned with the remaining operands.
 */
export type CoalesceReturn<TTuple extends readonly unknown[]> =
  TTuple extends readonly [infer First, ...infer Rest]
    ? Rest extends readonly []
      ? InferValueType<First>
      : null extends InferValueType<First>
        ? NonNullable<InferValueType<First>> | CoalesceReturn<Rest>
        : InferValueType<First>
    : never;

export type HasArgInTuple<TTuple extends readonly unknown[]> =
  TTuple extends readonly [infer Head, ...infer Tail]
    ? Or<Or<IsArg<Head>, HasArg<Head>>, HasArgInTuple<Tail>>
    : false;

function appendCoalesceOperand(
  query: Query,
  expr: CoalesceOperand,
  ctx?: QueryContext,
): void {
  if (expr === null) {
    query.sql += "NULL";
  } else if (is(expr, Arg)) {
    query.addArg(expr);
  } else if (isCol(expr)) {
    expr.toQuery(query, ctx);
  } else if (expr instanceof SqlFn) {
    expr.toQuery(query, ctx);
  } else if (expr instanceof Sql) {
    expr.toQuery(query, ctx);
  } else {
    query.sql += toSqlValue(expr);
  }
}

function deserializeOperandValue(
  value: unknown,
  expr: CoalesceOperand,
): unknown {
  if (value === null || value === undefined) return null;
  if (isCol(expr)) return expr.fromDriverScalar(value);
  if (expr instanceof SqlFn) return expr.fromDriverValue(value);
  if (typeof expr === "number") return Number(value);
  if (typeof expr === "bigint") return BigInt(value as string | number);
  if (typeof expr === "boolean")
    return value === true || value === "t" || value === "true";
  return value;
}

// ============================================================================
// coalesce
// ============================================================================

export class CoalesceFn<
  TExprs extends readonly CoalesceOperand[],
  TTsType = CoalesceReturn<TExprs>,
  THasArg extends boolean = HasArgInTuple<TExprs>,
> extends SqlFn<
  ExprColumns<TExprs[number]>,
  THasArg,
  "scalar",
  string,
  TTsType
> {
  constructor(private readonly exprs: TExprs) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return toSqlValue(value as never);
  }
  fromDriverValue(value: unknown): TTsType | null {
    if (value === null) return null;
    for (const expr of this.exprs) {
      if (
        isCol(expr) ||
        expr instanceof SqlFn ||
        typeof expr === "number" ||
        typeof expr === "bigint" ||
        typeof expr === "boolean"
      ) {
        return deserializeOperandValue(value, expr) as TTsType | null;
      }
    }
    return value as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "coalesce(";
    this.exprs.forEach((expr, i) => {
      appendCoalesceOperand(query, expr, ctx);
      if (i < this.exprs.length - 1) query.sql += ", ";
    });
    query.sql += ")";
  }
}

/**
 * Returns the first non-null argument among `exprs`.
 * Inferred return type drops `null` if any argument is guaranteed non-null.
 *
 * @example
 * coalesce(users.email, "fallback@example.com") // string
 */
export function coalesce<
  TExprs extends readonly [CoalesceOperand, ...CoalesceOperand[]],
>(
  ...exprs: TExprs
): CoalesceFn<TExprs, CoalesceReturn<TExprs>, HasArgInTuple<TExprs>> {
  return new CoalesceFn(exprs);
}

// ============================================================================
// nullif
// ============================================================================

export class NullIfFn<
  TExpr extends CoalesceOperand,
  TVal extends CoalesceOperand,
  TTsType = InferValueType<TExpr> | null,
  THasArg extends boolean = Or<
    Or<IsArg<TExpr>, HasArg<TExpr>>,
    Or<IsArg<TVal>, HasArg<TVal>>
  >,
> extends SqlFn<
  ExprColumns<TExpr> | ExprColumns<TVal>,
  THasArg,
  "scalar",
  string,
  TTsType
> {
  constructor(
    private readonly expr: TExpr,
    private readonly val: TVal,
  ) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return toSqlValue(value as never);
  }
  fromDriverValue(value: unknown): TTsType | null {
    if (value === null) return null;
    return deserializeOperandValue(value, this.expr) as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "nullif(";
    appendCoalesceOperand(query, this.expr, ctx);
    query.sql += ", ";
    appendCoalesceOperand(query, this.val, ctx);
    query.sql += ")";
  }
}

/**
 * Returns `null` if `expr = val`, otherwise returns `expr`.
 *
 * @example
 * nullif(users.status, "inactive") // string | null
 */
export function nullif<
  TExpr extends CoalesceOperand,
  TVal extends CoalesceOperand,
>(
  expr: TExpr,
  val: TVal,
): NullIfFn<
  TExpr,
  TVal,
  InferValueType<TExpr> | null,
  Or<Or<IsArg<TExpr>, HasArg<TExpr>>, Or<IsArg<TVal>, HasArg<TVal>>>
> {
  return new NullIfFn(expr, val);
}

// ============================================================================
// greatest
// ============================================================================

export class GreatestFn<
  TExprs extends readonly CoalesceOperand[],
  TTsType = CoalesceReturn<TExprs>,
  THasArg extends boolean = HasArgInTuple<TExprs>,
> extends SqlFn<
  ExprColumns<TExprs[number]>,
  THasArg,
  "scalar",
  string,
  TTsType
> {
  constructor(private readonly exprs: TExprs) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return toSqlValue(value as never);
  }
  fromDriverValue(value: unknown): TTsType | null {
    if (value === null) return null;
    for (const expr of this.exprs) {
      if (
        isCol(expr) ||
        expr instanceof SqlFn ||
        typeof expr === "number" ||
        typeof expr === "bigint" ||
        typeof expr === "boolean"
      ) {
        return deserializeOperandValue(value, expr) as TTsType | null;
      }
    }
    return value as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "greatest(";
    this.exprs.forEach((expr, i) => {
      appendCoalesceOperand(query, expr, ctx);
      if (i < this.exprs.length - 1) query.sql += ", ";
    });
    query.sql += ")";
  }
}

/**
 * Returns the largest value among `exprs`.
 * Inferred return type drops `null` if any argument is guaranteed non-null.
 *
 * @example
 * greatest(users.updatedAt, users.createdAt) // Date
 */
export function greatest<
  TExprs extends readonly [CoalesceOperand, ...CoalesceOperand[]],
>(
  ...exprs: TExprs
): GreatestFn<TExprs, CoalesceReturn<TExprs>, HasArgInTuple<TExprs>> {
  return new GreatestFn(exprs);
}

// ============================================================================
// least
// ============================================================================

export class LeastFn<
  TExprs extends readonly CoalesceOperand[],
  TTsType = CoalesceReturn<TExprs>,
  THasArg extends boolean = HasArgInTuple<TExprs>,
> extends SqlFn<
  ExprColumns<TExprs[number]>,
  THasArg,
  "scalar",
  string,
  TTsType
> {
  constructor(private readonly exprs: TExprs) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return toSqlValue(value as never);
  }
  fromDriverValue(value: unknown): TTsType | null {
    if (value === null) return null;
    for (const expr of this.exprs) {
      if (
        isCol(expr) ||
        expr instanceof SqlFn ||
        typeof expr === "number" ||
        typeof expr === "bigint" ||
        typeof expr === "boolean"
      ) {
        return deserializeOperandValue(value, expr) as TTsType | null;
      }
    }
    return value as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "least(";
    this.exprs.forEach((expr, i) => {
      appendCoalesceOperand(query, expr, ctx);
      if (i < this.exprs.length - 1) query.sql += ", ";
    });
    query.sql += ")";
  }
}

/**
 * Returns the smallest value among `exprs`.
 * Inferred return type drops `null` if any argument is guaranteed non-null.
 *
 * @example
 * least(users.updatedAt, users.createdAt) // Date
 */
export function least<
  TExprs extends readonly [CoalesceOperand, ...CoalesceOperand[]],
>(
  ...exprs: TExprs
): LeastFn<TExprs, CoalesceReturn<TExprs>, HasArgInTuple<TExprs>> {
  return new LeastFn(exprs);
}
