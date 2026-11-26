import type { IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import { escLiteral } from "../sql";
import type { Or } from "../types";
import {
  appendOperand,
  type ExprColumns,
  type HasAggregateOf,
  type HasArg,
  SqlFn,
  type StrictFnReturn,
} from "./index";
import type { TextExpr } from "./string";
import {
  type NormalizedTypedOperand,
  normalizeTypedScalar,
  type TypedScalarArg,
} from "./subquery";

type NormalizedText<T> = NormalizedTypedOperand<T, "text">;

const textOperandOptions = { argCastFallback: "text" };

/** Appends a text operand, casting untyped placeholders to `text`. */
export function appendTextOperand(
  query: Query,
  expr: TextExpr,
  ctx?: QueryContext,
): void {
  appendOperand(query, expr, ctx, textOperandOptions);
}

// ============================================================================
// similarity / word_similarity / strict_word_similarity
// ============================================================================

export type TrgmSimilarityName =
  | "similarity"
  | "word_similarity"
  | "strict_word_similarity";

export class TrgmSimilarityFn<
  TName extends TrgmSimilarityName,
  TLeft extends TextExpr,
  TRight extends TextExpr,
  TTsType = StrictFnReturn<[TLeft, TRight], number>,
> extends SqlFn<
  ExprColumns<TLeft> | ExprColumns<TRight>,
  "scalar",
  "numeric",
  TTsType,
  Or<Or<IsArg<TLeft>, HasArg<TLeft>>, Or<IsArg<TRight>, HasArg<TRight>>>,
  HasAggregateOf<TLeft | TRight>
> {
  constructor(
    private readonly name: TName,
    private readonly left: TLeft,
    private readonly right: TRight,
  ) {
    super(
      SqlFn._hasAggregate(left) || SqlFn._hasAggregate(right),
      SqlFn._hasWindow(left) || SqlFn._hasWindow(right),
    );
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
    query.sql += this.name;
    query.sql += "(";
    appendTextOperand(query, this.left, ctx);
    query.sql += ", ";
    appendTextOperand(query, this.right, ctx);
    query.sql += ")";
  }
}

/** Measures the trigram similarity of two text values. */
export function similarity<TLeft extends TextExpr, TRight extends TextExpr>(
  left: TypedScalarArg<TLeft, "text">,
  right: TypedScalarArg<TRight, "text">,
): TrgmSimilarityFn<
  "similarity",
  NormalizedText<TLeft>,
  NormalizedText<TRight>,
  StrictFnReturn<[NormalizedText<TLeft>, NormalizedText<TRight>], number>
> {
  return new TrgmSimilarityFn(
    "similarity",
    normalizeTypedScalar<TLeft, "text">(left),
    normalizeTypedScalar<TRight, "text">(right),
  );
}

/** Measures the greatest similarity between the first value and a contiguous extent of the second. */
export function wordSimilarity<TLeft extends TextExpr, TRight extends TextExpr>(
  left: TypedScalarArg<TLeft, "text">,
  right: TypedScalarArg<TRight, "text">,
): TrgmSimilarityFn<
  "word_similarity",
  NormalizedText<TLeft>,
  NormalizedText<TRight>,
  StrictFnReturn<[NormalizedText<TLeft>, NormalizedText<TRight>], number>
> {
  return new TrgmSimilarityFn(
    "word_similarity",
    normalizeTypedScalar<TLeft, "text">(left),
    normalizeTypedScalar<TRight, "text">(right),
  );
}

/** Like `wordSimilarity`, but the extent in the second value must be a whole word. */
export function strictWordSimilarity<
  TLeft extends TextExpr,
  TRight extends TextExpr,
>(
  left: TypedScalarArg<TLeft, "text">,
  right: TypedScalarArg<TRight, "text">,
): TrgmSimilarityFn<
  "strict_word_similarity",
  NormalizedText<TLeft>,
  NormalizedText<TRight>,
  StrictFnReturn<[NormalizedText<TLeft>, NormalizedText<TRight>], number>
> {
  return new TrgmSimilarityFn(
    "strict_word_similarity",
    normalizeTypedScalar<TLeft, "text">(left),
    normalizeTypedScalar<TRight, "text">(right),
  );
}

// ============================================================================
// show_trgm
// ============================================================================

export class ShowTrgmFn<
  TText extends TextExpr,
  TTsType = StrictFnReturn<[TText], string[]>,
> extends SqlFn<
  ExprColumns<TText>,
  "scalar",
  "text[]",
  TTsType,
  Or<IsArg<TText>, HasArg<TText>>,
  HasAggregateOf<TText>
> {
  constructor(private readonly text: TText) {
    super(SqlFn._hasAggregate(text), SqlFn._hasWindow(text));
  }

  toDriverValue(value: TTsType | null): unknown {
    return value;
  }
  toSQLValue(value: TTsType | null): string {
    if (value === null) return "NULL";
    const items = value as string[];
    const literals: string[] = [];
    for (const item of items) {
      literals.push(`'${escLiteral(item)}'`);
    }
    return `ARRAY[${literals.join(", ")}]`;
  }
  fromDriverValue(value: unknown): TTsType | null {
    return (Array.isArray(value) ? value : null) as TTsType | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "show_trgm(";
    appendTextOperand(query, this.text, ctx);
    query.sql += ")";
  }
}

/** Returns the array of trigrams extracted from a text value. */
export function showTrgm<TText extends TextExpr>(
  text: TypedScalarArg<TText, "text">,
): ShowTrgmFn<
  NormalizedText<TText>,
  StrictFnReturn<[NormalizedText<TText>], string[]>
> {
  return new ShowTrgmFn(normalizeTypedScalar<TText, "text">(text));
}
