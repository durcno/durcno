import type { Column } from "../columns/common";
import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import type { Or } from "../types";
import { Filter } from "./index";

// biome-ignore lint/suspicious/noExplicitAny: text columns are wildcards here
export type TextScalarTableColumn = Column<any, any, "text"> & {
  config: { dimension?: undefined };
};

// ============================================================================
// startsWith
// ============================================================================

export class StartsWithCondition<
  TCol extends TextScalarTableColumn,
  TPrefix extends string | Arg<string>,
> extends Filter<TCol, IsArg<TPrefix>> {
  constructor(
    private readonly col: TCol,
    private readonly prefix: TPrefix,
  ) {
    super();
  }

  get referencedColumns(): TCol[] {
    return [this.col];
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "starts_with(";
    this.col.toQuery(query, ctx);
    query.sql += ", ";
    if (is(this.prefix, Arg<string>)) {
      query.addArg(this.prefix);
    } else {
      query.sql += `'${this.prefix.replace(/'/g, "''")}'`;
    }
    query.sql += ")";
  }
}

export function startsWith<
  TCol extends TextScalarTableColumn,
  TPrefix extends string | Arg<string>,
>(col: TCol, prefix: TPrefix): StartsWithCondition<TCol, TPrefix> {
  return new StartsWithCondition(col, prefix);
}

// ============================================================================
// endsWith
// ============================================================================

export class EndsWithCondition<
  TCol extends TextScalarTableColumn,
  TSuffix extends string | Arg<string>,
> extends Filter<TCol, IsArg<TSuffix>> {
  constructor(
    private readonly col: TCol,
    private readonly suffix: TSuffix,
  ) {
    super();
  }

  get referencedColumns(): TCol[] {
    return [this.col];
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    this.col.toQuery(query, ctx);
    query.sql += " LIKE('%' || ";
    if (is(this.suffix, Arg<string>)) {
      query.addArg(this.suffix);
    } else {
      query.sql += `'${this.suffix.replace(/([%_])/g, "\\$1").replace(/'/g, "''")}'`;
    }
    query.sql += ")";
  }
}

export function endsWith<
  TCol extends TextScalarTableColumn,
  TSuffix extends string | Arg<string>,
>(col: TCol, suffix: TSuffix): EndsWithCondition<TCol, TSuffix> {
  return new EndsWithCondition(col, suffix);
}

// ============================================================================
// contains
// ============================================================================

export class ContainsCondition<
  TCol extends TextScalarTableColumn,
  TSubstring extends string | Arg<string>,
> extends Filter<TCol, IsArg<TSubstring>> {
  constructor(
    private readonly col: TCol,
    private readonly substring: TSubstring,
  ) {
    super();
  }

  get referencedColumns(): TCol[] {
    return [this.col];
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    this.col.toQuery(query, ctx);
    query.sql += " LIKE ('%' || ";
    if (is(this.substring, Arg<string>)) {
      query.addArg(this.substring);
    } else {
      query.sql += `'${this.substring.replace(/([%_])/g, "\\$1").replace(/'/g, "''")}'`;
    }
    query.sql += ` || '%')`;
  }
}

export function contains<
  TCol extends TextScalarTableColumn,
  TSubstring extends string | Arg<string>,
>(col: TCol, substring: TSubstring): ContainsCondition<TCol, TSubstring> {
  return new ContainsCondition(col, substring);
}

// ============================================================================
// like / ilike
// ============================================================================

/** Appends a pattern or escape operand as a quoted literal or a prepared placeholder. */
function appendPatternOperand(
  query: Query,
  operand: string | Arg<string>,
): void {
  if (is(operand, Arg<string>)) {
    query.addArg(operand);
  } else {
    query.sql += `'${operand.replace(/'/g, "''")}'`;
  }
}

export class LikeCondition<
  TCol extends TextScalarTableColumn,
  TPattern extends string | Arg<string>,
  TEscape extends string | Arg<string> | undefined = undefined,
> extends Filter<TCol, Or<IsArg<TPattern>, IsArg<TEscape>>> {
  constructor(
    private readonly col: TCol,
    private readonly pattern: TPattern,
    private readonly escapeChar?: TEscape,
  ) {
    super();
  }

  /** Adds an `ESCAPE` clause with a custom escape character. */
  escape<TEscape2 extends string | Arg<string>>(
    escapeChar: TEscape2,
  ): LikeCondition<TCol, TPattern, TEscape2> {
    return new LikeCondition(this.col, this.pattern, escapeChar);
  }

  get referencedColumns(): TCol[] {
    return [this.col];
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    this.col.toQuery(query, ctx);
    query.sql += " LIKE ";
    appendPatternOperand(query, this.pattern);
    if (this.escapeChar !== undefined) {
      query.sql += " ESCAPE ";
      appendPatternOperand(query, this.escapeChar);
    }
  }
}

export function like<
  TCol extends TextScalarTableColumn,
  TPattern extends string | Arg<string>,
>(col: TCol, pattern: TPattern): LikeCondition<TCol, TPattern> {
  return new LikeCondition(col, pattern);
}

export class ILikeCondition<
  TCol extends TextScalarTableColumn,
  TPattern extends string | Arg<string>,
  TEscape extends string | Arg<string> | undefined = undefined,
> extends Filter<TCol, Or<IsArg<TPattern>, IsArg<TEscape>>> {
  constructor(
    private readonly col: TCol,
    private readonly pattern: TPattern,
    private readonly escapeChar?: TEscape,
  ) {
    super();
  }

  /** Adds an `ESCAPE` clause with a custom escape character. */
  escape<TEscape2 extends string | Arg<string>>(
    escapeChar: TEscape2,
  ): ILikeCondition<TCol, TPattern, TEscape2> {
    return new ILikeCondition(this.col, this.pattern, escapeChar);
  }

  get referencedColumns(): TCol[] {
    return [this.col];
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    this.col.toQuery(query, ctx);
    query.sql += " ILIKE ";
    appendPatternOperand(query, this.pattern);
    if (this.escapeChar !== undefined) {
      query.sql += " ESCAPE ";
      appendPatternOperand(query, this.escapeChar);
    }
  }
}

export function ilike<
  TCol extends TextScalarTableColumn,
  TPattern extends string | Arg<string>,
>(col: TCol, pattern: TPattern): ILikeCondition<TCol, TPattern> {
  return new ILikeCondition(col, pattern);
}
