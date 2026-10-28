import { is } from "../entity";
import { type AnyArg, Arg, type IsArg } from "../query-builders/prepare";
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
  type NormalizedOperand,
  type NormalizedTypedOperand,
  normalizeScalarFn,
  normalizeScalars,
  normalizeTypedScalar,
  type PgTypedOperand,
  type ScalarArg,
  type ScalarQueryLike,
  type TypedScalarArg,
} from "./subquery";

export type TextExpr =
  | PgTypedOperand<"text">
  | ScalarQueryLike
  | string
  | Arg<string>
  | Sql<string>
  | null;

export type ConcatOperand =
  | AnyScalarColumn
  | AnySqlFn
  | ScalarQueryLike
  | Sql
  | AnyArg
  | string
  | number
  | bigint
  | boolean
  | null;

/** A text operand after scalar-query normalization. */
type NormalizedText<T> = NormalizedTypedOperand<T, "text">;

/** A concat operand after scalar-query normalization. */
type NormalizedConcatOperand<T> = NormalizedOperand<T, AnySqlFn>;

/** A tuple of concat operands after scalar-query normalization. */
type NormalizedConcatOperands<TExprs extends readonly ConcatOperand[]> = {
  [K in keyof TExprs]: NormalizedConcatOperand<TExprs[K]>;
};

export type HasArgInTuple<TTuple extends readonly unknown[]> =
  TTuple extends readonly [infer Head, ...infer Tail]
    ? Or<Or<IsArg<Head>, HasArg<Head>>, HasArgInTuple<Tail>>
    : false;

/** Normalizes a text operand and narrows it to the text expression branch. */
function normalizeText<T extends TextExpr>(
  expr: TypedScalarArg<T, "text">,
): NormalizedText<T> {
  return normalizeTypedScalar(expr);
}

/** Normalizes a concat operand. */
function normalizeConcatOperand<T extends ConcatOperand>(
  operand: ScalarArg<T>,
): NormalizedConcatOperand<T> {
  return normalizeScalarFn(operand);
}

/** Normalizes a concat operand tuple. */
function normalizeConcatOperands<TExprs extends readonly ConcatOperand[]>(
  exprs: TExprs,
): NormalizedConcatOperands<TExprs> {
  return normalizeScalars(exprs) as unknown as NormalizedConcatOperands<TExprs>;
}

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
    query.sql += "length(";
    appendTextExpr(query, this.expr, ctx);
    query.sql += ")";
  }
}

/** Returns the number of characters in a string expression. */
export function length<TExpr extends TextExpr>(
  expr: TypedScalarArg<TExpr, "text">,
): LengthFn<
  NormalizedText<TExpr>,
  StrictFnReturn<[NormalizedText<TExpr>], number>
> {
  return new LengthFn(normalizeText(expr));
}

// ============================================================================
// lower
// ============================================================================

export class LowerFn<
  TExpr extends TextExpr,
  TTsType = StrictFnReturn<[TExpr], string>,
> extends SqlFn<
  ExprColumns<TExpr>,
  "scalar",
  "text",
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
  expr: TypedScalarArg<TExpr, "text">,
): LowerFn<
  NormalizedText<TExpr>,
  StrictFnReturn<[NormalizedText<TExpr>], string>
> {
  return new LowerFn(normalizeText(expr));
}

// ============================================================================
// upper
// ============================================================================

export class UpperFn<
  TExpr extends TextExpr,
  TTsType = StrictFnReturn<[TExpr], string>,
> extends SqlFn<
  ExprColumns<TExpr>,
  "scalar",
  "text",
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
  expr: TypedScalarArg<TExpr, "text">,
): UpperFn<
  NormalizedText<TExpr>,
  StrictFnReturn<[NormalizedText<TExpr>], string>
> {
  return new UpperFn(normalizeText(expr));
}

// ============================================================================
// trim
// ============================================================================

export class TrimFn<
  TExpr extends TextExpr,
  TTsType = StrictFnReturn<[TExpr], string>,
> extends SqlFn<
  ExprColumns<TExpr>,
  "scalar",
  "text",
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
  expr: TypedScalarArg<TExpr, "text">,
): TrimFn<
  NormalizedText<TExpr>,
  StrictFnReturn<[NormalizedText<TExpr>], string>
> {
  return new TrimFn(normalizeText(expr));
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
  "scalar",
  "text",
  TTsType,
  Or<
    TExpr extends string | Arg<string> ? IsArg<TExpr> : HasArg<TExpr>,
    IsArg<TN>
  >,
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
  expr: TypedScalarArg<TExpr, "text">,
  n: number,
): LeftFn<
  NormalizedText<TExpr>,
  number,
  StrictFnReturn<[NormalizedText<TExpr>, number], string>
>;
export function left<TExpr extends TextExpr>(
  expr: TypedScalarArg<TExpr, "text">,
  n: Arg<number>,
): LeftFn<
  NormalizedText<TExpr>,
  Arg<number>,
  StrictFnReturn<[NormalizedText<TExpr>, Arg<number>], string>
>;
export function left<TExpr extends TextExpr>(
  expr: TypedScalarArg<TExpr, "text">,
  n: null,
): LeftFn<NormalizedText<TExpr>, null, null>;
export function left<
  TExpr extends TextExpr,
  TN extends number | Arg<number> | null,
>(
  expr: TypedScalarArg<TExpr, "text">,
  n: TN,
): LeftFn<
  NormalizedText<TExpr>,
  TN,
  StrictFnReturn<[NormalizedText<TExpr>, TN], string>
>;
export function left<TExpr extends TextExpr>(
  expr: TypedScalarArg<TExpr, "text">,
  n: number | Arg<number> | null,
): LeftFn<
  NormalizedText<TExpr>,
  typeof n,
  StrictFnReturn<[NormalizedText<TExpr>, typeof n], string>
> {
  return new LeftFn(normalizeText(expr), n);
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
  "scalar",
  "text",
  TTsType,
  Or<
    TExpr extends string | Arg<string> ? IsArg<TExpr> : HasArg<TExpr>,
    IsArg<TN>
  >,
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
  expr: TypedScalarArg<TExpr, "text">,
  n: number,
): RightFn<
  NormalizedText<TExpr>,
  number,
  StrictFnReturn<[NormalizedText<TExpr>, number], string>
>;
export function right<TExpr extends TextExpr>(
  expr: TypedScalarArg<TExpr, "text">,
  n: Arg<number>,
): RightFn<
  NormalizedText<TExpr>,
  Arg<number>,
  StrictFnReturn<[NormalizedText<TExpr>, Arg<number>], string>
>;
export function right<TExpr extends TextExpr>(
  expr: TypedScalarArg<TExpr, "text">,
  n: null,
): RightFn<NormalizedText<TExpr>, null, null>;
export function right<
  TExpr extends TextExpr,
  TN extends number | Arg<number> | null,
>(
  expr: TypedScalarArg<TExpr, "text">,
  n: TN,
): RightFn<
  NormalizedText<TExpr>,
  TN,
  StrictFnReturn<[NormalizedText<TExpr>, TN], string>
>;
export function right<TExpr extends TextExpr>(
  expr: TypedScalarArg<TExpr, "text">,
  n: number | Arg<number> | null,
): RightFn<
  NormalizedText<TExpr>,
  typeof n,
  StrictFnReturn<[NormalizedText<TExpr>, typeof n], string>
> {
  return new RightFn(normalizeText(expr), n);
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
  "scalar",
  "numeric",
  TTsType,
  Or<
    TExpr extends string | Arg<string> ? IsArg<TExpr> : HasArg<TExpr>,
    IsArg<TSearch>
  >,
  HasAggregateOf<TExpr>
> {
  constructor(
    private readonly expr: TExpr,
    private readonly search: TSearch,
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
  expr: TypedScalarArg<TExpr, "text">,
  search: TSearch,
): PositionFn<
  NormalizedText<TExpr>,
  TSearch,
  StrictFnReturn<[NormalizedText<TExpr>, TSearch], number>
> {
  return new PositionFn(normalizeText(expr), search);
}

// ============================================================================
// concat
// ============================================================================

export class ConcatFn<
  TExprs extends readonly ConcatOperand[],
  THasArg extends boolean = HasArgInTuple<TExprs>,
> extends SqlFn<
  ExprColumns<TExprs[number]>,
  "scalar",
  "text",
  string,
  THasArg,
  HasAggregateOf<TExprs[number]>
> {
  constructor(private readonly exprs: TExprs) {
    super(SqlFn._hasAggregate(exprs), SqlFn._hasWindow(exprs));
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
    const exprs = this.exprs;
    for (let i = 0; i < exprs.length; i++) {
      if (i !== 0) query.sql += ", ";
      appendTextExpr(query, exprs[i], ctx);
    }
    query.sql += ")";
  }
}

/** Concatenates the text representations of all arguments into a single string. NULL arguments are ignored. */
export function concat<
  TExprs extends readonly [ConcatOperand, ...ConcatOperand[]],
>(
  ...exprs: TExprs & { [K in keyof TExprs]: ScalarArg<TExprs[K]> }
): ConcatFn<
  NormalizedConcatOperands<TExprs>,
  HasArgInTuple<NormalizedConcatOperands<TExprs>>
> {
  return new ConcatFn<
    NormalizedConcatOperands<TExprs>,
    HasArgInTuple<NormalizedConcatOperands<TExprs>>
  >(normalizeConcatOperands<TExprs>(exprs));
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
  "scalar",
  "text",
  TTsType,
  THasArg,
  HasAggregateOf<TSep | TExprs[number]>
> {
  constructor(
    private readonly sep: TSep,
    private readonly exprs: TExprs,
  ) {
    super(
      SqlFn._hasAggregate(sep) || SqlFn._hasAggregate(exprs),
      SqlFn._hasWindow(sep) || SqlFn._hasWindow(exprs),
    );
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
    const exprs = this.exprs;
    if (exprs.length > 0) {
      query.sql += ", ";
      for (let i = 0; i < exprs.length; i++) {
        if (i !== 0) query.sql += ", ";
        appendTextExpr(query, exprs[i], ctx);
      }
    }
    query.sql += ")";
  }
}

/** Concatenates arguments with a separator. If the separator is NULL, the result is NULL. */
export function concatWs<
  TSep extends ConcatOperand,
  TExprs extends readonly [ConcatOperand, ...ConcatOperand[]],
>(
  sep: ScalarArg<TSep>,
  ...exprs: TExprs & { [K in keyof TExprs]: ScalarArg<TExprs[K]> }
): ConcatWsFn<
  NormalizedConcatOperand<TSep>,
  NormalizedConcatOperands<TExprs>,
  StrictFnReturn<[NormalizedConcatOperand<TSep>], string>,
  Or<
    Or<IsArg<TSep>, HasArg<NormalizedConcatOperand<TSep>>>,
    HasArgInTuple<NormalizedConcatOperands<TExprs>>
  >
> {
  return new ConcatWsFn<
    NormalizedConcatOperand<TSep>,
    NormalizedConcatOperands<TExprs>,
    StrictFnReturn<[NormalizedConcatOperand<TSep>], string>,
    Or<
      Or<IsArg<TSep>, HasArg<NormalizedConcatOperand<TSep>>>,
      HasArgInTuple<NormalizedConcatOperands<TExprs>>
    >
  >(normalizeConcatOperand(sep), normalizeConcatOperands<TExprs>(exprs));
}
