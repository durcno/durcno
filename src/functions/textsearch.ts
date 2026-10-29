import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import { escLiteral, type Sql } from "../sql";
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
  type PgTypedOperand,
  type ScalarQueryLike,
  type TypedScalarArg,
} from "./subquery";

/** A `tsvector` value expression: a column, SQL expression, literal, or `null`. */
export type TsVectorExpr =
  | PgTypedOperand<"tsvector">
  | ScalarQueryLike
  | string
  | Arg<string>
  | Sql<string>
  | null;

/** A `tsquery` value expression: a column, SQL expression, literal, or `null`. */
export type TsQueryExpr =
  | PgTypedOperand<"tsquery">
  | ScalarQueryLike
  | string
  | Arg<string>
  | Sql<string>
  | null;

/** A text search configuration name expression. */
export type TsConfig = string | Arg<string> | Sql;

/** A `tsvector` operator after scalar-query normalization. */
export type NormalizedTsVector<T> = NormalizedTypedOperand<T, "tsvector">;

/** A `tsquery` operator after scalar-query normalization. */
export type NormalizedTsQuery<T> = NormalizedTypedOperand<T, "tsquery">;

/** A text operand after scalar-query normalization. */
type NormalizedText<T> = NormalizedTypedOperand<T, "text">;

/** Weights accepted by `setweight`. */
export type TsWeight = "A" | "B" | "C" | "D";

/** Options accepted by `tsHeadline`. */
export interface TsHeadlineOptions {
  /** Text search configuration name; defaults to `default_text_search_config`. */
  config?: TsConfig;
  /** `ts_headline` options string, e.g. `"StartSel=<mark>, StopSel=</mark>"`. */
  options?: string | Arg<string> | Sql<string> | null;
}

/** Normalizes a text operand and narrows it to the text expression branch. */
function normalizeText<T extends TextExpr>(
  expr: TypedScalarArg<T, "text">,
): NormalizedText<T> {
  return normalizeTypedScalar(expr);
}

/** Normalizes a tsvector operand. */
function normalizeTsVector<T extends TsVectorExpr>(
  expr: TypedScalarArg<T, "tsvector">,
): NormalizedTsVector<T> {
  return normalizeTypedScalar(expr);
}

/** Normalizes a tsquery operand. */
function normalizeTsQuery<T extends TsQueryExpr>(
  expr: TypedScalarArg<T, "tsquery">,
): NormalizedTsQuery<T> {
  return normalizeTypedScalar(expr);
}

/** Appends a tsvector/tsquery operand, casting literals and `Arg`s to its type. */
export function appendTsOperand(
  query: Query,
  expr: TsVectorExpr | TsQueryExpr,
  cast: "tsvector" | "tsquery",
  ctx?: QueryContext,
): void {
  if (expr === null) {
    query.sql += "NULL";
  } else if (typeof expr === "string") {
    query.sql += `'${escLiteral(expr)}'::${cast}`;
  } else if (is(expr, Arg<string>)) {
    query.addArg(expr, cast);
  } else {
    appendOperand(query, expr, ctx);
  }
}

/** Appends a text search configuration name, casting `Arg`s to `regconfig`. */
function appendConfig(
  query: Query,
  config: TsConfig,
  ctx?: QueryContext,
): void {
  if (typeof config === "string") {
    query.sql += `'${escLiteral(config)}'`;
  } else if (is(config, Arg<string>)) {
    query.addArg(config, "regconfig");
  } else {
    config.toQuery(query, ctx);
  }
}

// ============================================================================
// to_tsvector
// ============================================================================

export class ToTsvectorFn<
  TDocument extends TextExpr,
  TConfig extends TsConfig | undefined = undefined,
  TTsType = StrictFnReturn<[TDocument], string>,
> extends SqlFn<
  ExprColumns<TDocument>,
  "scalar",
  "tsvector",
  TTsType,
  Or<Or<IsArg<TDocument>, HasArg<TDocument>>, IsArg<TConfig>>,
  HasAggregateOf<TDocument>
> {
  constructor(
    private readonly document: TDocument,
    private readonly config?: TConfig,
  ) {
    super(SqlFn._hasAggregate(document), SqlFn._hasWindow(document));
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
    query.sql += "to_tsvector(";
    if (this.config !== undefined) {
      appendConfig(query, this.config as TsConfig, ctx);
      query.sql += ", ";
    }
    appendOperand(query, this.document, ctx);
    query.sql += ")";
  }
}

/**
 * Parses a text expression into a `tsvector`, optionally using a text search
 * configuration such as `"english"` or `"simple"`.
 *
 * @see https://www.postgresql.org/docs/current/textsearch-controls.html
 */
export function toTsvector<
  TDocument extends TextExpr,
  TConfig extends TsConfig | undefined = undefined,
>(
  document: TypedScalarArg<TDocument, "text">,
  config?: TConfig,
): ToTsvectorFn<
  NormalizedText<TDocument>,
  TConfig,
  StrictFnReturn<[NormalizedText<TDocument>], string>
> {
  return new ToTsvectorFn(normalizeText(document), config);
}

// ============================================================================
// to_tsquery / plainto_tsquery / phraseto_tsquery / websearch_to_tsquery
// ============================================================================

export type TsqueryParserName =
  | "to_tsquery"
  | "plainto_tsquery"
  | "phraseto_tsquery"
  | "websearch_to_tsquery";

export class TsqueryParserFn<
  TName extends TsqueryParserName,
  TQuery extends TextExpr,
  TConfig extends TsConfig | undefined = undefined,
  TTsType = StrictFnReturn<[TQuery], string>,
> extends SqlFn<
  ExprColumns<TQuery>,
  "scalar",
  "tsquery",
  TTsType,
  Or<Or<IsArg<TQuery>, HasArg<TQuery>>, IsArg<TConfig>>,
  HasAggregateOf<TQuery>
> {
  constructor(
    private readonly name: TName,
    private readonly query: TQuery,
    private readonly config?: TConfig,
  ) {
    super(SqlFn._hasAggregate(query), SqlFn._hasWindow(query));
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
    query.sql += this.name;
    query.sql += "(";
    if (this.config !== undefined) {
      appendConfig(query, this.config as TsConfig, ctx);
      query.sql += ", ";
    }
    appendOperand(query, this.query, ctx);
    query.sql += ")";
  }
}

/** Parses a query expression with `&`, `|`, `!`, and `<->` operators. */
export function toTsquery<
  TQuery extends TextExpr,
  TConfig extends TsConfig | undefined = undefined,
>(
  query: TypedScalarArg<TQuery, "text">,
  config?: TConfig,
): TsqueryParserFn<
  "to_tsquery",
  NormalizedText<TQuery>,
  TConfig,
  StrictFnReturn<[NormalizedText<TQuery>], string>
> {
  return new TsqueryParserFn("to_tsquery", normalizeText(query), config);
}

/** Parses plain text into a `tsquery`, treating all words as required. */
export function plaintoTsquery<
  TQuery extends TextExpr,
  TConfig extends TsConfig | undefined = undefined,
>(
  query: TypedScalarArg<TQuery, "text">,
  config?: TConfig,
): TsqueryParserFn<
  "plainto_tsquery",
  NormalizedText<TQuery>,
  TConfig,
  StrictFnReturn<[NormalizedText<TQuery>], string>
> {
  return new TsqueryParserFn("plainto_tsquery", normalizeText(query), config);
}

/** Parses plain text into a phrase `tsquery`. */
export function phrasetoTsquery<
  TQuery extends TextExpr,
  TConfig extends TsConfig | undefined = undefined,
>(
  query: TypedScalarArg<TQuery, "text">,
  config?: TConfig,
): TsqueryParserFn<
  "phraseto_tsquery",
  NormalizedText<TQuery>,
  TConfig,
  StrictFnReturn<[NormalizedText<TQuery>], string>
> {
  return new TsqueryParserFn("phraseto_tsquery", normalizeText(query), config);
}

/** Parses web-search-style input into a `tsquery`; safest for untrusted input. */
export function websearchToTsquery<
  TQuery extends TextExpr,
  TConfig extends TsConfig | undefined = undefined,
>(
  query: TypedScalarArg<TQuery, "text">,
  config?: TConfig,
): TsqueryParserFn<
  "websearch_to_tsquery",
  NormalizedText<TQuery>,
  TConfig,
  StrictFnReturn<[NormalizedText<TQuery>], string>
> {
  return new TsqueryParserFn(
    "websearch_to_tsquery",
    normalizeText(query),
    config,
  );
}

// ============================================================================
// ts_headline
// ============================================================================

export class TsHeadlineFn<
  TDocument extends TextExpr,
  TQuery extends TsQueryExpr,
  TOptions extends
    | string
    | Arg<string>
    | Sql<string>
    | null
    | undefined = undefined,
  TConfig extends TsConfig | undefined = undefined,
  TTsType = StrictFnReturn<[TDocument, TQuery, TOptions], string>,
> extends SqlFn<
  ExprColumns<TDocument> | ExprColumns<TQuery>,
  "scalar",
  "text",
  TTsType,
  Or<
    Or<IsArg<TDocument>, HasArg<TDocument>>,
    Or<Or<IsArg<TQuery>, HasArg<TQuery>>, Or<IsArg<TOptions>, IsArg<TConfig>>>
  >,
  HasAggregateOf<TDocument | TQuery>
> {
  constructor(
    private readonly document: TDocument,
    private readonly query: TQuery,
    private readonly config?: TConfig,
    private readonly options?: TOptions,
  ) {
    super(
      SqlFn._hasAggregate(document) || SqlFn._hasAggregate(query),
      SqlFn._hasWindow(document) || SqlFn._hasWindow(query),
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
    query.sql += "ts_headline(";
    if (this.config !== undefined) {
      appendConfig(query, this.config as TsConfig, ctx);
      query.sql += ", ";
    }
    appendOperand(query, this.document, ctx);
    query.sql += ", ";
    appendTsOperand(query, this.query, "tsquery", ctx);
    if (this.options !== undefined) {
      query.sql += ", ";
      appendOperand(query, this.options, ctx);
    }
    query.sql += ")";
  }
}

/** Highlights query matches in a document and returns the resulting text. */
export function tsHeadline<
  TDocument extends TextExpr,
  TQuery extends TsQueryExpr,
  TOptions extends
    | string
    | Arg<string>
    | Sql<string>
    | null
    | undefined = undefined,
  TConfig extends TsConfig | undefined = undefined,
>(
  document: TypedScalarArg<TDocument, "text">,
  query: TypedScalarArg<TQuery, "tsquery">,
  options?: { config?: TConfig; options?: TOptions },
): TsHeadlineFn<
  NormalizedText<TDocument>,
  NormalizedTsQuery<TQuery>,
  TOptions,
  TConfig,
  StrictFnReturn<
    [NormalizedText<TDocument>, NormalizedTsQuery<TQuery>, TOptions],
    string
  >
> {
  return new TsHeadlineFn(
    normalizeText(document),
    normalizeTsQuery(query),
    options?.config,
    options?.options,
  );
}

// ============================================================================
// ts_rank / ts_rank_cd
// ============================================================================

export type TsRankName = "ts_rank" | "ts_rank_cd";

export class TsRankFn<
  TName extends TsRankName,
  TVector extends TsVectorExpr,
  TQuery extends TsQueryExpr,
  TNormalization extends number | Arg<number> | null | undefined = undefined,
  TTsType = StrictFnReturn<[TVector, TQuery, TNormalization], number>,
> extends SqlFn<
  ExprColumns<TVector> | ExprColumns<TQuery>,
  "scalar",
  "numeric",
  TTsType,
  Or<
    Or<IsArg<TVector>, HasArg<TVector>>,
    Or<Or<IsArg<TQuery>, HasArg<TQuery>>, IsArg<TNormalization>>
  >,
  HasAggregateOf<TVector | TQuery>
> {
  constructor(
    private readonly name: TName,
    private readonly vector: TVector,
    private readonly query: TQuery,
    private readonly normalization?: TNormalization,
  ) {
    super(
      SqlFn._hasAggregate(vector) || SqlFn._hasAggregate(query),
      SqlFn._hasWindow(vector) || SqlFn._hasWindow(query),
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
    appendTsOperand(query, this.vector, "tsvector", ctx);
    query.sql += ", ";
    appendTsOperand(query, this.query, "tsquery", ctx);
    if (this.normalization !== undefined) {
      query.sql += ", ";
      if (this.normalization === null) {
        query.sql += "NULL";
      } else if (is(this.normalization, Arg<number>)) {
        query.addArg(this.normalization);
      } else {
        query.sql += this.normalization.toString();
      }
    }
    query.sql += ")";
  }
}

/** Ranks a `tsvector` against a `tsquery`, optionally applying a normalization bitmask. */
export function tsRank<
  TVector extends TsVectorExpr,
  TQuery extends TsQueryExpr,
  TNormalization extends number | Arg<number> | null | undefined = undefined,
>(
  vector: TypedScalarArg<TVector, "tsvector">,
  query: TypedScalarArg<TQuery, "tsquery">,
  normalization?: TNormalization,
): TsRankFn<
  "ts_rank",
  NormalizedTsVector<TVector>,
  NormalizedTsQuery<TQuery>,
  TNormalization,
  StrictFnReturn<
    [NormalizedTsVector<TVector>, NormalizedTsQuery<TQuery>, TNormalization],
    number
  >
> {
  return new TsRankFn(
    "ts_rank",
    normalizeTsVector(vector),
    normalizeTsQuery(query),
    normalization,
  );
}

/** Ranks a `tsvector` using cover density, optionally applying a normalization bitmask. */
export function tsRankCd<
  TVector extends TsVectorExpr,
  TQuery extends TsQueryExpr,
  TNormalization extends number | Arg<number> | null | undefined = undefined,
>(
  vector: TypedScalarArg<TVector, "tsvector">,
  query: TypedScalarArg<TQuery, "tsquery">,
  normalization?: TNormalization,
): TsRankFn<
  "ts_rank_cd",
  NormalizedTsVector<TVector>,
  NormalizedTsQuery<TQuery>,
  TNormalization,
  StrictFnReturn<
    [NormalizedTsVector<TVector>, NormalizedTsQuery<TQuery>, TNormalization],
    number
  >
> {
  return new TsRankFn(
    "ts_rank_cd",
    normalizeTsVector(vector),
    normalizeTsQuery(query),
    normalization,
  );
}

// ============================================================================
// setweight / strip
// ============================================================================

export class SetweightFn<
  TVector extends TsVectorExpr,
  TWeight extends TsWeight = TsWeight,
  TTsType = StrictFnReturn<[TVector], string>,
> extends SqlFn<
  ExprColumns<TVector>,
  "scalar",
  "tsvector",
  TTsType,
  Or<IsArg<TVector>, HasArg<TVector>>,
  HasAggregateOf<TVector>
> {
  constructor(
    private readonly vector: TVector,
    private readonly weight: TWeight,
  ) {
    super(SqlFn._hasAggregate(vector), SqlFn._hasWindow(vector));
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
    query.sql += "setweight(";
    appendTsOperand(query, this.vector, "tsvector", ctx);
    query.sql += ", '";
    query.sql += this.weight;
    query.sql += "')";
  }
}

/** Assigns a weight (`A`–`D`) to every lexeme in a `tsvector`. */
export function setweight<
  TVector extends TsVectorExpr,
  TWeight extends TsWeight = TsWeight,
>(
  vector: TypedScalarArg<TVector, "tsvector">,
  weight: TWeight,
): SetweightFn<
  NormalizedTsVector<TVector>,
  TWeight,
  StrictFnReturn<[NormalizedTsVector<TVector>], string>
> {
  return new SetweightFn(normalizeTsVector(vector), weight);
}

export class StripFn<
  TVector extends TsVectorExpr,
  TTsType = StrictFnReturn<[TVector], string>,
> extends SqlFn<
  ExprColumns<TVector>,
  "scalar",
  "tsvector",
  TTsType,
  Or<IsArg<TVector>, HasArg<TVector>>,
  HasAggregateOf<TVector>
> {
  constructor(private readonly vector: TVector) {
    super(SqlFn._hasAggregate(vector), SqlFn._hasWindow(vector));
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
    query.sql += "strip(";
    appendTsOperand(query, this.vector, "tsvector", ctx);
    query.sql += ")";
  }
}

/** Removes positions and weights from a `tsvector`. */
export function strip<TVector extends TsVectorExpr>(
  vector: TypedScalarArg<TVector, "tsvector">,
): StripFn<
  NormalizedTsVector<TVector>,
  StrictFnReturn<[NormalizedTsVector<TVector>], string>
> {
  return new StripFn(normalizeTsVector(vector));
}

// ============================================================================
// querytree / numnode
// ============================================================================

export class QuerytreeFn<
  TQuery extends TsQueryExpr,
  TTsType = StrictFnReturn<[TQuery], string>,
> extends SqlFn<
  ExprColumns<TQuery>,
  "scalar",
  "text",
  TTsType,
  Or<IsArg<TQuery>, HasArg<TQuery>>,
  HasAggregateOf<TQuery>
> {
  constructor(private readonly query: TQuery) {
    super(SqlFn._hasAggregate(query), SqlFn._hasWindow(query));
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
    query.sql += "querytree(";
    appendTsOperand(query, this.query, "tsquery", ctx);
    query.sql += ")";
  }
}

/** Returns the part of a `tsquery` that can be used in an index scan. */
export function querytree<TQuery extends TsQueryExpr>(
  query: TypedScalarArg<TQuery, "tsquery">,
): QuerytreeFn<
  NormalizedTsQuery<TQuery>,
  StrictFnReturn<[NormalizedTsQuery<TQuery>], string>
> {
  return new QuerytreeFn(normalizeTsQuery(query));
}

export class NumnodeFn<
  TQuery extends TsQueryExpr,
  TTsType = StrictFnReturn<[TQuery], number>,
> extends SqlFn<
  ExprColumns<TQuery>,
  "scalar",
  "numeric",
  TTsType,
  Or<IsArg<TQuery>, HasArg<TQuery>>,
  HasAggregateOf<TQuery>
> {
  constructor(private readonly query: TQuery) {
    super(SqlFn._hasAggregate(query), SqlFn._hasWindow(query));
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
    query.sql += "numnode(";
    appendTsOperand(query, this.query, "tsquery", ctx);
    query.sql += ")";
  }
}

/** Returns the number of lexemes and operators in a `tsquery`. */
export function numnode<TQuery extends TsQueryExpr>(
  query: TypedScalarArg<TQuery, "tsquery">,
): NumnodeFn<
  NormalizedTsQuery<TQuery>,
  StrictFnReturn<[NormalizedTsQuery<TQuery>], number>
> {
  return new NumnodeFn(normalizeTsQuery(query));
}
