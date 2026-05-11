import { is, isTCol } from "../entity";
import { type AnyScalarSqlFn, SqlFn } from "../functions";
import { Arg, type IsArg } from "../query-builders/pre";
import type { Query } from "../query-builders/query";
import type { SelectQuery } from "../query-builders/select";
import { type Sql, toSqlValue } from "../sql";
import type { AnyColumn, TableAnyColumn } from "../table";
import type { BasicTypes, Or } from "../types";

/** Abstract base class for SQL filter expressions used in `WHERE`/`ON`/`CHECK` clauses. */
export abstract class Filter<
  TColumns extends TableAnyColumn = TableAnyColumn,
  THasArg extends boolean = false,
> {
  /** Phantom field: the columns this filter is applied to. */
  readonly $Columns!: TColumns;
  /** Phantom field: `true` when this filter embeds at least one `Arg` placeholder. */
  readonly $HasArg!: THasArg;
  abstract toQuery(query: Query): void;
}

/** Convenience alias for a `Filter` with all type parameters widened to `any`. */
// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnyFilter = Filter<any, any>;

/**
 * Constrains a filter expression to columns allowed in the current query scope.
 * Accepts either a `Filter` whose `$Columns` is assignable to `TScopeColumns`,
 * or a raw `Sql` snippet. When `TArg` is `true`, filters carrying `Arg`
 * placeholders are also accepted (prepared-query context).
 */
export type FilterExpression<
  TScopeColumns extends TableAnyColumn,
  TPrepare extends boolean = false,
> = Filter<TScopeColumns, TPrepare extends true ? boolean : false> | Sql;

export type StdCondition = FilterExpression<TableAnyColumn>;

type HasArg<T> = T extends { $HasArg: true } ? true : false;

export class ComparisonLeftIsColumn<
  TLeft extends TableAnyColumn,
  TOp extends string,
  TRight extends
    | TLeft["ValType"]
    | Arg<TLeft["ValType"]>
    | TableAnyColumn
    | AnyScalarSqlFn,
> extends Filter<TLeft, Or<IsArg<TRight>, HasArg<TRight>>> {
  readonly left: TLeft;
  readonly op: TOp;
  readonly right: TRight;
  constructor(field: TLeft, op: TOp, right: TRight) {
    super();
    this.left = field;
    this.op = op;
    this.right = right;
  }
  toQuery(query: Query) {
    this.left.toQuery(query);
    query.sql += ` ${this.op} `;
    if (is(this.right, Arg<TLeft["ValType"]>)) {
      query.addArg(this.right);
    } else if (isTCol(this.right)) {
      this.right.toQuery(query);
    } else if (this.right instanceof SqlFn) {
      this.right.toQuery(query);
    } else {
      query.sql += this.left.toSQL(this.right);
    }
  }
}

export class ComparisonLeftIsSqlFn<
  TLeft extends AnyScalarSqlFn,
  TOp extends string,
  TRight extends BasicTypes | AnyScalarSqlFn,
> extends Filter<
  | TLeft["$Columns"]
  | (TRight extends AnyScalarSqlFn ? TRight["$Columns"] : never),
  HasArg<TLeft> extends true ? true : HasArg<TRight>
> {
  readonly left: TLeft;
  readonly op: TOp;
  readonly right: TRight;
  constructor(field: TLeft, op: TOp, right: TRight) {
    super();
    this.left = field;
    this.op = op;
    this.right = right;
  }
  toQuery(query: Query) {
    this.left.toQuery(query);
    query.sql += ` ${this.op} `;
    if (this.right instanceof SqlFn) {
      this.right.toQuery(query);
    } else {
      query.sql += toSqlValue(this.right);
    }
  }
}

export function eq<
  TLeft extends TableAnyColumn,
  TRight extends TLeft["ValType"],
>(left: TLeft, right: TRight): ComparisonLeftIsColumn<TLeft, "=", TRight>;
export function eq<
  TLeft extends TableAnyColumn,
  TRight extends Arg<TLeft["ValType"]> | TableAnyColumn | AnyScalarSqlFn,
>(left: TLeft, right: TRight): ComparisonLeftIsColumn<TLeft, "=", TRight>;
export function eq<TLeft extends AnyScalarSqlFn, TRight extends BasicTypes>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "=", TRight>;
export function eq<TLeft extends AnyScalarSqlFn, TRight extends AnyScalarSqlFn>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "=", TRight>;
export function eq(
  left: TableAnyColumn | AnyScalarSqlFn,
  right:
    | AnyColumn["ValType"]
    | Arg<AnyColumn["ValType"]>
    | TableAnyColumn
    | AnyScalarSqlFn,
) {
  if (isTCol(left)) {
    return new ComparisonLeftIsColumn(left, "=", right);
  } else {
    return new ComparisonLeftIsSqlFn(left as AnyScalarSqlFn, "=", right);
  }
}

export function ne<
  TLeft extends TableAnyColumn,
  TRight extends TLeft["ValType"],
>(left: TLeft, right: TRight): ComparisonLeftIsColumn<TLeft, "!=", TRight>;
export function ne<
  TLeft extends TableAnyColumn,
  TRight extends Arg<TLeft["ValType"]> | TableAnyColumn | AnyScalarSqlFn,
>(left: TLeft, right: TRight): ComparisonLeftIsColumn<TLeft, "!=", TRight>;
export function ne<TLeft extends AnyScalarSqlFn, TRight extends BasicTypes>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "!=", TRight>;
export function ne<TLeft extends AnyScalarSqlFn, TRight extends AnyScalarSqlFn>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "!=", TRight>;
export function ne(
  left: TableAnyColumn | AnyScalarSqlFn,
  right:
    | AnyColumn["ValType"]
    | Arg<AnyColumn["ValType"]>
    | TableAnyColumn
    | AnyScalarSqlFn,
) {
  if (isTCol(left)) {
    return new ComparisonLeftIsColumn(left, "!=", right);
  } else {
    return new ComparisonLeftIsSqlFn(left as AnyScalarSqlFn, "!=", right);
  }
}

export function gt<
  TLeft extends TableAnyColumn,
  TRight extends TLeft["ValType"],
>(left: TLeft, right: TRight): ComparisonLeftIsColumn<TLeft, ">", TRight>;
export function gt<
  TLeft extends TableAnyColumn,
  TRight extends Arg<TLeft["ValType"]> | TableAnyColumn | AnyScalarSqlFn,
>(left: TLeft, right: TRight): ComparisonLeftIsColumn<TLeft, ">", TRight>;
export function gt<TLeft extends AnyScalarSqlFn, TRight extends BasicTypes>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, ">", TRight>;
export function gt<TLeft extends AnyScalarSqlFn, TRight extends AnyScalarSqlFn>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, ">", TRight>;
export function gt(
  left: TableAnyColumn | AnyScalarSqlFn,
  right:
    | AnyColumn["ValType"]
    | Arg<AnyColumn["ValType"]>
    | TableAnyColumn
    | AnyScalarSqlFn,
) {
  if (isTCol(left)) {
    return new ComparisonLeftIsColumn(left, ">", right);
  } else {
    return new ComparisonLeftIsSqlFn(left as AnyScalarSqlFn, ">", right);
  }
}

export function gte<
  TLeft extends TableAnyColumn,
  TRight extends TLeft["ValType"],
>(left: TLeft, right: TRight): ComparisonLeftIsColumn<TLeft, ">=", TRight>;
export function gte<
  TLeft extends TableAnyColumn,
  TRight extends Arg<TLeft["ValType"]> | TableAnyColumn | AnyScalarSqlFn,
>(left: TLeft, right: TRight): ComparisonLeftIsColumn<TLeft, ">=", TRight>;
export function gte<TLeft extends AnyScalarSqlFn, TRight extends BasicTypes>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, ">=", TRight>;
export function gte<
  TLeft extends AnyScalarSqlFn,
  TRight extends AnyScalarSqlFn,
>(left: TLeft, right: TRight): ComparisonLeftIsSqlFn<TLeft, ">=", TRight>;
export function gte(
  left: TableAnyColumn | AnyScalarSqlFn,
  right:
    | AnyColumn["ValType"]
    | Arg<AnyColumn["ValType"]>
    | TableAnyColumn
    | AnyScalarSqlFn,
) {
  if (isTCol(left)) {
    return new ComparisonLeftIsColumn(left, ">=", right);
  } else {
    return new ComparisonLeftIsSqlFn(left as AnyScalarSqlFn, ">=", right);
  }
}

export function lt<
  TLeft extends TableAnyColumn,
  TRight extends TLeft["ValType"],
>(left: TLeft, right: TRight): ComparisonLeftIsColumn<TLeft, "<", TRight>;
export function lt<
  TLeft extends TableAnyColumn,
  TRight extends Arg<TLeft["ValType"]> | TableAnyColumn | AnyScalarSqlFn,
>(left: TLeft, right: TRight): ComparisonLeftIsColumn<TLeft, "<", TRight>;
export function lt<TLeft extends AnyScalarSqlFn, TRight extends BasicTypes>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "<", TRight>;
export function lt<TLeft extends AnyScalarSqlFn, TRight extends AnyScalarSqlFn>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "<", TRight>;
export function lt(
  left: TableAnyColumn | AnyScalarSqlFn,
  right:
    | AnyColumn["ValType"]
    | Arg<AnyColumn["ValType"]>
    | TableAnyColumn
    | AnyScalarSqlFn,
) {
  if (isTCol(left)) {
    return new ComparisonLeftIsColumn(left, "<", right);
  } else {
    return new ComparisonLeftIsSqlFn(left as AnyScalarSqlFn, "<", right);
  }
}

export function lte<
  TLeft extends TableAnyColumn,
  TRight extends TLeft["ValType"],
>(left: TLeft, right: TRight): ComparisonLeftIsColumn<TLeft, "<=", TRight>;
export function lte<
  TLeft extends TableAnyColumn,
  TRight extends Arg<TLeft["ValType"]> | TableAnyColumn | AnyScalarSqlFn,
>(left: TLeft, right: TRight): ComparisonLeftIsColumn<TLeft, "<=", TRight>;
export function lte<TLeft extends AnyScalarSqlFn, TRight extends BasicTypes>(
  left: TLeft,
  right: TRight,
): ComparisonLeftIsSqlFn<TLeft, "<=", TRight>;
export function lte<
  TLeft extends AnyScalarSqlFn,
  TRight extends AnyScalarSqlFn,
>(left: TLeft, right: TRight): ComparisonLeftIsSqlFn<TLeft, "<=", TRight>;
export function lte(
  left: TableAnyColumn | AnyScalarSqlFn,
  right:
    | AnyColumn["ValType"]
    | Arg<AnyColumn["ValType"]>
    | TableAnyColumn
    | AnyScalarSqlFn,
) {
  if (isTCol(left)) {
    return new ComparisonLeftIsColumn(left, "<=", right);
  } else {
    return new ComparisonLeftIsSqlFn(left as AnyScalarSqlFn, "<=", right);
  }
}

export class IsNullCondition<TCol extends TableAnyColumn> extends Filter<
  TCol,
  false
> {
  readonly field: TCol;
  constructor(field: TCol) {
    super();
    this.field = field;
  }
  toQuery(query: Query) {
    query.sql += `${this.field.fullName} IS NULL`;
  }
}

export function isNull<TCol extends TableAnyColumn>(field: TCol) {
  return new IsNullCondition(field);
}

export class IsNotNullCondition<TCol extends TableAnyColumn> extends Filter<
  TCol,
  false
> {
  readonly field: TCol;
  constructor(field: TCol) {
    super();
    this.field = field;
  }

  toQuery(query: Query) {
    query.sql += `${this.field.fullName} IS NOT NULL`;
  }
}

export function isNotNull<TCol extends TableAnyColumn>(field: TCol) {
  return new IsNotNullCondition(field);
}

type InSelectQuery<TArg extends boolean, TReturn> = SelectQuery<
  any,
  any,
  any,
  any,
  any,
  TArg,
  any,
  any,
  Record<string, TReturn>[]
>;

export class InCondition<
  TCol extends TableAnyColumn,
  TArg extends boolean,
> extends Filter<TCol, TArg> {
  readonly field: TCol;
  readonly values: TCol["ValType"][] | InSelectQuery<TArg, TCol["ValType"]>;
  constructor(
    field: TCol,
    values: TCol["ValType"][] | InSelectQuery<TArg, TCol["ValType"]>,
  ) {
    super();
    this.field = field;
    this.values = values;
  }
  toQuery(query: Query) {
    if (Array.isArray(this.values)) {
      if (this.values.length === 0) {
        query.sql += "FALSE";
        return;
      }
      query.sql += `${this.field.fullName} IN (`;
      query.sql += this.values.map((v) => this.field.toSQL(v)).join(", ");
      query.sql += ")";
    } else {
      query.sql += `${this.field.fullName} IN (`;
      query.sql += this.values.toQuery();
      query.sql += ")";
    }
  }
}

export function isIn<TCol extends TableAnyColumn>(
  field: TCol,
  values: TCol["ValType"][] | InSelectQuery<boolean, TCol["ValType"]>,
) {
  return new InCondition(field, values) as InCondition<TCol, false>;
}

export class NotInCondition<TCol extends TableAnyColumn> extends Filter<
  TCol,
  false
> {
  readonly field: TCol;
  readonly values: TCol["ValType"][];
  constructor(field: TCol, values: TCol["ValType"][]) {
    super();
    this.field = field;
    this.values = values;
  }
  toQuery(query: Query) {
    if (this.values.length === 0) {
      query.sql += "TRUE";
      return;
    }
    query.sql += `${this.field.fullName} NOT IN (`;
    query.sql += this.values.map((v) => this.field.toSQL(v)).join(", ");
    query.sql += ")";
  }
}

export function notIn<TCol extends TableAnyColumn>(
  field: TCol,
  values: TCol["ValType"][],
): NotInCondition<TCol> {
  return new NotInCondition(field, values);
}

/** @internal Union of table columns from all Filter conditions in the array. */
type ExtractCols<T extends AnyFilter | Sql> =
  T extends Filter<any, any> ? T["$Columns"] : never;

/** @internal `true` when at least one Filter condition in the array carries an Arg placeholder. */
type HasArgOf<T extends (AnyFilter | Sql)[]> = [
  T[number] extends Filter<any, infer H> ? H : false,
] extends [false]
  ? false
  : true;

export class AndCondition<
  TConditions extends (AnyFilter | Sql)[],
> extends Filter<ExtractCols<TConditions[number]>, HasArgOf<TConditions>> {
  readonly conditions: TConditions;
  constructor(...conditions: TConditions) {
    super();
    this.conditions = conditions;
  }
  toQuery(query: Query) {
    query.sql += "(";
    for (let i = 0; i < this.conditions.length; i++) {
      this.conditions[i].toQuery(query);
      if (i < this.conditions.length - 1) {
        query.sql += " AND ";
      }
    }
    query.sql += ")";
  }
}

export function and<TConditions extends (AnyFilter | Sql)[]>(
  ...conditions: TConditions
): AndCondition<TConditions> {
  return new AndCondition(...conditions);
}

export class OrCondition<
  TConditions extends (AnyFilter | Sql)[],
> extends Filter<ExtractCols<TConditions[number]>, HasArgOf<TConditions>> {
  readonly conditions: TConditions;
  constructor(...conditions: TConditions) {
    super();
    this.conditions = conditions;
  }
  toQuery(query: Query) {
    query.sql += "(";
    for (let i = 0; i < this.conditions.length; i++) {
      this.conditions[i].toQuery(query);
      if (i < this.conditions.length - 1) {
        query.sql += " OR ";
      }
    }
    query.sql += ")";
  }
}

export function or<TConditions extends (AnyFilter | Sql)[]>(
  ...conditions: TConditions
): OrCondition<TConditions> {
  return new OrCondition(...conditions);
}
