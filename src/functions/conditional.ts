import { isCol } from "../entity";
import type { AnyArg, IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import { type Sql, toSqlValue } from "../sql";
import type { AnyColumn } from "../table";
import type { Or } from "../types";
import {
  type AnySqlFn,
  appendOperand,
  detectJsonKind,
  type ExprColumns,
  type HasArg,
  type InferValueType,
  SqlFn,
} from "./index";

/**
 * Union of every valid operand for `coalesce` and `nullif`:
 * columns, SqlFns, raw Sql instances, prepared arguments, primitive literals, objects, arrays, and null.
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
  | Date
  | readonly unknown[]
  | Record<string, unknown>
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
        ? NonNullable<InferValueType<First>> extends (infer TItem)[]
          ? Rest extends readonly [readonly unknown[]]
            ? TItem[]
            : NonNullable<InferValueType<First>> | CoalesceReturn<Rest>
          : NonNullable<InferValueType<First>> | CoalesceReturn<Rest>
        : InferValueType<First>
    : never;

export type HasArgInTuple<TTuple extends readonly unknown[]> =
  TTuple extends readonly [infer Head, ...infer Tail]
    ? Or<Or<IsArg<Head>, HasArg<Head>>, HasArgInTuple<Tail>>
    : false;

export type IsAnyAggregateInTuple<TTuple extends readonly unknown[]> =
  TTuple extends readonly [infer Head, ...infer Tail]
    ? Head extends { isAggregate: true }
      ? true
      : Head extends { $: { FnType: "aggregate" } }
        ? true
        : IsAnyAggregateInTuple<Tail>
    : false;

function isJsonbOperand(e: unknown): boolean {
  return detectJsonKind(e) === "jsonb";
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
  if (expr instanceof Date) {
    return value instanceof Date ? value : new Date(value as string | number);
  }
  if (Array.isArray(expr) || (typeof expr === "object" && expr !== null)) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }
  return value;
}

// ============================================================================
// coalesce
// ============================================================================

export class CoalesceFn<
  TExprs extends readonly CoalesceOperand[],
  TTsType = CoalesceReturn<TExprs>,
  THasArg extends boolean = HasArgInTuple<TExprs>,
  TFnType extends
    | "aggregate"
    | "scalar" = IsAnyAggregateInTuple<TExprs> extends true
    ? "aggregate"
    : "scalar",
> extends SqlFn<
  ExprColumns<TExprs[number]>,
  THasArg,
  TFnType,
  string,
  TTsType
> {
  override readonly isAggregate: boolean;

  constructor(private readonly exprs: TExprs) {
    super();
    this.isAggregate = this.exprs.some(
      (e) =>
        (e instanceof SqlFn && e.isAggregate) ||
        (typeof e === "object" &&
          e !== null &&
          "isAggregate" in e &&
          e.isAggregate === true),
    );
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
        typeof expr === "boolean" ||
        Array.isArray(expr)
      ) {
        return deserializeOperandValue(value, expr) as TTsType | null;
      }
    }
    return value as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "coalesce(";
    const preferJsonb = isJsonbOperand(this.exprs[0]);
    this.exprs.forEach((expr, i) => {
      appendOperand(query, expr, ctx, {
        preferJsonb,
        leadOperand: this.exprs[0],
      });
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
    appendOperand(query, this.expr, ctx, { leadOperand: this.expr });
    query.sql += ", ";
    appendOperand(query, this.val, ctx, { leadOperand: this.expr });
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
      appendOperand(query, expr, ctx, { leadOperand: this.exprs[0] });
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
      appendOperand(query, expr, ctx, { leadOperand: this.exprs[0] });
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
