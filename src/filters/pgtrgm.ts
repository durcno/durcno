import {
  type ExprColumns,
  type HasAggregateOf,
  type HasArg,
  SqlFn,
} from "../functions";
import { appendTextOperand } from "../functions/pgtrgm";
import type { TextExpr } from "../functions/string";
import {
  type NormalizedTypedOperand,
  normalizeTypedScalar,
  type TypedScalarArg,
} from "../functions/subquery";
import type { IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import type { Or } from "../types";
import { Filter } from "./index";

type NormalizedText<T> = NormalizedTypedOperand<T, "text">;

/** Operator rendered by a trigram predicate. */
export type TrgmPredicateName = "%" | "<%" | "<<%";

/**
 * Trigram predicate: `<text> <operator> <text>`.
 *
 * For the word operators the term is the first argument and the text is the
 * second, matching PostgreSQL's argument order.
 */
export class TrgmPredicateFilter<
  TName extends TrgmPredicateName,
  TLeft extends TextExpr,
  TRight extends TextExpr,
> extends Filter<
  ExprColumns<TLeft> | ExprColumns<TRight>,
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

  toQuery(query: Query, ctx?: QueryContext): void {
    appendTextOperand(query, this.left, ctx);
    query.sql += " ";
    query.sql += this.name;
    query.sql += " ";
    appendTextOperand(query, this.right, ctx);
  }
}

/** Whole-string trigram similarity predicate: `left % right`. */
export function similar<TLeft extends TextExpr, TRight extends TextExpr>(
  left: TypedScalarArg<TLeft, "text">,
  right: TypedScalarArg<TRight, "text">,
): TrgmPredicateFilter<"%", NormalizedText<TLeft>, NormalizedText<TRight>> {
  return new TrgmPredicateFilter(
    "%",
    normalizeTypedScalar<TLeft, "text">(left),
    normalizeTypedScalar<TRight, "text">(right),
  );
}

/** Word trigram similarity predicate: `term <% text`. */
export function wordSimilar<TLeft extends TextExpr, TRight extends TextExpr>(
  left: TypedScalarArg<TLeft, "text">,
  right: TypedScalarArg<TRight, "text">,
): TrgmPredicateFilter<"<%", NormalizedText<TLeft>, NormalizedText<TRight>> {
  return new TrgmPredicateFilter(
    "<%",
    normalizeTypedScalar<TLeft, "text">(left),
    normalizeTypedScalar<TRight, "text">(right),
  );
}

/** Strict-word trigram similarity predicate: `term <<% text`. */
export function strictWordSimilar<
  TLeft extends TextExpr,
  TRight extends TextExpr,
>(
  left: TypedScalarArg<TLeft, "text">,
  right: TypedScalarArg<TRight, "text">,
): TrgmPredicateFilter<"<<%", NormalizedText<TLeft>, NormalizedText<TRight>> {
  return new TrgmPredicateFilter(
    "<<%",
    normalizeTypedScalar<TLeft, "text">(left),
    normalizeTypedScalar<TRight, "text">(right),
  );
}
