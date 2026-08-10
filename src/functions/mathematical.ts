import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import type { AnyScalarColumn } from "../table";
import type { Or } from "../types";
import { type AnySqlFn, type ExprColumns, type HasArg, SqlFn } from "./index";

// ============================================================================
// abs
// ============================================================================

export class AbsFn<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
> extends SqlFn<
  ExprColumns<TExpr>,
  HasArg<TExpr>,
  "scalar",
  "numeric",
  number
> {
  constructor(private readonly expr: TExpr) {
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
    query.sql += "abs(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/** Returns the absolute value of a numeric expression. */
export function abs<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
>(expr: TExpr): AbsFn<TExpr> {
  return new AbsFn(expr);
}

// ============================================================================
// mod
// ============================================================================

export class ModFn<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
  TN extends number | Arg<number>,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<HasArg<TExpr>, IsArg<TN>>,
  "scalar",
  "numeric",
  number
> {
  constructor(
    private readonly expr: TExpr,
    private readonly n: TN,
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
    query.sql += "mod(";
    this.expr.toQuery(query, ctx);
    query.sql += ", ";
    if (is(this.n, Arg<number>)) {
      query.addArg(this.n);
    } else {
      query.sql += this.n.toString();
    }
    query.sql += ")";
  }
}

/** Returns the remainder of `expr` divided by `n`. */
export function mod<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
  TN extends number | Arg<number>,
>(expr: TExpr, n: TN): ModFn<TExpr, TN> {
  return new ModFn(expr, n);
}

// ============================================================================
// round
// ============================================================================

export class RoundFn<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
  TDecimals extends number | Arg<number> | undefined = undefined,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<HasArg<TExpr>, IsArg<TDecimals>>,
  "scalar",
  "numeric",
  number
> {
  constructor(
    private readonly expr: TExpr,
    private readonly decimals?: TDecimals,
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
    query.sql += "round(";
    this.expr.toQuery(query, ctx);
    if (this.decimals !== undefined) {
      query.sql += ", ";
      if (is(this.decimals, Arg<number>)) {
        query.addArg(this.decimals);
      } else {
        query.sql += this.decimals.toString();
      }
    }
    query.sql += ")";
  }
}

/** Rounds a numeric expression to the nearest integer, or to `decimals` decimal places. */
export function round<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
  TDecimals extends number | Arg<number> | undefined = undefined,
>(expr: TExpr, decimals?: TDecimals): RoundFn<TExpr, TDecimals> {
  return new RoundFn(expr, decimals);
}

// ============================================================================
// ceil
// ============================================================================

export class CeilFn<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
> extends SqlFn<
  ExprColumns<TExpr>,
  HasArg<TExpr>,
  "scalar",
  "numeric",
  number
> {
  constructor(private readonly expr: TExpr) {
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
    query.sql += "ceil(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/** Returns the smallest integer greater than or equal to the numeric expression. */
export function ceil<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
>(expr: TExpr): CeilFn<TExpr> {
  return new CeilFn(expr);
}

// ============================================================================
// floor
// ============================================================================

export class FloorFn<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
> extends SqlFn<
  ExprColumns<TExpr>,
  HasArg<TExpr>,
  "scalar",
  "numeric",
  number
> {
  constructor(private readonly expr: TExpr) {
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
    query.sql += "floor(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/** Returns the largest integer less than or equal to the numeric expression. */
export function floor<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
>(expr: TExpr): FloorFn<TExpr> {
  return new FloorFn(expr);
}

// ============================================================================
// trunc
// ============================================================================

export class TruncFn<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
  TDecimals extends number | Arg<number> | undefined = undefined,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<HasArg<TExpr>, IsArg<TDecimals>>,
  "scalar",
  "numeric",
  number
> {
  constructor(
    private readonly expr: TExpr,
    private readonly decimals?: TDecimals,
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
    query.sql += "trunc(";
    this.expr.toQuery(query, ctx);
    if (this.decimals !== undefined) {
      query.sql += ", ";
      if (is(this.decimals, Arg<number>)) {
        query.addArg(this.decimals);
      } else {
        query.sql += this.decimals.toString();
      }
    }
    query.sql += ")";
  }
}

/** Truncates a numeric expression to the nearest integer, or to `decimals` decimal places. */
export function trunc<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
  TDecimals extends number | Arg<number> | undefined = undefined,
>(expr: TExpr, decimals?: TDecimals): TruncFn<TExpr, TDecimals> {
  return new TruncFn(expr, decimals);
}

// ============================================================================
// power
// ============================================================================

export class PowerFn<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
  TN extends number | Arg<number>,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<HasArg<TExpr>, IsArg<TN>>,
  "scalar",
  "numeric",
  number
> {
  constructor(
    private readonly expr: TExpr,
    private readonly exponent: TN,
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
    query.sql += "power(";
    this.expr.toQuery(query, ctx);
    query.sql += ", ";
    if (is(this.exponent, Arg<number>)) {
      query.addArg(this.exponent);
    } else {
      query.sql += this.exponent.toString();
    }
    query.sql += ")";
  }
}

/** Returns the numeric expression raised to the power of `exponent`. */
export function power<
  TExpr extends (AnyScalarColumn | AnySqlFn) & {
    $: { PgType: "numeric" | "float" };
  },
  TN extends number | Arg<number>,
>(expr: TExpr, exponent: TN): PowerFn<TExpr, TN> {
  return new PowerFn(expr, exponent);
}
