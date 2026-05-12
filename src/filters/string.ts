import type { Column } from "../columns/common";
import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/pre";
import type { Query, QueryContext } from "../query-builders/query";
import type { TableColumn } from "../table";
import { Filter } from "./index";

export type TextScalarTableColumn = TableColumn<
  any,
  any,
  any,
  Column<any, any, "text">
> & {
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
// like
// ============================================================================

export class LikeCondition<
  TCol extends TextScalarTableColumn,
  TPattern extends string | Arg<string>,
> extends Filter<TCol, IsArg<TPattern>> {
  constructor(
    private readonly col: TCol,
    private readonly pattern: TPattern,
  ) {
    super();
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    this.col.toQuery(query, ctx);
    query.sql += " LIKE ";
    if (is(this.pattern, Arg<string>)) {
      query.addArg(this.pattern);
    } else {
      query.sql += `'${this.pattern.replace(/'/g, "''")}'`;
    }
  }
}

export function like<
  TCol extends TextScalarTableColumn,
  TPattern extends string | Arg<string>,
>(col: TCol, pattern: TPattern): LikeCondition<TCol, TPattern> {
  return new LikeCondition(col, pattern);
}
