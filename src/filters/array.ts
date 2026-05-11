/**
 * PostgreSQL array query filters for use in WHERE clauses.
 *
 * These filters allow type-safe querying of array columns:
 * - arrayContains: @> operator (array contains all values)
 * - arrayContainedBy: <@ operator (array is subset of values)
 * - arrayOverlaps: && operator (arrays share elements)
 * - arrayHas: = ANY() (value exists in array)
 * - arrayAll: = ALL() (all elements equal value)
 */
import { is } from "../entity";
import { Arg, type IsArg } from "../query-builders/pre";
import type { Query } from "../query-builders/query";
import type { TableAnyColumn } from "../table";
import { Filter } from ".";

/**
 * Helper type to extract the element type from an array type.
 * Works with regular arrays, tuples, and nested arrays.
 */
type ArrayElement<T> = T extends readonly (infer E)[]
  ? E extends readonly unknown[]
    ? ArrayElement<E>
    : E
  : T;

/**
 * ArrayContains filter: col @> ARRAY[values]
 * Returns true if the array column contains all the specified values.
 */
export class ArrayContainsFilter<
  TCol extends TableAnyColumn,
  TValues extends ArrayElement<TCol["ValType"]>[] | Arg<TCol["ValType"]>,
> extends Filter<TCol, IsArg<TValues>> {
  readonly left: TCol;
  readonly values: TValues;

  constructor(column: TCol, values: TValues) {
    super();
    this.left = column;
    this.values = values;
  }

  toQuery(query: Query): void {
    query.sql += `${this.left.fullName} @> `;
    if (is(this.values, Arg<TCol["ValType"][]>)) {
      query.addArg(this.values);
    } else {
      query.sql += `${this.left.toSQL(this.values)}::${this.left.sqlType}`;
    }
  }
}

/**
 * Creates a condition that checks if an array column contains all specified values.
 * SQL: column @> ARRAY[values]
 *
 * @example
 * db.from(Posts).select().where(arrayContains(Posts.tags, ['typescript', 'postgres']))
 */
export function arrayContains<
  TCol extends TableAnyColumn,
  TValues extends ArrayElement<TCol["ValType"]>[],
>(column: TCol, values: TValues): ArrayContainsFilter<TCol, TValues>;
export function arrayContains<
  TCol extends TableAnyColumn,
  TValues extends Arg<TCol["ValType"]>,
>(column: TCol, values: TValues): ArrayContainsFilter<TCol, TValues>;
export function arrayContains<
  TCol extends TableAnyColumn,
  TValues extends ArrayElement<TCol["ValType"]>[] | Arg<TCol["ValType"]>,
>(column: TCol, values: TValues): ArrayContainsFilter<TCol, TValues> {
  return new ArrayContainsFilter(column, values);
}

/**
 * ArrayContainedBy filter: col <@ ARRAY[values]
 * Returns true if the array column is contained by (is a subset of) the specified values.
 */
export class ArrayContainedByFilter<
  TCol extends TableAnyColumn,
  TValues extends ArrayElement<TCol["ValType"]>[] | Arg<TCol["ValType"]>,
> extends Filter<TCol, IsArg<TValues>> {
  readonly left: TCol;
  readonly values: TValues;

  constructor(column: TCol, values: TValues) {
    super();
    this.left = column;
    this.values = values;
  }

  toQuery(query: Query): void {
    query.sql += `${this.left.fullName} <@ `;
    if (is(this.values, Arg<TCol["ValType"]>)) {
      query.addArg(this.values);
    } else {
      query.sql += `${this.left.toSQL(this.values)}::${this.left.sqlType}`;
    }
  }
}

/**
 * Creates a condition that checks if an array column is contained by the specified values.
 * SQL: column <@ ARRAY[values]
 */
export function arrayContainedBy<
  TCol extends TableAnyColumn,
  TValues extends ArrayElement<TCol["ValType"]>[],
>(column: TCol, values: TValues): ArrayContainedByFilter<TCol, TValues>;
export function arrayContainedBy<
  TCol extends TableAnyColumn,
  TValues extends Arg<TCol["ValType"]>,
>(column: TCol, values: TValues): ArrayContainedByFilter<TCol, TValues>;
export function arrayContainedBy<
  TCol extends TableAnyColumn,
  TValues extends ArrayElement<TCol["ValType"]>[] | Arg<TCol["ValType"]>,
>(column: TCol, values: TValues): ArrayContainedByFilter<TCol, TValues> {
  return new ArrayContainedByFilter(column, values);
}

/**
 * ArrayOverlaps filter: col && ARRAY[values]
 * Returns true if the arrays have any elements in common.
 */
export class ArrayOverlapsFilter<
  TCol extends TableAnyColumn,
  TValues extends ArrayElement<TCol["ValType"]>[] | Arg<TCol["ValType"]>,
> extends Filter<TCol, IsArg<TValues>> {
  readonly left: TCol;
  readonly right: TValues;

  constructor(column: TCol, values: TValues) {
    super();
    this.left = column;
    this.right = values;
  }

  toQuery(query: Query): void {
    query.sql += `${this.left.fullName} && `;
    if (is(this.right, Arg<TCol["ValType"]>)) {
      query.addArg(this.right);
    } else {
      query.sql += `${this.left.toSQL(this.right)}::${this.left.sqlType}`;
    }
  }
}

/**
 * Creates a condition that checks if an array column overlaps with the specified values.
 * SQL: column && ARRAY[values]
 */
export function arrayOverlaps<
  TCol extends TableAnyColumn,
  TValues extends ArrayElement<TCol["ValType"]>[],
>(column: TCol, values: TValues): ArrayOverlapsFilter<TCol, TValues>;
export function arrayOverlaps<
  TCol extends TableAnyColumn,
  TValues extends Arg<TCol["ValType"]>,
>(column: TCol, values: TValues): ArrayOverlapsFilter<TCol, TValues>;
export function arrayOverlaps<
  TCol extends TableAnyColumn,
  TValues extends ArrayElement<TCol["ValType"]>[] | Arg<TCol["ValType"]>,
>(column: TCol, values: TValues): ArrayOverlapsFilter<TCol, TValues> {
  return new ArrayOverlapsFilter(column, values);
}

/**
 * ArrayHas filter: value = ANY(col)
 * Returns true if the value exists in the array column.
 */
export class ArrayHasFilter<
  TCol extends TableAnyColumn,
  TRight extends
    | ArrayElement<TCol["ValType"]>
    | Arg<ArrayElement<TCol["ValType"]>>,
> extends Filter<TCol, IsArg<TRight>> {
  readonly left: TCol;
  readonly value: TRight;

  constructor(column: TCol, value: TRight) {
    super();
    this.left = column;
    this.value = value;
  }

  toQuery(query: Query): void {
    if (is(this.value, Arg<TCol["ValType"]>)) {
      query.addArg(this.value);
    } else {
      query.sql += this.left.toSQLScalar(this.value);
    }
    query.sql += ` = ANY(${this.left.fullName})`;
  }
}

/**
 * Creates a condition that checks if a value exists in an array column.
 * SQL: value = ANY(column)
 */
export function arrayHas<
  TCol extends TableAnyColumn,
  TRight extends ArrayElement<TCol["ValType"]>,
>(column: TCol, value: TRight): ArrayHasFilter<TCol, TRight>;
export function arrayHas<
  TCol extends TableAnyColumn,
  TRight extends Arg<ArrayElement<TCol["ValType"]>>,
>(column: TCol, value: TRight): ArrayHasFilter<TCol, TRight>;
export function arrayHas<
  TCol extends TableAnyColumn,
  TRight extends
    | ArrayElement<TCol["ValType"]>
    | Arg<ArrayElement<TCol["ValType"]>>,
>(column: TCol, value: TRight): ArrayHasFilter<TCol, TRight> {
  return new ArrayHasFilter(column, value);
}

/**
 * ArrayAll filter: value = ALL(col)
 * Returns true if all elements in the array column equal the value.
 */
export class ArrayAllFilter<
  TCol extends TableAnyColumn,
  TRight extends
    | ArrayElement<TCol["ValType"]>
    | Arg<ArrayElement<TCol["ValType"]>>,
> extends Filter<TCol, IsArg<TRight>> {
  readonly left: TCol;
  readonly value: TRight;

  constructor(column: TCol, value: TRight) {
    super();
    this.left = column;
    this.value = value;
  }

  toQuery(query: Query): void {
    if (is(this.value, Arg<TCol["ValType"]>)) {
      query.addArg(this.value);
    } else {
      query.sql += this.left.toSQLScalar(this.value);
    }
    query.sql += ` = ALL(${this.left.fullName})`;
  }
}

/**
 * Creates a condition that checks if all elements in an array column equal a value.
 * SQL: value = ALL(column)
 */
export function arrayAll<
  TCol extends TableAnyColumn,
  TRight extends ArrayElement<TCol["ValType"]>,
>(column: TCol, value: TRight): ArrayAllFilter<TCol, TRight>;
export function arrayAll<
  TCol extends TableAnyColumn,
  TRight extends Arg<ArrayElement<TCol["ValType"]>>,
>(column: TCol, value: TRight): ArrayAllFilter<TCol, TRight>;
export function arrayAll<
  TCol extends TableAnyColumn,
  TRight extends
    | ArrayElement<TCol["ValType"]>
    | Arg<ArrayElement<TCol["ValType"]>>,
>(column: TCol, value: TRight): ArrayAllFilter<TCol, TRight> {
  return new ArrayAllFilter(column, value);
}
