import { is } from "../entity";
import type { Filter } from "../filters";
import { type AnyArg, Arg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import type { SelectQuery } from "../query-builders/select";
import { Sql } from "../sql";
import type { AnyColumn } from "../table";
import type { AnySubquery } from "../virtual-table";
import { SqlFn } from "./index";

/**
 * Union of valid subquery types accepted by subquery functions:
 * - A `SelectQuery` instance (from `db.from(...).select(...)`)
 * - Any subquery instance satisfying `AnySubquery`
 * - A raw `Sql` instance (e.g. `sql\`SELECT 1 FROM ...\``)
 */
export type SubqueryInput<TArg extends boolean = boolean> =
  // biome-ignore lint/suspicious/noExplicitAny: subquery return and column types are arbitrary
  | SelectQuery<any, any, any, TArg, any, any, any, any, any, any, any>
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
  TSubquery extends SelectQuery<
    // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters to extract TArg
    any,
    // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters to extract TArg
    any,
    // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters to extract TArg
    any,
    infer TArg,
    // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters to extract TArg
    any,
    // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters to extract TArg
    any,
    // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters to extract TArg
    any,
    // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters to extract TArg
    any,
    // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters to extract TArg
    any,
    // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters to extract TArg
    any,
    // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters to extract TArg
    any
  >
    ? TArg
    : false;

export type InSelectQuery<
  TArg extends boolean = boolean,
  TReturn = unknown,
> = SelectQuery<
  // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters
  any,
  // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters
  any,
  // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters
  any,
  TArg,
  // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters
  any,
  // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters
  any,
  // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters
  any,
  // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters
  any,
  // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters
  any,
  // biome-ignore lint/suspicious/noExplicitAny: wildcard parameters
  any,
  Record<string, TReturn>[]
>;

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
  extends SqlFn<TColumn, THasArg, "scalar", "boolean", boolean>
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
        const v = this.values[i];
        if (is(v, Arg)) {
          query.addArg(v);
        } else {
          query.sql += this.field.toSQL(v);
        }
        if (i < this.values.length - 1) query.sql += ", ";
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
