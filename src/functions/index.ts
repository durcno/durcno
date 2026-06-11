import { Query, type QueryContext } from "../query-builders/query";
import { type Sql, sql } from "../sql";
import type { AnyColumn, StdTableColumn } from "../table";

export type SqlFnType = "aggregate" | "scalar";

/**
 * Abstract base class for typed SQL functions.
 *
 * Analogous to `Filter` but for expressions that produce a **value** rather
 * than a boolean predicate.
 *
 * @template TColumn - The scoped table column(s) this expression references.
 * @template THasArg - `true` when this expression embeds at least one `Arg` placeholder.
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
  TColumn extends AnyColumn,
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

  /** Converts a TypeScript value to a raw driver value (write path). */
  abstract toDriverValue(value: TTsType | null): unknown;

  /** Converts a TypeScript value to a SQL literal string. */
  abstract toSQLValue(value: TTsType | null): string;

  /** Converts a raw PostgreSQL driver value to the TypeScript type `TTsType`. */
  abstract fromDriverValue(value: unknown): TTsType | null;

  // --- Protected shared helpers (DRY for subclasses) ---

  /** Default implementation for numeric-returning functions. */
  protected static _numericFromDriver(value: unknown): number | null {
    if (value === null) return null;
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "string") return Number(value);
    return value as number;
  }

  /** Default implementation for string-returning functions. */
  protected static _stringFromDriver(value: unknown): string | null {
    if (value === null) return null;
    return value as string;
  }

  /** Default SQL literal for a numeric value. */
  protected static _numericToSQL(value: number | bigint | null): string {
    return value === null ? "NULL" : value.toString();
  }

  /** Default SQL literal for a string value. */
  protected static _stringToSQL(value: string | null): string {
    if (value === null) return "NULL";
    return `'${value.replace(/'/g, "''")}'`;
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <>
export type StdSqlFn = SqlFn<StdTableColumn, boolean, SqlFnType, string, any>;

// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnySqlFn = SqlFn<any, any, any, any, any>;

// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnyScalarSqlFn = SqlFn<any, any, "scalar", any, any>;

// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnyAggregateSqlFn = SqlFn<any, any, "aggregate", any, any>;

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
  $Columns: infer TCol extends AnyColumn;
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
