import type { AnyArg, IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import type { Sql } from "../sql";
import type { AnyColumn } from "../table";
import type { Or } from "../types";
import {
  type AnySqlFn,
  appendOperand,
  type ExprColumns,
  type HasAggregateOf,
  type HasArg,
  SqlFn,
} from "./index";

/**
 * Any value accepted by `numNonNulls` and `numNulls`: columns, SqlFns, raw
 * Sql, prepared arguments, primitives, dates, arrays, objects, and null.
 */
export type ComparisonOperand =
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

export type HasArgInTuple<TTuple extends readonly unknown[]> =
  TTuple extends readonly [infer Head, ...infer Tail]
    ? Or<Or<IsArg<Head>, HasArg<Head>>, HasArgInTuple<Tail>>
    : false;

function appendNullCountOperands(
  query: Query,
  exprs: readonly ComparisonOperand[],
  ctx?: QueryContext,
): void {
  // PostgreSQL cannot infer a type for an untyped parameter in a variadic `"any"` call.
  const options = { argCastFallback: "text" };
  for (let i = 0; i < exprs.length; i++) {
    if (i !== 0) query.sql += ", ";
    appendOperand(query, exprs[i], ctx, options);
  }
}

// ============================================================================
// num_nonnulls
// ============================================================================

export class NumNonNullsFn<
  TExprs extends readonly [ComparisonOperand, ...ComparisonOperand[]],
  THasArg extends boolean = HasArgInTuple<TExprs>,
> extends SqlFn<
  ExprColumns<TExprs[number]>,
  "scalar",
  "numeric",
  number,
  THasArg,
  HasAggregateOf<TExprs[number]>
> {
  constructor(private readonly exprs: TExprs) {
    super(SqlFn._hasAggregate(exprs), SqlFn._hasWindow(exprs));
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
    query.sql += "num_nonnulls(";
    appendNullCountOperands(query, this.exprs, ctx);
    query.sql += ")";
  }
}

/**
 * Returns the number of arguments that are not null.
 *
 * @example
 * numNonNulls(users.email, users.phone, null) // number
 */
export function numNonNulls<
  TExprs extends readonly [ComparisonOperand, ...ComparisonOperand[]],
>(...exprs: TExprs): NumNonNullsFn<TExprs, HasArgInTuple<TExprs>> {
  return new NumNonNullsFn(exprs);
}

// ============================================================================
// num_nulls
// ============================================================================

export class NumNullsFn<
  TExprs extends readonly [ComparisonOperand, ...ComparisonOperand[]],
  THasArg extends boolean = HasArgInTuple<TExprs>,
> extends SqlFn<
  ExprColumns<TExprs[number]>,
  "scalar",
  "numeric",
  number,
  THasArg,
  HasAggregateOf<TExprs[number]>
> {
  constructor(private readonly exprs: TExprs) {
    super(SqlFn._hasAggregate(exprs), SqlFn._hasWindow(exprs));
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
    query.sql += "num_nulls(";
    appendNullCountOperands(query, this.exprs, ctx);
    query.sql += ")";
  }
}

/**
 * Returns the number of arguments that are null.
 *
 * @example
 * numNulls(users.email, users.phone, null) // number
 */
export function numNulls<
  TExprs extends readonly [ComparisonOperand, ...ComparisonOperand[]],
>(...exprs: TExprs): NumNullsFn<TExprs, HasArgInTuple<TExprs>> {
  return new NumNullsFn(exprs);
}
