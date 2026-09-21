import type { Arg } from "../query-builders/prepare";
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
  $Columns: infer TCol;
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
 * Resolves the runtime/select TypeScript type of any expression:
 * - `null` -> `null`
 * - Column with `ValTypeSelect` -> `TCol["ValTypeSelect"]`
 * - `SqlFn` -> `TSqlFn["$"]["TsType"]`
 * - `Arg<A>` -> `A`
 * - Primitive literals / types -> `string`, `number`, `bigint`, `boolean`
 */
export type InferValueType<TExpr> = TExpr extends null
  ? null
  : TExpr extends { ValTypeSelect: infer V }
    ? V
    : TExpr extends { $: { kind: "sqlFn"; TsType: infer T } }
      ? T
      : TExpr extends Sql<infer S>
        ? S
        : TExpr extends Arg<infer A>
          ? A
          : TExpr extends string
            ? string
            : TExpr extends number
              ? number
              : TExpr extends bigint
                ? bigint
                : TExpr extends boolean
                  ? boolean
                  : TExpr;

/** Checks if any element in a tuple of expressions is definitely null. */
export type HasStrictNull<TTuple extends readonly unknown[]> =
  TTuple extends readonly [infer Head, ...infer Tail]
    ? [InferValueType<Head>] extends [null]
      ? true
      : HasStrictNull<Tail>
    : false;

/** Checks if any element in a tuple of expressions contains null in its union. */
export type HasNullable<TTuple extends readonly unknown[]> =
  TTuple extends readonly [infer Head, ...infer Tail]
    ? null extends InferValueType<Head>
      ? true
      : HasNullable<Tail>
    : false;

/**
 * Calculates the return type of a strict PostgreSQL function given its argument tuple:
 * - If ANY argument is strictly `null` (e.g. `lower(null)`), returns `null`.
 * - If NO argument is strictly `null` but AT LEAST ONE can be `null` (e.g. `lower(users.email)`), returns `TBase | null`.
 * - If ALL arguments are non-null (e.g. `lower(users.username)` or `lower("HELLO")`), returns `TBase`.
 */
export type StrictFnReturn<TTuple extends readonly unknown[], TBase> =
  HasStrictNull<TTuple> extends true
    ? null
    : HasNullable<TTuple> extends true
      ? TBase | null
      : TBase;

/**
 * Extracts the value/return type of a scalar expression.
 * For a raw column, returns its `ValTypeSelect`.
 * For a `SqlFn`, returns its `TsType`.
 */
export type ExprReturnType<TExpr> = InferValueType<TExpr>;

/**
 * Returns a Sql object that represents the SQL function `now()`.
 * @returns Sql<Date>
 */
export function now(): Sql<Date> {
  return sql<Date>`now()`;
}

/**
 * Returns a Sql object that represents the SQL function `gen_random_uuid()` (UUID v4).
 *
 * Note: Requires the pgcrypto extension in PostgreSQL.
 * @returns Sql<string>
 */
export function uuidv4(): Sql<string> {
  return sql<string>`gen_random_uuid()`;
}

/**
 * Returns a Sql object that represents the SQL function `uuid_generate_v7()` (UUID v7).
 *
 * Note: Requires the uuid-ossp extension in PostgreSQL.
 * @returns Sql<string>
 */
export function uuidv7(): Sql<string> {
  return sql<string>`uuid_generate_v7()`;
}
