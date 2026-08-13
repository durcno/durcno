import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import type { AnyScalarColumn } from "../table";
import type { Or } from "../types";
import { type AnySqlFn, type ExprColumns, type HasArg, SqlFn } from "./index";

export type TextExpr =
  | ((AnyScalarColumn | AnySqlFn) & { $: { PgType: "text" } })
  | string
  | Arg<string>;

function appendTextExpr(query: Query, expr: TextExpr, ctx?: QueryContext) {
  if (typeof expr === "string") {
    query.sql += `'${expr.replace(/'/g, "''")}'`;
  } else if (is(expr, Arg<string>)) {
    query.addArg(expr);
  } else {
    expr.toQuery(query, ctx);
  }
}

// ============================================================================
// length
// ============================================================================

export class LengthFn<TExpr extends TextExpr> extends SqlFn<
  ExprColumns<TExpr>,
  Or<IsArg<TExpr>, HasArg<TExpr>>,
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
    query.sql += "length(";
    appendTextExpr(query, this.expr, ctx);
    query.sql += ")";
  }
}

/** Returns the number of characters in a string expression. */
export function length<TExpr extends TextExpr>(expr: TExpr): LengthFn<TExpr> {
  return new LengthFn(expr);
}

// ============================================================================
// lower
// ============================================================================

export class LowerFn<TExpr extends TextExpr> extends SqlFn<
  ExprColumns<TExpr>,
  Or<IsArg<TExpr>, HasArg<TExpr>>,
  "scalar",
  "text",
  string
> {
  constructor(private readonly expr: TExpr) {
    super();
  }

  toDriverValue(value: string | null): unknown {
    return value;
  }
  toSQLValue(value: string | null): string {
    return SqlFn._stringToSQL(value);
  }
  fromDriverValue(value: unknown): string | null {
    return SqlFn._stringFromDriver(value);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "lower(";
    appendTextExpr(query, this.expr, ctx);
    query.sql += ")";
  }
}

/** Converts a string expression to lower case. */
export function lower<TExpr extends TextExpr>(expr: TExpr): LowerFn<TExpr> {
  return new LowerFn(expr);
}

// ============================================================================
// upper
// ============================================================================

export class UpperFn<TExpr extends TextExpr> extends SqlFn<
  ExprColumns<TExpr>,
  Or<IsArg<TExpr>, HasArg<TExpr>>,
  "scalar",
  "text",
  string
> {
  constructor(private readonly expr: TExpr) {
    super();
  }

  toDriverValue(value: string | null): unknown {
    return value;
  }
  toSQLValue(value: string | null): string {
    return SqlFn._stringToSQL(value);
  }
  fromDriverValue(value: unknown): string | null {
    return SqlFn._stringFromDriver(value);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "upper(";
    appendTextExpr(query, this.expr, ctx);
    query.sql += ")";
  }
}

/** Converts a string expression to upper case. */
export function upper<TExpr extends TextExpr>(expr: TExpr): UpperFn<TExpr> {
  return new UpperFn(expr);
}

// ============================================================================
// trim
// ============================================================================

export class TrimFn<TExpr extends TextExpr> extends SqlFn<
  ExprColumns<TExpr>,
  Or<IsArg<TExpr>, HasArg<TExpr>>,
  "scalar",
  "text",
  string
> {
  constructor(private readonly expr: TExpr) {
    super();
  }

  toDriverValue(value: string | null): unknown {
    return value;
  }
  toSQLValue(value: string | null): string {
    return SqlFn._stringToSQL(value);
  }
  fromDriverValue(value: unknown): string | null {
    return SqlFn._stringFromDriver(value);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "trim(";
    appendTextExpr(query, this.expr, ctx);
    query.sql += ")";
  }
}

/** Removes leading and trailing whitespace from a string expression. */
export function trim<TExpr extends TextExpr>(expr: TExpr): TrimFn<TExpr> {
  return new TrimFn(expr);
}

// ============================================================================
// left
// ============================================================================

export class LeftFn<
  TExpr extends TextExpr,
  THasArg extends boolean = false,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<
    TExpr extends string | Arg<string> ? IsArg<TExpr> : HasArg<TExpr>,
    THasArg
  >,
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

  toDriverValue(value: string | null): unknown {
    return value;
  }
  toSQLValue(value: string | null): string {
    return SqlFn._stringToSQL(value);
  }
  fromDriverValue(value: unknown): string | null {
    return SqlFn._stringFromDriver(value);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "left(";
    appendTextExpr(query, this.expr, ctx);
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
export function left<TExpr extends TextExpr>(
  expr: TExpr,
  n: number,
): LeftFn<TExpr, false>;
export function left<TExpr extends TextExpr>(
  expr: TExpr,
  n: Arg<number>,
): LeftFn<TExpr, true>;
export function left<TExpr extends TextExpr>(
  expr: TExpr,
  n: number | Arg<number>,
): LeftFn<TExpr, boolean> {
  return new LeftFn(expr, n);
}

// ============================================================================
// right
// ============================================================================

export class RightFn<
  TExpr extends TextExpr,
  THasArg extends boolean = false,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<
    TExpr extends string | Arg<string> ? IsArg<TExpr> : HasArg<TExpr>,
    THasArg
  >,
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

  toDriverValue(value: string | null): unknown {
    return value;
  }
  toSQLValue(value: string | null): string {
    return SqlFn._stringToSQL(value);
  }
  fromDriverValue(value: unknown): string | null {
    return SqlFn._stringFromDriver(value);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "right(";
    appendTextExpr(query, this.expr, ctx);
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
export function right<TExpr extends TextExpr>(
  expr: TExpr,
  n: number,
): RightFn<TExpr, false>;
export function right<TExpr extends TextExpr>(
  expr: TExpr,
  n: Arg<number>,
): RightFn<TExpr, true>;
export function right<TExpr extends TextExpr>(
  expr: TExpr,
  n: number | Arg<number>,
): RightFn<TExpr, boolean> {
  return new RightFn(expr, n);
}

// ============================================================================
// position
// ============================================================================

export class PositionFn<
  TExpr extends TextExpr,
  TSearch extends string | Arg<string>,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<
    TExpr extends string | Arg<string> ? IsArg<TExpr> : HasArg<TExpr>,
    IsArg<TSearch>
  >,
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
    query.sql += "strpos(";
    appendTextExpr(query, this.expr, ctx);
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
  TExpr extends TextExpr,
  TSearch extends string | Arg<string>,
>(expr: TExpr, search: TSearch): PositionFn<TExpr, TSearch> {
  return new PositionFn(expr, search);
}
