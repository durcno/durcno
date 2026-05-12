import type { Query, QueryContext } from "../query-builders/query";
import type { TableAnyColumn } from "../table";
import { type AnyScalarSqlFn, type ExprColumns, type HasArg, SqlFn } from ".";

/**
 * Any expression that can be passed to an aggregate function.
 * Restricts nested expressions to scalars, preventing illegal
 * aggregate-in-aggregate nesting at the type level.
 */
type AggregateInput = TableAnyColumn | AnyScalarSqlFn;

// Numeric aggregate input: columns or scalar SqlFns returning numeric values.
// Columns must be scalar (non-array): ValType is narrowed to exclude array types.
type NumericAggregateInput =
  | (TableAnyColumn & {
      $: { PgType: "numeric" };
      config: { dimension?: undefined };
    })
  | (AnyScalarSqlFn & { $: { PgType: "numeric" } });

// ============================================================================
// count
// ============================================================================

/**
 * SQL aggregate expression: `count(col)`
 * Counts the number of non-null values in the column.
 *
 * Can be used in:
 * - `.select({ total: count(col) })` → `{ total: number }`
 * - `.orderBy(asc(count(col)))` — order by count
 * - `.where(gt(count(col), 0))` — filter by count
 *
 * @template TExpr - The table column to count.
 */
export class CountFn<TExpr extends TableAnyColumn> extends SqlFn<
  TExpr,
  false,
  "aggregate",
  "numeric",
  number
> {
  override readonly isAggregate = true;

  constructor(private readonly expr: TExpr) {
    super();
  }

  /** Appends `count(expr)` to the query SQL. */
  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "count(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/**
 * SQL aggregate expression: `count("*")`
 * Counts all rows including those with null values.
 *
 * Can be used in:
 * - `.select({ total: count("*") })` → `{ total: number }`
 * - `.orderBy(asc(count("*")))` — order by row count
 * - `.where(gt(count("*"), 0))` — filter by row count
 */
export class CountStarFn extends SqlFn<
  never,
  false,
  "aggregate",
  "numeric",
  number
> {
  override readonly isAggregate = true;

  /** Appends `count(*)` to the query SQL. */
  toQuery(query: Query, _ctx?: QueryContext): void {
    query.sql += "count(*)";
  }
}

/**
 * SQL aggregate expression: `count(DISTINCT col)`
 * Counts the number of distinct non-null values in the column.
 *
 * Can be used in:
 * - `.select({ unique: countDistinct(col) })` → `{ unique: number }`
 *
 * @template TExpr - The table column to count distinct values from.
 */
export class CountDistinctFn<TExpr extends TableAnyColumn> extends SqlFn<
  TExpr,
  false,
  "aggregate",
  "numeric",
  number
> {
  override readonly isAggregate = true;

  constructor(private readonly expr: TExpr) {
    super();
  }

  /** Appends `count(DISTINCT expr)` to the query SQL. */
  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "count(DISTINCT ";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/**
 * Creates a SQL aggregate expression `count("*")` that counts all rows.
 *
 * @example
 * db.from(Users).select({ total: count("*") });
 */
export function count(star: "*"): CountStarFn;
/**
 * Creates a SQL aggregate expression `count(col)` that counts non-null values.
 *
 * @param expr - The table column to count (must be in query scope).
 *
 * @example
 * db.from(Orders).select({ total: count(Orders.id) });
 */
export function count<TExpr extends TableAnyColumn>(
  expr: TExpr,
): CountFn<TExpr>;
export function count<TExpr extends TableAnyColumn>(
  expr: TExpr | "*",
): CountFn<TExpr> | CountStarFn {
  if (expr === "*") return new CountStarFn();
  return new CountFn(expr);
}

/**
 * Creates a SQL aggregate expression `count(DISTINCT col)` that counts distinct non-null values.
 *
 * @param expr - The table column to count distinct values for (must be in query scope).
 * @returns A `CountDistinctFn` usable in `.select()`, `.orderBy()`, and `.where()`.
 *
 * @example
 * db.from(Orders).select({ uniqueUsers: countDistinct(Orders.userId) });
 */
export function countDistinct<TExpr extends TableAnyColumn>(
  expr: TExpr,
): CountDistinctFn<TExpr> {
  return new CountDistinctFn(expr);
}

// ============================================================================
// sum
// ============================================================================

/**
 * SQL aggregate expression: `sum(col)`
 * Returns the sum of all non-null values in the column, or `null` if no rows match.
 * The return type follows the column's TypeScript type (e.g., `bigint | null` for `bigint` columns).
 *
 * Can be used in:
 * - `.select({ total: sum(col) })` → `{ total: ColType | null }`
 * - `.orderBy(asc(sum(col)))` — order by sum
 * - `.where(gt(sum(col), 100))` — filter by sum
 *
 * @template TExpr - The numeric column or scalar expression to sum.
 */
export class SumFn<TExpr extends NumericAggregateInput> extends SqlFn<
  ExprColumns<TExpr>,
  HasArg<TExpr>,
  "aggregate",
  "numeric",
  TExpr["$"]["TsType"] | null
> {
  override readonly isAggregate = true;

  constructor(private readonly expr: TExpr) {
    super();
  }

  /** Appends `sum(expr)` to the query SQL. */
  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "sum(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/**
 * Creates a SQL aggregate expression `sum(col)`.
 *
 * @param expr - The numeric column or scalar expression to sum (must be in query scope).
 * @returns A `SumFn` usable in `.select()`, `.orderBy()`, and `.where()`.
 *
 * @example
 * db.from(Orders).select({ total: sum(Orders.amount) });
 */
export function sum<TExpr extends NumericAggregateInput>(
  expr: TExpr,
): SumFn<TExpr> {
  return new SumFn(expr);
}

// ============================================================================
// avg
// ============================================================================

/**
 * SQL aggregate expression: `avg(col)`
 * Returns the average of all non-null values as a `string` (PostgreSQL `numeric`),
 * or `null` if no rows match.
 *
 * Can be used in:
 * - `.select({ average: avg(col) })` → `{ average: string | null }`
 * - `.orderBy(asc(avg(col)))` — order by average
 * - `.where(gt(avg(col), "10.5"))` — filter by average
 *
 * @template TExpr - The numeric column or scalar expression to average.
 */
export class AvgFn<TExpr extends NumericAggregateInput> extends SqlFn<
  ExprColumns<TExpr>,
  HasArg<TExpr>,
  "aggregate",
  "numeric",
  TExpr["$"]["TsType"] | null
> {
  override readonly isAggregate = true;

  constructor(private readonly expr: TExpr) {
    super();
  }

  /**
   * Preserves the raw PostgreSQL `numeric` string (e.g. `"2.5000000000"`).
   * The default `SqlFn.fromDriver` would coerce numeric strings to `number`,
   * which contradicts the declared `string | null` return type.
   */
  override fromDriver(value: unknown): string | null {
    if (value === null) return null;
    return value as string;
  }

  /** Appends `avg(expr)` to the query SQL. */
  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "avg(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/**
 * Creates a SQL aggregate expression `avg(col)`.
 *
 * Returns `string | null` because PostgreSQL returns `avg` as a `numeric` type.
 *
 * @param expr - The numeric column or scalar expression to average (must be in query scope).
 * @returns An `AvgFn` usable in `.select()`, `.orderBy()`, and `.where()`.
 *
 * @example
 * db.from(Orders).select({ average: avg(Orders.amount) });
 */
export function avg<TExpr extends NumericAggregateInput>(
  expr: TExpr,
): AvgFn<TExpr> {
  return new AvgFn(expr);
}

// ============================================================================
// min
// ============================================================================

/**
 * SQL aggregate expression: `min(col)`
 * Returns the minimum value of the column, or `null` if no rows match.
 *
 * Can be used in:
 * - `.select({ lowest: min(col) })` → `{ lowest: ColType | null }`
 * - `.orderBy(asc(min(col)))` — order by minimum
 * - `.where(gt(min(col), value))` — filter by minimum
 *
 * @template TExpr - The column or scalar expression to find the minimum of.
 */
export class MinFn<TExpr extends AggregateInput> extends SqlFn<
  ExprColumns<TExpr>,
  HasArg<TExpr>,
  "aggregate",
  string,
  TExpr["$"]["TsType"] | null
> {
  override readonly isAggregate = true;

  constructor(private readonly expr: TExpr) {
    super();
  }

  /**
   * Delegates to the inner expression's own `fromDriver` so that the result
   * is deserialized to the same TypeScript type as the wrapped column/function.
   */
  override fromDriver(value: unknown): TExpr["$"]["TsType"] | null {
    if (value === null) return null;
    return this.expr.fromDriver(value) as TExpr["$"]["TsType"];
  }

  /** Appends `min(expr)` to the query SQL. */
  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "min(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/**
 * Creates a SQL aggregate expression `min(col)`.
 *
 * The return type matches the expression's value type (or `null` if no rows match).
 *
 * @param expr - The column or scalar expression to find the minimum of (must be in query scope).
 * @returns A `MinFn` usable in `.select()`, `.orderBy()`, and `.where()`.
 *
 * @example
 * db.from(Orders).select({ earliest: min(Orders.createdAt) });
 */
export function min<TExpr extends AggregateInput>(expr: TExpr): MinFn<TExpr> {
  return new MinFn(expr);
}

// ============================================================================
// max
// ============================================================================

/**
 * SQL aggregate expression: `max(col)`
 * Returns the maximum value of the column, or `null` if no rows match.
 *
 * Can be used in:
 * - `.select({ highest: max(col) })` → `{ highest: ColType | null }`
 * - `.orderBy(desc(max(col)))` — order by maximum
 * - `.where(lt(max(col), value))` — filter by maximum
 *
 * @template TExpr - The column or scalar expression to find the maximum of.
 */
export class MaxFn<TExpr extends AggregateInput> extends SqlFn<
  ExprColumns<TExpr>,
  HasArg<TExpr>,
  "aggregate",
  string,
  TExpr["$"]["TsType"] | null
> {
  override readonly isAggregate = true;

  constructor(private readonly expr: TExpr) {
    super();
  }

  /**
   * Delegates to the inner expression's own `fromDriver` so that the result
   * is deserialized to the same TypeScript type as the wrapped column/function.
   */
  override fromDriver(value: unknown): TExpr["$"]["TsType"] | null {
    if (value === null) return null;
    return this.expr.fromDriver(value) as TExpr["$"]["TsType"];
  }

  /** Appends `max(expr)` to the query SQL. */
  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "max(";
    this.expr.toQuery(query, ctx);
    query.sql += ")";
  }
}

/**
 * Creates a SQL aggregate expression `max(col)`.
 *
 * The return type matches the expression's value type (or `null` if no rows match).
 *
 * @param expr - The column or scalar expression to find the maximum of (must be in query scope).
 * @returns A `MaxFn` usable in `.select()`, `.orderBy()`, and `.where()`.
 *
 * @example
 * db.from(Orders).select({ latest: max(Orders.createdAt) });
 */
export function max<TExpr extends AggregateInput>(expr: TExpr): MaxFn<TExpr> {
  return new MaxFn(expr);
}
