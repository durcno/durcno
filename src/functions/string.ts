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

export type TextExpr =
  | ((AnyScalarColumn | AnySqlFn) & { $: { PgType: "text" } })
  | string
  | Arg<string>
  | Sql<string>
  | null;

export type ConcatOperand =
  | AnyScalarColumn
  | AnySqlFn
  | Sql
  | Arg<any>
  | string
  | number
  | bigint
  | boolean
  | null;

export type HasArgInTuple<TTuple extends readonly unknown[]> =
  TTuple extends readonly [infer Head, ...infer Tail]
    ? Or<Or<IsArg<Head>, HasArg<Head>>, HasArgInTuple<Tail>>
    : false;

function appendTextExpr(query: Query, expr: ConcatOperand, ctx?: QueryContext) {
  if (expr === null) {
    query.sql += "NULL";
  } else if (typeof expr === "string") {
    query.sql += `'${expr.replace(/'/g, "''")}'`;
  } else if (typeof expr === "number" || typeof expr === "bigint") {
    query.sql += expr.toString();
  } else if (typeof expr === "boolean") {
    query.sql += expr ? "TRUE" : "FALSE";
  } else if (is(expr, Arg)) {
    query.addArg(expr);
  } else if (expr instanceof Sql) {
    expr.toQuery(query, ctx);
  } else {
    (expr as AnyScalarColumn | AnySqlFn).toQuery(query, ctx);
  }
}

// ============================================================================
// length
// ============================================================================

export class LengthFn<
  TExpr extends TextExpr,
  TTsType = StrictFnReturn<[TExpr], number>,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<IsArg<TExpr>, HasArg<TExpr>>,
  "scalar",
  "numeric",
  TTsType
> {
  constructor(private readonly expr: TExpr) {
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
    query.sql += "length(";
    appendTextExpr(query, this.expr, ctx);
    query.sql += ")";
  }
}

/** Returns the number of characters in a string expression. */
export function length<TExpr extends TextExpr>(
  expr: TExpr,
): LengthFn<TExpr, StrictFnReturn<[TExpr], number>> {
  return new LengthFn(expr);
}

// ============================================================================
// lower
// ============================================================================

export class LowerFn<
  TExpr extends TextExpr,
  TTsType = StrictFnReturn<[TExpr], string>,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<IsArg<TExpr>, HasArg<TExpr>>,
  "scalar",
  "text",
  TTsType
> {
  constructor(private readonly expr: TExpr) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return SqlFn._stringToSQL(value as string | null);
  }
  fromDriverValue(value: unknown): TTsType | null {
    return SqlFn._stringFromDriver(value) as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "lower(";
    appendTextExpr(query, this.expr, ctx);
    query.sql += ")";
  }
}

/** Converts a string expression to lower case. */
export function lower<TExpr extends TextExpr>(
  expr: TExpr,
): LowerFn<TExpr, StrictFnReturn<[TExpr], string>> {
  return new LowerFn(expr);
}

// ============================================================================
// upper
// ============================================================================

export class UpperFn<
  TExpr extends TextExpr,
  TTsType = StrictFnReturn<[TExpr], string>,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<IsArg<TExpr>, HasArg<TExpr>>,
  "scalar",
  "text",
  TTsType
> {
  constructor(private readonly expr: TExpr) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return SqlFn._stringToSQL(value as string | null);
  }
  fromDriverValue(value: unknown): TTsType | null {
    return SqlFn._stringFromDriver(value) as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "upper(";
    appendTextExpr(query, this.expr, ctx);
    query.sql += ")";
  }
}

/** Converts a string expression to upper case. */
export function upper<TExpr extends TextExpr>(
  expr: TExpr,
): UpperFn<TExpr, StrictFnReturn<[TExpr], string>> {
  return new UpperFn(expr);
}

// ============================================================================
// trim
// ============================================================================

export class TrimFn<
  TExpr extends TextExpr,
  TTsType = StrictFnReturn<[TExpr], string>,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<IsArg<TExpr>, HasArg<TExpr>>,
  "scalar",
  "text",
  TTsType
> {
  constructor(private readonly expr: TExpr) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return SqlFn._stringToSQL(value as string | null);
  }
  fromDriverValue(value: unknown): TTsType | null {
    return SqlFn._stringFromDriver(value) as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "trim(";
    appendTextExpr(query, this.expr, ctx);
    query.sql += ")";
  }
}

/** Removes leading and trailing whitespace from a string expression. */
export function trim<TExpr extends TextExpr>(
  expr: TExpr,
): TrimFn<TExpr, StrictFnReturn<[TExpr], string>> {
  return new TrimFn(expr);
}

// ============================================================================
// left
// ============================================================================

export class LeftFn<
  TExpr extends TextExpr,
  TN extends number | Arg<number> | null = number,
  TTsType = StrictFnReturn<[TExpr, TN], string>,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<
    TExpr extends string | Arg<string> ? IsArg<TExpr> : HasArg<TExpr>,
    IsArg<TN>
  >,
  "scalar",
  "text",
  TTsType
> {
  constructor(
    private readonly expr: TExpr,
    private readonly n: TN,
  ) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return SqlFn._stringToSQL(value as string | null);
  }
  fromDriverValue(value: unknown): TTsType | null {
    return SqlFn._stringFromDriver(value) as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "left(";
    appendTextExpr(query, this.expr, ctx);
    query.sql += ", ";
    if (this.n === null) {
      query.sql += "NULL";
    } else if (is(this.n, Arg)) {
      query.addArg(this.n);
    } else {
      query.sql += (this.n as number).toString();
    }
    query.sql += ")";
  }
}

/** Returns the first `n` characters of a string expression. */
export function left<TExpr extends TextExpr>(
  expr: TExpr,
  n: number,
): LeftFn<TExpr, number, StrictFnReturn<[TExpr, number], string>>;
export function left<TExpr extends TextExpr>(
  expr: TExpr,
  n: Arg<number>,
): LeftFn<TExpr, Arg<number>, StrictFnReturn<[TExpr, Arg<number>], string>>;
export function left<TExpr extends TextExpr>(
  expr: TExpr,
  n: null,
): LeftFn<TExpr, null, null>;
export function left<
  TExpr extends TextExpr,
  TN extends number | Arg<number> | null,
>(expr: TExpr, n: TN): LeftFn<TExpr, TN, StrictFnReturn<[TExpr, TN], string>>;
export function left<TExpr extends TextExpr>(
  expr: TExpr,
  n: number | Arg<number> | null,
): LeftFn<TExpr, typeof n, StrictFnReturn<[TExpr, typeof n], string>> {
  return new LeftFn(expr, n);
}

// ============================================================================
// right
// ============================================================================

export class RightFn<
  TExpr extends TextExpr,
  TN extends number | Arg<number> | null = number,
  TTsType = StrictFnReturn<[TExpr, TN], string>,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<
    TExpr extends string | Arg<string> ? IsArg<TExpr> : HasArg<TExpr>,
    IsArg<TN>
  >,
  "scalar",
  "text",
  TTsType
> {
  constructor(
    private readonly expr: TExpr,
    private readonly n: TN,
  ) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return SqlFn._stringToSQL(value as string | null);
  }
  fromDriverValue(value: unknown): TTsType | null {
    return SqlFn._stringFromDriver(value) as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "right(";
    appendTextExpr(query, this.expr, ctx);
    query.sql += ", ";
    if (this.n === null) {
      query.sql += "NULL";
    } else if (is(this.n, Arg)) {
      query.addArg(this.n);
    } else {
      query.sql += (this.n as number).toString();
    }
    query.sql += ")";
  }
}

/** Returns the last `n` characters of a string expression. */
export function right<TExpr extends TextExpr>(
  expr: TExpr,
  n: number,
): RightFn<TExpr, number, StrictFnReturn<[TExpr, number], string>>;
export function right<TExpr extends TextExpr>(
  expr: TExpr,
  n: Arg<number>,
): RightFn<TExpr, Arg<number>, StrictFnReturn<[TExpr, Arg<number>], string>>;
export function right<TExpr extends TextExpr>(
  expr: TExpr,
  n: null,
): RightFn<TExpr, null, null>;
export function right<
  TExpr extends TextExpr,
  TN extends number | Arg<number> | null,
>(expr: TExpr, n: TN): RightFn<TExpr, TN, StrictFnReturn<[TExpr, TN], string>>;
export function right<TExpr extends TextExpr>(
  expr: TExpr,
  n: number | Arg<number> | null,
): RightFn<TExpr, typeof n, StrictFnReturn<[TExpr, typeof n], string>> {
  return new RightFn(expr, n);
}

// ============================================================================
// position
// ============================================================================

export class PositionFn<
  TExpr extends TextExpr,
  TSearch extends string | Arg<string> | null,
  TTsType = StrictFnReturn<[TExpr, TSearch], number>,
> extends SqlFn<
  ExprColumns<TExpr>,
  Or<
    TExpr extends string | Arg<string> ? IsArg<TExpr> : HasArg<TExpr>,
    IsArg<TSearch>
  >,
  "scalar",
  "numeric",
  TTsType
> {
  constructor(
    private readonly expr: TExpr,
    private readonly search: TSearch,
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
    query.sql += "strpos(";
    appendTextExpr(query, this.expr, ctx);
    query.sql += ", ";
    if (this.search === null) {
      query.sql += "NULL";
    } else if (is(this.search, Arg<string>)) {
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
  TSearch extends string | Arg<string> | null,
>(
  expr: TExpr,
  search: TSearch,
): PositionFn<TExpr, TSearch, StrictFnReturn<[TExpr, TSearch], number>> {
  return new PositionFn(expr, search);
}

// ============================================================================
// concat
// ============================================================================

export class ConcatFn<
  TExprs extends readonly ConcatOperand[],
  THasArg extends boolean = HasArgInTuple<TExprs>,
> extends SqlFn<
  ExprColumns<TExprs[number]>,
  THasArg,
  "scalar",
  "text",
  string
> {
  constructor(private readonly exprs: TExprs) {
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
    query.sql += "concat(";
    this.exprs.forEach((expr, i) => {
      appendTextExpr(query, expr, ctx);
      if (i < this.exprs.length - 1) query.sql += ", ";
    });
    query.sql += ")";
  }
}

/** Concatenates the text representations of all arguments into a single string. NULL arguments are ignored. */
export function concat<
  TExprs extends readonly [ConcatOperand, ...ConcatOperand[]],
>(...exprs: TExprs): ConcatFn<TExprs, HasArgInTuple<TExprs>> {
  return new ConcatFn(exprs);
}

// ============================================================================
// concat_ws
// ============================================================================

export class ConcatWsFn<
  TSep extends ConcatOperand,
  TExprs extends readonly ConcatOperand[],
  TTsType = StrictFnReturn<[TSep], string>,
  THasArg extends boolean = Or<
    Or<IsArg<TSep>, HasArg<TSep>>,
    HasArgInTuple<TExprs>
  >,
> extends SqlFn<
  ExprColumns<TSep> | ExprColumns<TExprs[number]>,
  THasArg,
  "scalar",
  "text",
  TTsType
> {
  constructor(
    private readonly sep: TSep,
    private readonly exprs: TExprs,
  ) {
    super();
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    return SqlFn._stringToSQL(value as string | null);
  }
  fromDriverValue(value: unknown): TTsType | null {
    return SqlFn._stringFromDriver(value) as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "concat_ws(";
    appendTextExpr(query, this.sep, ctx);
    if (this.exprs.length > 0) {
      query.sql += ", ";
      this.exprs.forEach((expr, i) => {
        appendTextExpr(query, expr, ctx);
        if (i < this.exprs.length - 1) query.sql += ", ";
      });
    }
    query.sql += ")";
  }
}

/** Concatenates arguments with a separator. If the separator is NULL, the result is NULL. */
export function concatWs<
  TSep extends ConcatOperand,
  TExprs extends readonly [ConcatOperand, ...ConcatOperand[]],
>(
  sep: TSep,
  ...exprs: TExprs
): ConcatWsFn<
  TSep,
  TExprs,
  StrictFnReturn<[TSep], string>,
  Or<Or<IsArg<TSep>, HasArg<TSep>>, HasArgInTuple<TExprs>>
> {
  return new ConcatWsFn(sep, exprs);
}
