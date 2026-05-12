import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/pre";
import type { Query, QueryContext } from "../query-builders/query";
import type { AnyScalarTableColumn } from "../table";
import type { Or } from "../types";
import { type AnySqlFn, type ExprColumns, type HasArg, SqlFn } from ".";

// ============================================================================
// length
// ============================================================================

export class LengthFn<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
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

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "length(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/** Returns the number of characters in a string expression. */
export function length<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
>(expr: TExpr): LengthFn<TExpr> {
  return new LengthFn(expr);
}

// ============================================================================
// lower
// ============================================================================

export class LowerFn<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
> extends SqlFn<ExprColumns<TExpr>, HasArg<TExpr>, "scalar", "text", string> {
  constructor(private readonly expr: TExpr) {
    super();
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "lower(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/** Converts a string expression to lower case. */
export function lower<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
>(expr: TExpr): LowerFn<TExpr> {
  return new LowerFn(expr);
}

// ============================================================================
// upper
// ============================================================================

export class UpperFn<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
> extends SqlFn<ExprColumns<TExpr>, HasArg<TExpr>, "scalar", "text", string> {
  constructor(private readonly expr: TExpr) {
    super();
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "upper(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/** Converts a string expression to upper case. */
export function upper<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
>(expr: TExpr): UpperFn<TExpr> {
  return new UpperFn(expr);
}

// ============================================================================
// trim
// ============================================================================

export class TrimFn<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
> extends SqlFn<ExprColumns<TExpr>, HasArg<TExpr>, "scalar", "text", string> {
  constructor(private readonly expr: TExpr) {
    super();
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "trim(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/** Removes leading and trailing whitespace from a string expression. */
export function trim<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
>(expr: TExpr): TrimFn<TExpr> {
  return new TrimFn(expr);
}

// ============================================================================
// left
// ============================================================================

export class LeftFn<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
  THasArg extends boolean = false,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<HasArg<TExpr>, THasArg>,
  "scalar",
  "text",
  string
> {
  constructor(
    private readonly expr: TExpr,
    private readonly n: number | Arg<number>,
  ) {
    super();
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "left(";
    this.expr.toQuery(query, ctx);
    query.sql += ", ";
    if (is(this.n, Arg)) {
      query.addArg(this.n);
    } else {
      query.sql += this.n.toString();
    }
    query.sql += ")";
  }
}

/** Returns the first `n` characters of a string expression. */
export function left<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
>(expr: TExpr, n: number): LeftFn<TExpr, false>;
export function left<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
>(expr: TExpr, n: Arg<number>): LeftFn<TExpr, true>;
export function left<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
>(expr: TExpr, n: number | Arg<number>): LeftFn<TExpr, boolean> {
  return new LeftFn(expr, n);
}

// ============================================================================
// right
// ============================================================================

export class RightFn<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
  THasArg extends boolean = false,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<HasArg<TExpr>, THasArg>,
  "scalar",
  "text",
  string
> {
  constructor(
    private readonly expr: TExpr,
    private readonly n: number | Arg<number>,
  ) {
    super();
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "right(";
    this.expr.toQuery(query, ctx);
    query.sql += ", ";
    if (is(this.n, Arg)) {
      query.addArg(this.n);
    } else {
      query.sql += this.n.toString();
    }
    query.sql += ")";
  }
}

/** Returns the last `n` characters of a string expression. */
export function right<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
>(expr: TExpr, n: number): RightFn<TExpr, false>;
export function right<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
>(expr: TExpr, n: Arg<number>): RightFn<TExpr, true>;
export function right<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
>(expr: TExpr, n: number | Arg<number>): RightFn<TExpr, boolean> {
  return new RightFn(expr, n);
}

// ============================================================================
// position
// ============================================================================

export class PositionFn<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
  TSearch extends string | Arg<string>,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<HasArg<TExpr>, IsArg<TSearch>>,
  "scalar",
  "numeric",
  number
> {
  constructor(
    private readonly expr: TExpr,
    private readonly search: TSearch,
  ) {
    super();
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "strpos(";
    this.expr.toQuery(query, ctx);
    query.sql += ", ";
    if (is(this.search, Arg<string>)) {
      query.addArg(this.search);
    } else {
      query.sql += `'${this.search.replace(/'/g, "''")}'`;
    }
    query.sql += ")";
  }
}

/** Returns the 1-based position of `search` within a string expression, or 0 if not found. */
export function position<
  TExpr extends (AnyScalarTableColumn | AnySqlFn) & {
    $: { PgType: "text" };
  },
  TSearch extends string | Arg<string>,
>(expr: TExpr, search: TSearch): PositionFn<TExpr, TSearch> {
  return new PositionFn(expr, search);
}
