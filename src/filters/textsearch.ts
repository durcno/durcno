import {
  type ExprColumns,
  type HasAggregateOf,
  type HasArg,
  SqlFn,
} from "../functions";
import {
  normalizeTypedScalar,
  type TypedScalarArg,
} from "../functions/subquery";
import {
  appendTsOperand,
  type NormalizedTsQuery,
  type NormalizedTsVector,
  type TsQueryExpr,
  type TsVectorExpr,
} from "../functions/textsearch";
import type { IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import type { Or } from "../types";
import { Filter } from "./index";

/**
 * Full-text search predicate: `vector @@ query`.
 *
 * Matches rows whose `tsvector` satisfies the given `tsquery`.
 */
export class TsMatchFilter<
  TVector extends TsVectorExpr,
  TQuery extends TsQueryExpr,
> extends Filter<
  ExprColumns<TVector> | ExprColumns<TQuery>,
  Or<Or<IsArg<TVector>, HasArg<TVector>>, Or<IsArg<TQuery>, HasArg<TQuery>>>,
  HasAggregateOf<TVector | TQuery>
> {
  constructor(
    private readonly vector: TVector,
    private readonly query: TQuery,
  ) {
    super(
      SqlFn._hasAggregate(vector) || SqlFn._hasAggregate(query),
      SqlFn._hasWindow(vector) || SqlFn._hasWindow(query),
    );
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    appendTsOperand(query, this.vector, "tsvector", ctx);
    query.sql += " @@ ";
    appendTsOperand(query, this.query, "tsquery", ctx);
  }
}

/**
 * Creates a full-text search condition: `vector @@ query`.
 *
 * @example
 * ```ts
 * db.from(Articles)
 *   .select("*")
 *   .where(() =>
 *     tsMatch(Articles.search, websearchToTsquery("postgres full text"))
 *   );
 * ```
 *
 * @see https://www.postgresql.org/docs/current/textsearch-tables.html
 */
export function tsMatch<
  TVector extends TsVectorExpr,
  TQuery extends TsQueryExpr,
>(
  vector: TypedScalarArg<TVector, "tsvector">,
  query: TypedScalarArg<TQuery, "tsquery">,
): TsMatchFilter<NormalizedTsVector<TVector>, NormalizedTsQuery<TQuery>> {
  return new TsMatchFilter(
    normalizeTypedScalar<TVector, "tsvector">(vector),
    normalizeTypedScalar<TQuery, "tsquery">(query),
  );
}
