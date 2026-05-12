import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/pre";
import type { Query } from "../query-builders/query";
import type { AnyScalarTableColumn } from "../table";
import type { Or } from "../types";
import { type AnySqlFn, type ExprColumns, type HasArg, SqlFn } from ".";

// ============================================================================
// abs
// ============================================================================

export class AbsFn<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "numeric" };
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

  toQuery(query: Query): void {
    query.sql += "abs(";
    this.expr.toQuery(query);
    query.sql += ")";
  }
}

/** Returns the absolute value of a numeric expression. */
export function abs<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "numeric" };
  },
>(expr: TExpr): AbsFn<TExpr> {
  return new AbsFn(expr);
}

// ============================================================================
// mod
// ============================================================================

export class ModFn<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "numeric" };
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

  toQuery(query: Query): void {
    query.sql += "mod(";
    this.expr.toQuery(query);
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
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "numeric" };
  },
  TN extends number | Arg<number>,
>(expr: TExpr, n: TN): ModFn<TExpr, TN> {
  return new ModFn(expr, n);
}

// ============================================================================
// round
// ============================================================================

export class RoundFn<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "numeric" };
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

  toQuery(query: Query): void {
    query.sql += "round(";
    this.expr.toQuery(query);
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
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "numeric" };
  },
  TDecimals extends number | Arg<number> | undefined = undefined,
>(expr: TExpr, decimals?: TDecimals): RoundFn<TExpr, TDecimals> {
  return new RoundFn(expr, decimals);
}

// ============================================================================
// ceil
// ============================================================================

export class CeilFn<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "numeric" };
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

  toQuery(query: Query): void {
    query.sql += "ceil(";
    this.expr.toQuery(query);
    query.sql += ")";
  }
}

/** Returns the smallest integer greater than or equal to the numeric expression. */
export function ceil<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "numeric" };
  },
>(expr: TExpr): CeilFn<TExpr> {
  return new CeilFn(expr);
}

// ============================================================================
// floor
// ============================================================================

export class FloorFn<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "numeric" };
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

  toQuery(query: Query): void {
    query.sql += "floor(";
    this.expr.toQuery(query);
    query.sql += ")";
  }
}

/** Returns the largest integer less than or equal to the numeric expression. */
export function floor<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "numeric" };
  },
>(expr: TExpr): FloorFn<TExpr> {
  return new FloorFn(expr);
}
