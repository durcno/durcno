import { is } from "../entity";
import type { Filter } from "../filters";
import { buildSelectItemConverter } from "../query-builders/helpers";
import { type AnyArg, Arg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import type { WidenedSelectQuery } from "../query-builders/select";
import { Sql, toSqlValue } from "../sql";
import type { AnyColumn, AnyScalarColumn } from "../table";
import type { AnySubquery } from "../virtual-table";
import { type AnySqlFn, type InferValueType, SqlFn, setOwn } from "./index";

/**
 * Union of valid subquery types accepted by subquery functions:
 * - A `SelectQuery` instance (from `db.from(...).select(...)`)
 * - Any subquery instance satisfying `AnySubquery`
 * - A raw `Sql` instance (e.g. `sql\`SELECT 1 FROM ...\``)
 */
export type SubqueryInput<TArg extends boolean = boolean> =
  | WidenedSelectQuery<TArg>
  | AnySubquery
  | Sql;

/**
 * Convenience alias for `SubqueryInput` in `exists(...)` / `notExists(...)`.
 */
export type ExistsSubquery<TArg extends boolean = boolean> =
  SubqueryInput<TArg>;

/**
 * Extracts the `TPrepare` argument flag from a subquery expression.
 */
export type SubqueryHasArg<TSubquery> =
  TSubquery extends WidenedSelectQuery<infer TArg> ? TArg : false;

export type InSelectQuery<
  TArg extends boolean = boolean,
  TReturn = unknown,
> = WidenedSelectQuery<TArg, Record<string, TReturn>[]>;

export type InSubquery<TReturn = unknown, TArg extends boolean = boolean> =
  | InSelectQuery<TArg, TReturn>
  | Sql;

/**
 * Detects whether an array contains any `Arg` placeholder instances.
 */
export type ArrayHasArg<TArr> = TArr extends readonly (infer E)[]
  ? Extract<E, AnyArg> extends never
    ? false
    : true
  : false;

export type InValues<TCol extends AnyColumn, TArg extends boolean = boolean> =
  | readonly (
      | TCol["ValType"]
      | (TArg extends false ? never : Arg<TCol["ValType"]>)
    )[]
  | InSubquery<TCol["ValType"], TArg>;

/**
 * Abstract base class for expressions owned by a subquery.
 *
 * An aggregate inside the subquery belongs to that subquery, so it never makes
 * the outer expression an aggregate. These expressions also own their columns,
 * which keeps them out of the outer query's automatic `GROUP BY` keys.
 */
export abstract class SubqueryOwnedSqlFn<
  TColumn extends AnyColumn = AnyColumn,
  TTsType = unknown,
  THasArg extends boolean = false,
  TPgType extends string = string,
> extends SqlFn<TColumn, "scalar", TPgType, TTsType, THasArg, false> {
  /** The subquery owns its columns. */
  get referencedColumns(): AnyColumn[] | null {
    return null;
  }
}

/**
 * Abstract base class for PostgreSQL subquery functions/expressions.
 *
 * Implements `SqlFn` (evaluating to boolean) and satisfies `Filter` so it can be used:
 * - In `.where(...)` and `.having(...)` as a boolean filter predicate
 * - In `.select(...)` as a boolean column expression evaluating to `boolean`
 * - In `and(...)` and `or(...)` compound filters
 * - In `caseWhen(...)` conditions and results
 *
 * Modeled after PostgreSQL's Subquery Expressions (Chapter 9.24).
 * @see https://www.postgresql.org/docs/current/functions-subquery.html
 */
export abstract class SubquerySqlFn<
    TColumn extends AnyColumn = AnyColumn,
    THasArg extends boolean = false,
  >
  extends SubqueryOwnedSqlFn<TColumn, boolean, THasArg, "boolean">
  implements Filter<TColumn, THasArg>
{
  toDriverValue(value: boolean | null): unknown {
    return value;
  }

  toSQLValue(value: boolean | null): string {
    return value === null ? "NULL" : value ? "TRUE" : "FALSE";
  }

  fromDriverValue(value: unknown): boolean {
    return value === true || value === "t" || value === "true";
  }
}

/**
 * PostgreSQL `EXISTS` and `NOT EXISTS` subquery SQL function and filter expression.
 *
 * @see https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-EXISTS
 */
export class ExistsFn<THasArg extends boolean = false> extends SubquerySqlFn<
  never,
  THasArg
> {
  constructor(
    private readonly subquery: SubqueryInput<THasArg>,
    private readonly isNot: boolean = false,
  ) {
    super();
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += this.isNot ? "NOT EXISTS (" : "EXISTS (";
    if (this.subquery instanceof Sql) {
      this.subquery.toQuery(query, ctx);
    } else {
      this.subquery.toQuery(query);
    }
    query.sql += ")";
  }
}

/**
 * PostgreSQL `IN` and `NOT IN` subquery SQL function and filter expression.
 *
 * @see https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-IN
 * @see https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-NOTIN
 */
export class InFn<
  TCol extends AnyColumn,
  THasArg extends boolean = false,
> extends SubquerySqlFn<TCol, THasArg> {
  constructor(
    readonly field: TCol,
    readonly values: InValues<TCol, THasArg>,
    readonly isNot: boolean = false,
  ) {
    super();
  }

  get referencedColumns(): AnyColumn[] {
    return [this.field];
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    if (Array.isArray(this.values)) {
      if (this.values.length === 0) {
        query.sql += this.isNot ? "TRUE" : "FALSE";
        return;
      }
      this.field.toQuery(query, ctx);
      query.sql += this.isNot ? " NOT IN (" : " IN (";
      for (let i = 0; i < this.values.length; i++) {
        if (i !== 0) query.sql += ", ";
        const v = this.values[i];
        if (is(v, Arg)) {
          query.addArg(v);
        } else {
          query.sql += this.field.toSQLExpression(v);
        }
      }
      query.sql += ")";
    } else {
      this.field.toQuery(query, ctx);
      query.sql += this.isNot ? " NOT IN (" : " IN (";
      if (this.values instanceof Sql) {
        this.values.toQuery(query, ctx);
      } else {
        (this.values as InSelectQuery<THasArg, TCol["ValType"]>).toQuery(query);
      }
      query.sql += ")";
    }
  }
}

/**
 * Creates an `EXISTS (subquery)` expression.
 *
 * Evaluates to `true` if the subquery returns at least one row, and `false` otherwise.
 * Usable in `.where()`, `.having()`, `.select()`, `and()`, `or()`, and `caseWhen()`.
 *
 * @see https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-EXISTS
 * @example
 * ```ts
 * // In WHERE clause (correlated subquery)
 * const usersWithOrders = await db
 *   .from(Users)
 *   .select("*")
 *   .where(() =>
 *     exists(
 *       db
 *         .from(Orders)
 *         .select("*")
 *         .where(() => eq(Orders.userId, Users.id))
 *     )
 *   );
 *
 * // In SELECT projection
 * const usersWithFlag = await db
 *   .from(Users)
 *   .select(() => ({
 *     id: Users.id,
 *     hasOrders: exists(
 *       db
 *         .from(Orders)
 *         .select("*")
 *         .where(() => eq(Orders.userId, Users.id))
 *     ),
 *   }));
 * ```
 */
export function exists<TSubquery extends SubqueryInput>(
  subquery: TSubquery,
): ExistsFn<SubqueryHasArg<TSubquery>> {
  return new ExistsFn<SubqueryHasArg<TSubquery>>(subquery as never, false);
}

/**
 * Creates a `NOT EXISTS (subquery)` expression.
 *
 * Evaluates to `true` if the subquery returns no rows, and `false` otherwise.
 * Usable in `.where()`, `.having()`, `.select()`, `and()`, `or()`, and `caseWhen()`.
 *
 * @see https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-EXISTS
 * @example
 * ```ts
 * const usersWithoutOrders = await db
 *   .from(Users)
 *   .select("*")
 *   .where(() =>
 *     notExists(
 *       db
 *         .from(Orders)
 *         .select("*")
 *         .where(() => eq(Orders.userId, Users.id))
 *     )
 *   );
 * ```
 */
export function notExists<TSubquery extends SubqueryInput>(
  subquery: TSubquery,
): ExistsFn<SubqueryHasArg<TSubquery>> {
  return new ExistsFn<SubqueryHasArg<TSubquery>>(subquery as never, true);
}

/**
 * Creates an `IN (values | subquery)` expression.
 *
 * Evaluates to `true` if the column value is equal to any value in the list or subquery result.
 * Usable in `.where()`, `.having()`, `.select()`, `and()`, `or()`, and `caseWhen()`.
 *
 * @see https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-IN
 * @example
 * ```ts
 * // With value array in WHERE
 * db.from(Users).select("*").where(() => isIn(Users.id, [1n, 2n, 3n]));
 *
 * // With subquery in WHERE
 * db.from(Users).select("*").where(() =>
 *   isIn(Users.id, db.from(Orders).select(() => ({ userId: Orders.userId })))
 * );
 *
 * // In SELECT projection
 * db.from(Users).select(() => ({
 *   id: Users.id,
 *   isAdmin: isIn(Users.type, ["admin", "superadmin"]),
 * }));
 * ```
 */
export function isIn<TCol extends AnyColumn, TArg extends boolean = false>(
  field: TCol,
  values: InSelectQuery<TArg, TCol["ValType"]>,
): InFn<TCol, TArg>;
export function isIn<TCol extends AnyColumn>(
  field: TCol,
  values: Sql,
): InFn<TCol, false>;
export function isIn<TCol extends AnyColumn>(
  field: TCol,
  values: readonly TCol["ValType"][],
): InFn<TCol, false>;
export function isIn<TCol extends AnyColumn>(
  field: TCol,
  values: readonly (TCol["ValType"] | Arg<TCol["ValType"]>)[],
): InFn<TCol, true>;
export function isIn<TCol extends AnyColumn>(
  field: TCol,
  values: InValues<TCol, boolean>,
): InFn<TCol, boolean> {
  return new InFn(field, values as never, false);
}

/**
 * Creates a `NOT IN (values | subquery)` expression.
 *
 * Evaluates to `true` if the column value is not equal to any value in the list or subquery result.
 * Usable in `.where()`, `.having()`, `.select()`, `and()`, `or()`, and `caseWhen()`.
 *
 * @see https://www.postgresql.org/docs/current/functions-subquery.html#FUNCTIONS-SUBQUERY-NOTIN
 * @example
 * ```ts
 * // With value array in WHERE
 * db.from(Users).select("*").where(() => notIn(Users.type, ["banned", "deleted"]));
 *
 * // With subquery in WHERE
 * db.from(Users).select("*").where(() =>
 *   notIn(Users.id, db.from(BannedUsers).select(() => ({ userId: BannedUsers.userId })))
 * );
 *
 * // In SELECT projection
 * db.from(Users).select(() => ({
 *   id: Users.id,
 *   isActive: notIn(Users.type, ["banned", "deleted"]),
 * }));
 * ```
 */
export function notIn<TCol extends AnyColumn, TArg extends boolean = false>(
  field: TCol,
  values: InSelectQuery<TArg, TCol["ValType"]>,
): InFn<TCol, TArg>;
export function notIn<TCol extends AnyColumn>(
  field: TCol,
  values: Sql,
): InFn<TCol, false>;
export function notIn<TCol extends AnyColumn>(
  field: TCol,
  values: readonly TCol["ValType"][],
): InFn<TCol, false>;
export function notIn<TCol extends AnyColumn>(
  field: TCol,
  values: readonly (TCol["ValType"] | Arg<TCol["ValType"]>)[],
): InFn<TCol, true>;
export function notIn<TCol extends AnyColumn>(
  field: TCol,
  values: InValues<TCol, boolean>,
): InFn<TCol, boolean> {
  return new InFn(field, values as never, true);
}

// ============================================================================
// Scalar subqueries
// ============================================================================

/** Resolved-columns type of an `AnySubquery`-like value. */
type ResolvedColumns<TSubquery> = TSubquery extends {
  getResolvedColumns(): infer TColumns;
}
  ? TColumns
  : never;

/** Whether `T` is a union of more than one member. */
type IsUnion<T, TAll = T> = T extends unknown
  ? [TAll] extends [T]
    ? false
    : true
  : never;

/**
 * The single source of a resolved projection, or `never` when the projection
 * has no columns or more than one.
 */
type SingleSourceOf<TRow> = [keyof TRow] extends [never]
  ? never
  : IsUnion<keyof TRow> extends true
    ? never
    : TRow[keyof TRow];

/** Raw value type of the single column a scalar subquery selects. */
export type ScalarSubqueryValue<TSubquery> =
  TSubquery extends Sql<infer TValue>
    ? TValue
    : SingleSourceOf<ResolvedColumns<TSubquery>> extends infer TSource
      ? InferValueType<TSource>
      : never;

/** PostgreSQL type category of the single column a scalar subquery selects. */
export type ScalarSubqueryPgType<TSubquery> =
  TSubquery extends Sql<infer TValue>
    ? LiteralPgType<TValue>
    : SingleSourceOf<ResolvedColumns<TSubquery>> extends infer TSource
      ? TSource extends { $: { PgType: infer TPgType extends string } }
        ? TPgType
        : TSource extends number | bigint
          ? "numeric"
          : TSource extends string
            ? "text"
            : TSource extends boolean
              ? "boolean"
              : string
      : string;

type LiteralPgType<T> = T extends number | bigint
  ? "numeric"
  : T extends string
    ? "text"
    : T extends boolean
      ? "boolean"
      : string;

/** Builds the scalar expression type of a select query, or `never` when invalid. */
export type NormalizedScalar<T> = T extends { $isSelectQuery: true }
  ? [ScalarSubqueryValue<T>] extends [never]
    ? never
    : ScalarSubqueryFn<
        ScalarSubqueryValue<T>,
        SubqueryHasArg<T>,
        ScalarSubqueryPgType<T>
      >
  : T;

/** A normalized scalar narrowed to the operand branch a query must satisfy. */
export type NormalizedOperand<T, TQueryOperand> = T extends ScalarQueryLike
  ? NormalizedScalar<T> & TQueryOperand
  : T;

/** A column or SQL expression producing one of the given PostgreSQL type categories. */
export type PgTypedOperand<TPgType extends string> = (
  | AnyScalarColumn
  | AnySqlFn
) & {
  $: { PgType: TPgType };
};

/** A SQL expression producing one of the given PostgreSQL type categories. */
export type PgTypedSqlFn<TPgType extends string> = AnySqlFn & {
  $: { PgType: TPgType };
};

/** A normalized scalar operand narrowed to a PostgreSQL-typed SQL expression. */
export type NormalizedTypedOperand<
  T,
  TPgType extends string,
> = NormalizedOperand<T, PgTypedSqlFn<TPgType>>;

/**
 * Compile-time guard for a scalar subquery operand: a multi-column query
 * resolves to `never`, which rejects the argument.
 */
export type ScalarArg<T> = T extends { $isSelectQuery: true }
  ? [ScalarSubqueryValue<T>] extends [never]
    ? never
    : T
  : T;

/**
 * Compile-time guard for a typed scalar operand: a query is accepted only when
 * its selected column's PostgreSQL type is one of `TPgType`.
 */
export type TypedScalarArg<T, TPgType extends string> = T extends {
  $isSelectQuery: true;
}
  ? [ScalarSubqueryValue<T>] extends [never]
    ? never
    : ScalarSubqueryPgType<T> extends TPgType
      ? T
      : never
  : T;

/** Minimal marker shared by select queries used as scalar values. */
export type ScalarQueryLike = {
  readonly $isSelectQuery: true;
};

/**
 * A select query whose single value is assignable to `TValue`.
 * `TPrepare` mirrors the query's prepare flag so prepared subqueries are
 * rejected by unprepared callers.
 */
export type ScalarQueryOf<TValue, TPrepare extends boolean> = {
  readonly $isSelectQuery: true;
  readonly $prepare: TPrepare extends true ? boolean : false;
  readonly $scalarValue: TValue;
  getResolvedColumns(): Record<
    string,
    | { ValTypeSelect: TValue }
    | { $: { kind: "sqlFn"; TsType: TValue } }
    | { $: { kind: "sql"; TsType: TValue } }
    | TValue
  >;
};

/** Input accepted by a scalar subquery expression. */
export type ScalarSubqueryInput = WidenedSelectQuery<boolean> | Sql;

/**
 * A `(SELECT ...)` expression used as a scalar value.
 *
 * The value is nullable because PostgreSQL returns `NULL` when the subquery
 * has no row. Use `coalesce(...)` when assigning to a non-null column.
 */
export class ScalarSubqueryFn<
  TValue = unknown,
  THasArg extends boolean = false,
  TPgType extends string = string,
> extends SubqueryOwnedSqlFn<never, TValue | null, THasArg, TPgType> {
  readonly #subquery: ScalarSubqueryInput;
  readonly #convert: ((value: unknown) => unknown) | null;

  constructor(subquery: ScalarSubqueryInput) {
    super();
    this.#subquery = subquery;
    if (subquery instanceof Sql) {
      this.#convert = null;
      return;
    }
    const columns = subquery.getResolvedColumns();
    const keys = Object.keys(columns);
    if (keys.length !== 1) {
      throw new Error(
        `A scalar subquery must select exactly one column, got ${keys.length}.`,
      );
    }
    this.#convert = buildSelectItemConverter(columns[keys[0]]);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "(";
    if (this.#subquery instanceof Sql) {
      this.#subquery.toQuery(query, ctx);
    } else {
      this.#subquery.toQuery(query);
    }
    query.sql += ")";
  }

  toDriverValue(value: TValue | null): unknown {
    return value;
  }

  toSQLValue(value: TValue | null): string {
    return toSqlValue(value as never);
  }

  fromDriverValue(value: unknown): TValue | null {
    return (this.#convert ? this.#convert(value) : value) as TValue | null;
  }
}

/** Detects a `SelectQuery` without importing the query-builder module. */
export function isSelectQuery(
  value: unknown,
): value is WidenedSelectQuery<boolean> {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { $isSelectQuery?: unknown }).$isSelectQuery === true
  );
}

/** Wraps a select query as a scalar expression; other values pass through. */
export function normalizeScalar<T>(value: T): NormalizedScalar<T> {
  return (
    isSelectQuery(value) ? new ScalarSubqueryFn(value) : value
  ) as NormalizedScalar<T>;
}

/** Normalizes a scalar operand and narrows it to a PostgreSQL-typed expression. */
export function normalizeTypedScalar<T, TPgType extends string>(
  operand: TypedScalarArg<T, TPgType>,
): NormalizedTypedOperand<T, TPgType> {
  return normalizeScalar(operand) as unknown as NormalizedTypedOperand<
    T,
    TPgType
  >;
}

/** Normalizes a scalar operand and narrows it to the SQL function branch. */
export function normalizeScalarFn<T>(
  operand: ScalarArg<T>,
): NormalizedOperand<T, AnySqlFn> {
  return normalizeScalar(operand) as unknown as NormalizedOperand<T, AnySqlFn>;
}

/** Normalizes every element of a tuple/array. */
export function normalizeScalars<T extends readonly unknown[]>(
  values: T,
): { [K in keyof T]: NormalizedScalar<T[K]> } {
  const out = new Array(values.length) as unknown[];
  for (let i = 0; i < values.length; i++) {
    out[i] = normalizeScalar(values[i]);
  }
  return out as { [K in keyof T]: NormalizedScalar<T[K]> };
}

/** Normalizes every value of a record. */
export function normalizeScalarRecord<T extends Record<string, unknown>>(
  record: T,
): { [K in keyof T]: NormalizedScalar<T[K]> } {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    setOwn(out, key, normalizeScalar(record[key]));
  }
  return out as { [K in keyof T]: NormalizedScalar<T[K]> };
}
