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
import type { Query } from "../query-builders/query";
import type { AnyColumn, TableColumn } from "../table";
import { Filter } from "./custom";

/** Shorthand for the Filter's TableColumn constraint. */
type AnyTC = TableColumn<any, any, any, AnyColumn>;

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
  TCol extends AnyTC,
  TVal extends ArrayElement<TCol["ValType"]>,
> extends Filter<TCol> {
  readonly left: TCol;
  readonly right: TVal[];

  constructor(column: TCol, values: TVal[]) {
    super();
    this.left = column;
    this.right = values;
  }

  toQuery(query: Query): void {
    query.sql += `${this.left.fullName} @> ${this.left.toSQL(this.right)}::${this.left.sqlType}`;
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
  TCol extends AnyTC,
  TVal extends ArrayElement<TCol["ValType"]>,
>(column: TCol, values: TVal[]): ArrayContainsFilter<TCol, TVal> {
  return new ArrayContainsFilter(column, values);
}

/**
 * ArrayContainedBy filter: col <@ ARRAY[values]
 * Returns true if the array column is contained by (is a subset of) the specified values.
 */
export class ArrayContainedByFilter<
  TCol extends AnyTC,
  TVal extends ArrayElement<TCol["ValType"]>,
> extends Filter<TCol> {
  readonly left: TCol;
  readonly right: TVal[];

  constructor(column: TCol, values: TVal[]) {
    super();
    this.left = column;
    this.right = values;
  }

  toQuery(query: Query): void {
    query.sql += `${this.left.fullName} <@ ${this.left.toSQL(this.right)}::${this.left.sqlType}`;
  }
}

/**
 * Creates a condition that checks if an array column is contained by the specified values.
 * SQL: column <@ ARRAY[values]
 */
export function arrayContainedBy<
  TCol extends AnyTC,
  TVal extends ArrayElement<TCol["ValType"]>,
>(column: TCol, values: TVal[]): ArrayContainedByFilter<TCol, TVal> {
  return new ArrayContainedByFilter(column, values);
}

/**
 * ArrayOverlaps filter: col && ARRAY[values]
 * Returns true if the arrays have any elements in common.
 */
export class ArrayOverlapsFilter<
  TCol extends AnyTC,
  TVal extends ArrayElement<TCol["ValType"]>,
> extends Filter<TCol> {
  readonly left: TCol;
  readonly right: TVal[];

  constructor(column: TCol, values: TVal[]) {
    super();
    this.left = column;
    this.right = values;
  }

  toQuery(query: Query): void {
    query.sql += `${this.left.fullName} && ${this.left.toSQL(this.right)}::${this.left.sqlType}`;
  }
}

/**
 * Creates a condition that checks if an array column overlaps with the specified values.
 * SQL: column && ARRAY[values]
 */
export function arrayOverlaps<
  TCol extends AnyTC,
  TVal extends ArrayElement<TCol["ValType"]>,
>(column: TCol, values: TVal[]): ArrayOverlapsFilter<TCol, TVal> {
  return new ArrayOverlapsFilter(column, values);
}

/**
 * ArrayHas filter: value = ANY(col)
 * Returns true if the value exists in the array column.
 */
export class ArrayHasFilter<
  TCol extends AnyTC,
  TVal extends ArrayElement<TCol["ValType"]>,
> extends Filter<TCol> {
  readonly left: TCol;
  readonly right: TVal;

  constructor(column: TCol, value: TVal) {
    super();
    this.left = column;
    this.right = value;
  }

  toQuery(query: Query): void {
    query.sql += `${this.left.toSQLScalar(this.right)} = ANY(${this.left.fullName})`;
  }
}

/**
 * Creates a condition that checks if a value exists in an array column.
 * SQL: value = ANY(column)
 */
export function arrayHas<
  TCol extends AnyTC,
  TVal extends ArrayElement<TCol["ValType"]>,
>(column: TCol, value: TVal): ArrayHasFilter<TCol, TVal> {
  return new ArrayHasFilter(column, value);
}

/**
 * ArrayAll filter: value = ALL(col)
 * Returns true if all elements in the array column equal the value.
 */
export class ArrayAllFilter<
  TCol extends AnyTC,
  TVal extends ArrayElement<TCol["ValType"]>,
> extends Filter<TCol> {
  readonly left: TCol;
  readonly right: TVal;

  constructor(column: TCol, value: TVal) {
    super();
    this.left = column;
    this.right = value;
  }

  toQuery(query: Query): void {
    query.sql += `${this.left.toSQLScalar(this.right)} = ALL(${this.left.fullName})`;
  }
}

/**
 * Creates a condition that checks if all elements in an array column equal a value.
 * SQL: value = ALL(column)
 */
export function arrayAll<
  TCol extends AnyTC,
  TVal extends ArrayElement<TCol["ValType"]>,
>(column: TCol, value: TVal): ArrayAllFilter<TCol, TVal> {
  return new ArrayAllFilter(column, value);
}
