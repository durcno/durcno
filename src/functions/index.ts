import { Query, type QueryContext } from "../query-builders/query";
import { type Sql, sql } from "../sql";
import type { StdTableColumn, TableAnyColumn } from "../table";

export type SqlFnType = "aggregate" | "scalar";

/**
 * Abstract base class for typed SQL functions.
 *
 * Analogous to `Filter` but for expressions that produce a **value** rather
 * than a boolean predicate. A `SqlFn` can be used in:
 * - `.select({ alias: sqlFn })` — adds a computed column to the result
 * - `.orderBy(asc(sqlFn))` — orders by a computed expression
 * - `.where(lt(sqlFn, value))` — compares the expression in a WHERE clause
 *
 * @template TColumn - The scoped table column(s) this expression references.
 * @template THasArg - `true` when this expression embeds at least one `Arg` placeholder.
 *   Set to `true` in concrete subclasses that accept `Arg` values; defaults to `false`.
 *   Arg-bearing expressions are only accepted in prepared queries (`db.prepare()`).
 * @template TFnType - `"aggregate"` for aggregate functions (e.g. `count`, `sum`),
 *   `"scalar"` for scalar functions (e.g. `lower`, `abs`). Defaults to the union.
 * @template TPgType - The PostgreSQL type category this expression produces
 *   (e.g. `"string"`, `"numeric"`). Mirrors `Column.$["PgType"]` so that
 *   a `SqlFn` can be accepted wherever a column of the same category is expected,
 *   enabling type-safe nested function calls (e.g. `lower(trim(col))`).
 * @template TTsType - The TypeScript type this expression evaluates to.
 */
export abstract class SqlFn<
  TColumn extends TableAnyColumn,
  THasArg extends boolean = false,
  TFnType extends "aggregate" | "scalar" = "aggregate" | "scalar",
  TPgType extends string = string,
  TTsType = any,
> {
  readonly $!: {
    kind: "sqlFn";
    TsType: TTsType;
    PgType: TPgType;
  };

  /** Phantom field carrying the kind of this SQL expression (`"aggregate"` or `"scalar"`). */
  readonly $FnType!: TFnType;

  /** Phantom field used to enforce column scope — mirrors `Filter.$Columns`. */
  readonly $Columns!: TColumn;

  /** Phantom field: `true` when this expression embeds at least one `Arg` placeholder. */
  readonly $HasArg!: THasArg;

  /**
   * Runtime flag: `true` for aggregate functions (e.g. `count`, `sum`, `avg`),
   * `false` for scalar functions (e.g. `lower`, `abs`).
   * Used by `SelectQuery.toQuery()` to auto-generate a `GROUP BY` clause when
   * aggregates and non-aggregates are mixed in the same `.select()` call.
   */
  readonly isAggregate: boolean = false;

  /** Appends the SQL fragment for this expression to the query (no trailing semicolon). */
  abstract toQuery(query: Query, ctx?: QueryContext): void;

  toSQL(): string {
    const query = new Query("", () => []);
    this.toQuery(query);
    return query.sql;
  }

  /**
   * Converts a raw driver value returned from PostgreSQL into the TypeScript
   * value declared by `TTsType`.
   *
   * The default implementation covers the common cases:
   * - `null` → `null`
   * - `bigint` → `bigint` (passed through as-is to preserve precision)
   * - numeric string (e.g. `"42"`, `"3"`) → `Number(value)`
   * - anything else → `value` as-is
   *
   * Subclasses can override this method to provide custom conversions.
   */
  fromDriver(value: unknown) {
    if (value === null) return null as TTsType;
    if (typeof value === "bigint") return value as TTsType;
    if (typeof value === "string") {
      const num = Number(value);
      return (Number.isNaN(num) ? value : num) as TTsType;
    }
    return value as TTsType;
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <>
export type StdSqlFn = SqlFn<StdTableColumn, boolean, SqlFnType, string, any>;

// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnySqlFn = SqlFn<any, any, any, any, any>;

// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnyScalarSqlFn = SqlFn<any, any, "scalar", any, any>;

/**
 * Extracts the table column(s) referenced by a scalar expression.
 * For a raw column, returns the column itself.
 * For a `SqlFn`, reads `$Columns` via `$.id === "sqlFn"` rather than checking
 * `TExpr extends SqlFn<any, infer TCol, ...>`, which would cause infinite type
 * instantiation when used as a class default type parameter.
 * Uses `$.id === "column"` for raw columns to avoid instantiating the full
 * `Column<any, any>` generic, which also causes TS2589.
 */
export type ExprColumns<TExpr> = TExpr extends {
  $: { kind: "sqlFn" };
  $Columns: infer TCol extends TableAnyColumn;
}
  ? TCol
  : TExpr extends { $: { kind: "column" } }
    ? TExpr
    : never;

/**
 * Extracts the `$HasArg` flag from an expression.
 */
export type HasArg<TExpr> = TExpr extends {
  $HasArg: infer H;
}
  ? H extends true
    ? true
    : false
  : false;

/**
 * Extracts the value/return type of a scalar expression.
 * For a raw column, returns its `ValType`.
 * For a `SqlFn`, returns its `ReturnType` phantom.
 */
export type ExprReturnType<TExpr> = TExpr extends {
  $: { kind: "column" };
  ValType: infer T;
}
  ? T
  : TExpr extends { $: { kind: "sqlFn" }; TsType: infer U }
    ? U
    : never;

/**
 * Returns a Sql object that represents the SQL function `now()`.
 * @returns Sql
 */
export function now(): Sql {
  return sql`now()`;
}

/**
 * Returns a Sql object that represents the SQL function `gen_random_uuid()` (UUID v4).
 *
 * Note: Requires the pgcrypto extension in PostgreSQL.
 * @returns Sql
 */
export function uuidv4(): Sql {
  return sql`gen_random_uuid()`;
}

/**
 * Returns a Sql object that represents the SQL function `uuid_generate_v7()` (UUID v7).
 *
 * Note: Requires the uuid-ossp extension in PostgreSQL.
 * @returns Sql
 */
export function uuidv7(): Sql {
  return sql`uuid_generate_v7()`;
}
