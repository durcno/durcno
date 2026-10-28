import { is, isCol } from "../entity";
import { Arg } from "../query-builders/prepare";
import { Query, type QueryContext } from "../query-builders/query";
import { escLiteral, Sql, sql, toSqlValue } from "../sql";
import type { AnyColumn, StdTableColumn } from "../table";

export type SqlFnType = "aggregate" | "scalar" | "window";

/** Whether `T` is, or wraps, an aggregate or a window function. */
export type HasAggregateOf<T> = [
  Extract<T extends { _: { hasAggregate: infer H } } ? H : never, true>,
] extends [never]
  ? false
  : true;

/** Depth cap: a cyclic operand returns `false` instead of overflowing. */
const MAX_OPERAND_DEPTH = 32;

/** Runtime counterpart of `HasAggregateOf`; walks arrays and records, depth-bounded. */
export function containsAggregate(operand: unknown): boolean {
  return containsAggregateAt(operand, 0);
}

function containsAggregateAt(operand: unknown, depth: number): boolean {
  if (operand === null || typeof operand !== "object") return false;
  if (depth >= MAX_OPERAND_DEPTH) return false;
  if (Array.isArray(operand)) {
    for (let i = 0; i < operand.length; i++) {
      if (containsAggregateAt(operand[i], depth + 1)) return true;
    }
    return false;
  }
  const proto = Object.getPrototypeOf(operand);
  if (proto !== Object.prototype && proto !== null) {
    const runtime = (operand as { _?: { hasAggregate?: unknown } })._;
    return typeof runtime?.hasAggregate === "boolean"
      ? runtime.hasAggregate
      : false;
  }
  const record = operand as Record<string, unknown>;
  for (const key in record) {
    if (containsAggregateAt(record[key], depth + 1)) return true;
  }
  return false;
}

/** Runtime counterpart of window-function presence; same walk as aggregates. */
export function containsWindow(operand: unknown): boolean {
  return containsWindowAt(operand, 0);
}

function containsWindowAt(operand: unknown, depth: number): boolean {
  if (operand === null || typeof operand !== "object") return false;
  if (depth >= MAX_OPERAND_DEPTH) return false;
  if (Array.isArray(operand)) {
    for (let i = 0; i < operand.length; i++) {
      if (containsWindowAt(operand[i], depth + 1)) return true;
    }
    return false;
  }
  const proto = Object.getPrototypeOf(operand);
  if (proto !== Object.prototype && proto !== null) {
    const runtime = (operand as { _?: { hasWindow?: unknown } })._;
    return typeof runtime?.hasWindow === "boolean" ? runtime.hasWindow : false;
  }
  const record = operand as Record<string, unknown>;
  for (const key in record) {
    if (containsWindowAt(record[key], depth + 1)) return true;
  }
  return false;
}

/** `HasAggregateOf` for a tuple of conditions. */
export type HasAggregateOfConditions<T extends readonly unknown[]> =
  HasAggregateOf<T[number]>;

/** Runtime state shared by filters and functions, carrying the precise static flags too. */
export interface RuntimeFlags<THasAggregate extends boolean = boolean> {
  /** Whether the expression is, or contains, an aggregate or window function. */
  readonly hasAggregate: THasAggregate;
  /** Whether the expression is, or contains, a window function. */
  readonly hasWindow: boolean;
}

/** Runtime state of a SQL function. */
export interface SqlFnRuntime<
  TSqlFnType extends SqlFnType = SqlFnType,
  THasAggregate extends boolean = boolean,
> extends RuntimeFlags<THasAggregate> {
  /** The kind of function: `"aggregate"`, `"scalar"` or `"window"`. */
  readonly sqlFnType: TSqlFnType;
}

/**
 * Abstract base class for typed SQL functions.
 *
 * Analogous to `Filter` but for expressions that produce a **value** rather
 * than a boolean predicate.
 */
export abstract class SqlFn<
  TColumn extends AnyColumn,
  TSqlFnType extends SqlFnType = SqlFnType,
  TPgType extends string = string,
  TTsType = unknown,
  THasArg extends boolean = false,
  THasAggregate extends boolean = false,
> {
  readonly $!: {
    /** Discriminant id for this entity kind. */
    kind: "sqlFn";
    /** The TypeScript type this expression evaluates to. */
    TsType: TTsType;
    /** The PostgreSQL type category this expression produces (e.g. `"string"`, `"numeric"`). */
    PgType: TPgType;
    /** The column(s) this expression references. */
    Columns: TColumn;
    /** `true` when this expression embeds at least one `Arg` placeholder. */
    HasArg: THasArg;
  };

  /**
   * Runtime state, including the precise static flags. A windowed expression
   * reports both flags as `true`; `hasWindow` keeps auto `GROUP BY` off.
   */
  readonly _: SqlFnRuntime<TSqlFnType, THasAggregate>;

  /**
   * @param hasAggregate - Whether this expression is, or contains, an aggregate.
   * @param hasWindow - Whether this expression is, or contains, a window function.
   * @param sqlFnType - The function kind; defaults to `"scalar"`.
   */
  constructor(
    hasAggregate = false,
    hasWindow = false,
    sqlFnType: SqlFnType = "scalar",
  ) {
    this._ = {
      sqlFnType: sqlFnType as TSqlFnType,
      hasAggregate: hasAggregate as THasAggregate,
      hasWindow,
    };
  }

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

  /**
   * Whether an operand is, or contains, an aggregate. Accepts one operand, an
   * array or a record; public so subclasses can call it.
   */
  static _hasAggregate(operand: unknown): boolean {
    return containsAggregate(operand);
  }

  /**
   * Whether an operand is, or contains, a window function. Same shape as
   * `_hasAggregate`; public so subclasses can call it.
   */
  static _hasWindow(operand: unknown): boolean {
    return containsWindow(operand);
  }

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

  /** Default implementation for json-returning functions. */
  protected static _jsonFromDriver(value: unknown): unknown {
    return parseJsonDriverValue(value);
  }
}

/**
 * Parses a JSON driver value, returning it unchanged when it is already
 * decoded.
 */
export function parseJsonDriverValue(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

/**
 * Whether a value is a plain record — an object literal or a null-prototype
 * object — rather than an entity, array, or class instance.
 */
export function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Defines an own data property, so a key such as `__proto__` cannot change the
 * target's prototype.
 */
export function setOwn(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

/**
 * Restores a driver value to the type of the expression that produced it.
 *
 * Columns restore their own driver type, functions delegate to their own
 * conversion, and literals are rebuilt from their driver representation.
 */
export function restoreOperandValue(expr: unknown, value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (isCol(expr)) {
    // A JSON value is already decoded when read from an outer JSON document.
    if (detectJsonKind(expr) !== null) return value;
    return expr.fromDriver(value);
  }
  if (is(expr, Arg)) {
    return expr.fromDriver ? expr.fromDriver(value) : value;
  }
  if (expr instanceof SqlFn) return expr.fromDriverValue(value);

  switch (typeof expr) {
    case "number":
      return Number(value);
    case "bigint":
      return BigInt(value as string | number);
    case "boolean":
      return value === true || value === "t" || value === "true";
    case "string":
      return value;
  }

  if (expr instanceof Date) {
    return value instanceof Date ? value : new Date(value as string | number);
  }
  if (Array.isArray(expr)) {
    const parsed = parseJsonDriverValue(value);
    if (!Array.isArray(parsed)) return parsed;
    for (let i = 0; i < parsed.length; i++) {
      const source = expr[i];
      if (source === undefined) continue;
      parsed[i] = restoreOperandValue(source, parsed[i]);
    }
    return parsed;
  }
  if (isPlainRecord(expr)) {
    const parsed = parseJsonDriverValue(value);
    if (!isPlainRecord(parsed)) return parsed;
    const restored: Record<string, unknown> = {};
    for (const key in expr) {
      if (!Object.hasOwn(expr, key) || !Object.hasOwn(parsed, key)) continue;
      setOwn(restored, key, restoreOperandValue(expr[key], parsed[key]));
    }
    return restored;
  }
  return value;
}

export interface AppendOperandOptions {
  /** If true, default JSON casts use `::jsonb` instead of `::json`. */
  preferJsonb?: boolean;
  /** If true, default JSON casts use `::json`. */
  preferJson?: boolean;
  /** The leading or reference operand (used to inherit dimensions or jsonb/json type). */
  leadOperand?: unknown;
  /** Cast applied to an `Arg` placeholder that has no cast of its own. */
  argCastFallback?: string;
  /** Cast applied to a `Date` literal that has no column lead. */
  dateCastFallback?: string;
}

type FnClassWithJsonKind = { name: string };

/**
 * JSON kind of a `SqlFn` class, or `null` when the class name says nothing and
 * the instance's own `pgType` has to decide. Classes are stable, so the cache
 * stays small.
 */
const jsonKindByClass = new WeakMap<
  FnClassWithJsonKind,
  "json" | "jsonb" | null
>();

/**
 * `json` must lose to `jsonb`, and a name carrying neither is unknown rather
 * than absent — the instance may still report a `pgType`.
 */
function resolveJsonKindByName(name: string): "json" | "jsonb" | null {
  const lower = name.toLowerCase();
  if (lower.includes("jsonb")) return "jsonb";
  if (lower.includes("json")) return "json";
  return null;
}

/**
 * Detects whether an expression or column represents a JSON or JSONB value at runtime.
 */
export function detectJsonKind(e: unknown): "json" | "jsonb" | null {
  if (!e || typeof e !== "object") return null;
  if (isCol(e)) {
    const cast = e.sqlCastScalar || e.sqlTypeScalar;
    if (cast === "jsonb") return "jsonb";
    if (cast === "json") return "json";
    return null;
  }
  if (e instanceof SqlFn) {
    const ctor = e.constructor as FnClassWithJsonKind;
    let kind = jsonKindByClass.get(ctor);
    if (kind === undefined) {
      kind = resolveJsonKindByName(ctor.name);
      jsonKindByClass.set(ctor, kind);
    }
    if (kind !== null) return kind;
    const pgType = (e as { pgType?: unknown }).pgType;
    if (pgType === "jsonb") return "jsonb";
    if (pgType === "json") return "json";
    return null;
  }
  const pgType = (e as { $?: { PgType?: unknown } }).$?.PgType;
  if (pgType === "jsonb") return "jsonb";
  if (pgType === "json") return "json";
  return null;
}

/**
 * Serializes a JavaScript value as JSON text.
 *
 * JSON has no bigint, so a bigint becomes a number the same way PostgreSQL's
 * `to_json` does; the JSON parser rounds anything beyond the safe range.
 */
function stringifyJsonValue(value: unknown): string {
  const json = JSON.stringify(value, (_key, item) =>
    typeof item === "bigint" ? Number(item) : item,
  );
  return json === undefined ? "null" : json;
}

/**
 * Serializes a JavaScript value as a PostgreSQL JSON or JSONB literal.
 */
export function jsonToSQLValue(value: unknown, kind: "json" | "jsonb"): string {
  return `'${stringifyJsonValue(value).replace(/'/g, "''")}'::${kind}`;
}

/**
 * Shared serialization helper for SQL function operands (CASE, COALESCE, JSON, etc.).
 * Handles null, Arg placeholders, columns, SqlFns, raw Sql, arrays, primitives,
 * and plain objects (serialized as JSON/JSONB literals).
 */
export function appendOperand(
  query: Query,
  expr: unknown,
  ctx?: QueryContext,
  options?: AppendOperandOptions,
): void {
  if (expr === null || expr === undefined) {
    query.sql += "NULL";
  } else if (is(expr, Arg)) {
    query.addArg(
      expr,
      expr.cast ?? expr.jsonCast ?? options?.argCastFallback ?? null,
    );
  } else if (isCol(expr)) {
    expr.toQuery(query, ctx);
  } else if (expr instanceof SqlFn) {
    expr.toQuery(query, ctx);
  } else if (expr instanceof Sql) {
    expr.toQuery(query, ctx);
  } else if (Array.isArray(expr)) {
    const lead = options?.leadOperand;
    if (lead && isCol(lead) && lead.dimensions) {
      query.sql += lead.toSQLExpression(expr);
    } else {
      const jsonKind =
        (options?.preferJsonb ? "jsonb" : null) ??
        detectJsonKind(lead) ??
        (options?.preferJson ? "json" : null);

      if (jsonKind === "jsonb" || jsonKind === "json") {
        // `json_build_array` handles columns, expressions, nested arrays, and
        // dates without serializing the operand to JSON text by hand.
        query.sql +=
          jsonKind === "jsonb" ? "jsonb_build_array(" : "json_build_array(";
        const elementOptions: AppendOperandOptions = {
          preferJsonb: jsonKind === "jsonb",
          preferJson: jsonKind === "json",
          argCastFallback: options?.argCastFallback,
        };
        for (let i = 0; i < expr.length; i++) {
          if (i !== 0) query.sql += ", ";
          appendOperand(query, expr[i], ctx, elementOptions);
        }
        query.sql += ")";
      } else if (expr.length === 0) {
        query.sql += "'{}'";
      } else {
        query.sql += "ARRAY[";
        for (let i = 0; i < expr.length; i++) {
          if (i !== 0) query.sql += ", ";
          query.sql += toSqlValue(expr[i]);
        }
        query.sql += "]";
      }
    }
  } else if (typeof expr === "string") {
    query.sql += `'${escLiteral(expr)}'`;
  } else if (typeof expr === "number" || typeof expr === "bigint") {
    query.sql += expr.toString();
  } else if (typeof expr === "boolean") {
    query.sql += expr ? "TRUE" : "FALSE";
  } else if (expr instanceof Date) {
    const lead = options?.leadOperand;
    if (lead && isCol(lead)) {
      query.sql += lead.toSQL(expr);
    } else if (Number.isNaN(expr.getTime())) {
      query.sql += "NULL";
    } else {
      const cast = options?.dateCastFallback;
      query.sql += `'${expr.toISOString()}'${cast ? `::${cast}` : ""}`;
    }
  } else if (typeof expr === "object") {
    const lead = options?.leadOperand;
    const jsonKind =
      (options?.preferJsonb ? "jsonb" : null) ??
      detectJsonKind(lead) ??
      (options?.preferJson ? "json" : null) ??
      "json";
    query.sql += `'${stringifyJsonValue(expr).replace(/'/g, "''")}'::${jsonKind}`;
  } else {
    query.sql += toSqlValue(expr as never);
  }
}

export type StdSqlFn = SqlFn<
  StdTableColumn,
  SqlFnType,
  string,
  unknown,
  boolean,
  boolean
>;

// biome-ignore lint/suspicious/noExplicitAny: any column scope is the wildcard this alias exists for
export type AnySqlFn = SqlFn<any, SqlFnType, string, unknown, boolean, boolean>;

/** Any `SqlFn` scoped to `TColumn`, aggregate or not. */
export type ScopedSqlFn<
  TColumn extends AnyColumn,
  THasArg extends boolean = boolean,
> = SqlFn<TColumn, SqlFnType, string, unknown, THasArg, boolean>;

/**
 * Any `SqlFn` that contains no aggregate, however deeply wrapped. Accepted
 * where PostgreSQL refuses an aggregate.
 */
export type NonAggregateSqlFn<
  TColumn extends AnyColumn = AnyColumn,
  TTsType = unknown,
  THasArg extends boolean = boolean,
> = SqlFn<TColumn, SqlFnType, string, TTsType, THasArg, false>;

/**
 * Extracts the table column(s) referenced by a scalar expression.
 * For a raw column, returns the column itself.
 * For a `SqlFn`, reads `$.Columns` via `$.kind === "sqlFn"` rather than
 * checking `TExpr extends SqlFn<any, infer TCol, ...>`, which would cause
 * infinite type instantiation when used as a class default type parameter.
 * Uses `$.kind === "column"` for raw columns to avoid instantiating the full
 * `Column<any, any>` generic, which also causes TS2589.
 */
export type ExprColumns<TExpr> = TExpr extends {
  $: { kind: "sqlFn"; Columns: unknown };
}
  ? TExpr["$"]["Columns"]
  : TExpr extends { $: { kind: "column" } }
    ? TExpr
    : never;

/** Extracts `$.HasArg`; `never` reads as `false`. */
export type HasArg<TExpr> = [TExpr] extends [never]
  ? false
  : TExpr extends { $: { HasArg: unknown } }
    ? [TExpr["$"]["HasArg"]] extends [never]
      ? false
      : TExpr["$"]["HasArg"] extends true
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
