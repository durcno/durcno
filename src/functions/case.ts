import { isCol } from "../entity";
import type { AnyFilterExpression, FilterExpression } from "../filters";
import type { AnyArg, Arg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import { type Sql, toSqlValue } from "../sql";
import type { AnyColumn } from "../table";
import type { Or } from "../types";
import {
  type AnySqlFn,
  type AppendOperandOptions,
  appendOperand,
  detectJsonKind,
  type ExprColumns,
  type HasArg,
  SqlFn,
} from "./index";

/**
 * Valid operand for CASE branches and result clauses:
 * columns, SqlFns, raw Sql instances, prepared arguments, literals, objects, arrays, and null.
 */
export type CaseOperand =
  | AnyColumn
  | AnySqlFn
  | Sql
  | AnyArg
  | string
  | number
  | bigint
  | boolean
  | Date
  | readonly unknown[]
  | Record<string, unknown>
  | null;

/** Single WHEN condition THEN result branch. */
export interface CaseWhenBranch {
  condition: AnyFilterExpression;
  result: CaseOperand;
}

/**
 * Resolves the TypeScript type for a CASE branch operand without widening literal types.
 *
 * - `null` -> `null`
 * - Column with `ValTypeSelect` -> `TCol["ValTypeSelect"]`
 * - `SqlFn` -> `TSqlFn["$"]["TsType"]`
 * - `Sql<S>` -> `S`
 * - `Arg<A>` -> `A`
 * - Literals and primitives -> preserved as their exact types (e.g. `"admin"` -> `"admin"`, `10` -> `10`)
 */
export type InferCaseValue<TExpr> = TExpr extends null
  ? null
  : TExpr extends { ValTypeSelect: infer V }
    ? V
    : TExpr extends { $: { kind: "sqlFn"; TsType: infer T } }
      ? T
      : TExpr extends Sql<infer S>
        ? S
        : TExpr extends Arg<infer A>
          ? A
          : TExpr;

/**
 * PostgreSQL `CASE` SQL function expression.
 * Evaluates conditions in order and returns the matching branch result.
 */
export class CaseFn<
  TColumn extends AnyColumn = AnyColumn,
  THasArg extends boolean = false,
  TResult = unknown,
> extends SqlFn<TColumn, THasArg, "aggregate" | "scalar", string, TResult> {
  override readonly isAggregate: boolean;

  constructor(
    readonly branches: readonly CaseWhenBranch[],
    readonly elseExpr: CaseOperand | undefined,
  ) {
    super();
    const hasAggBranch = branches.some(
      (b) =>
        (b.result instanceof SqlFn && b.result.isAggregate) ||
        (b.condition instanceof SqlFn && b.condition.isAggregate),
    );
    const hasAggElse = elseExpr instanceof SqlFn && elseExpr.isAggregate;
    this.isAggregate = hasAggBranch || hasAggElse;
  }

  /**
   * Returns all table columns directly referenced by this CASE expression.
   * Used by SelectQuery auto-GROUP BY to avoid grouping by unhashable expressions.
   */
  get referencedColumns(): AnyColumn[] {
    const cols: AnyColumn[] = [];
    for (const b of this.branches) {
      if (isCol(b.result)) {
        cols.push(b.result);
      } else if (
        b.result instanceof SqlFn &&
        "referencedColumns" in b.result &&
        Array.isArray(b.result.referencedColumns)
      ) {
        cols.push(...b.result.referencedColumns);
      }
    }
    if (isCol(this.elseExpr)) {
      cols.push(this.elseExpr);
    } else if (
      this.elseExpr instanceof SqlFn &&
      "referencedColumns" in this.elseExpr &&
      Array.isArray(this.elseExpr.referencedColumns)
    ) {
      cols.push(...this.elseExpr.referencedColumns);
    }
    return cols;
  }

  toDriverValue(value: TResult | null): unknown {
    return value;
  }

  toSQLValue(value: TResult | null): string {
    return toSqlValue(value as never);
  }

  fromDriverValue(value: unknown): TResult | null {
    if (value === null || value === undefined) return null;

    // 1. Delegate to the first typed column or SqlFn among branch/else expressions
    for (const b of this.branches) {
      if (isCol(b.result)) return b.result.fromDriverScalar(value) as TResult;
      if (b.result instanceof SqlFn)
        return b.result.fromDriverValue(value) as TResult;
    }
    if (this.elseExpr !== undefined) {
      if (isCol(this.elseExpr))
        return this.elseExpr.fromDriverScalar(value) as TResult;
      if (this.elseExpr instanceof SqlFn)
        return this.elseExpr.fromDriverValue(value) as TResult;
    }

    // 2. Otherwise determine target conversion from the first non-null literal/primitive operand
    const sample =
      this.branches.find((b) => b.result !== null)?.result ?? this.elseExpr;
    if (sample === null || sample === undefined) return value as TResult;

    if (typeof sample === "bigint") {
      if (typeof value === "bigint") return value as TResult;
      if (typeof value === "number") return BigInt(value) as TResult;
      if (typeof value === "string" && /^-?\d+$/.test(value)) {
        return BigInt(value) as TResult;
      }
      return value as TResult;
    }
    if (typeof sample === "number") {
      if (typeof value === "number") return value as TResult;
      const num = Number(value);
      return (Number.isNaN(num) ? value : num) as TResult;
    }
    if (typeof sample === "boolean") {
      if (typeof value === "boolean") return value as TResult;
      if (value === "t" || value === "true") return true as TResult;
      if (value === "f" || value === "false") return false as TResult;
      return Boolean(value) as TResult;
    }
    if (sample instanceof Date) {
      return (
        value instanceof Date ? value : new Date(value as string | number)
      ) as TResult;
    }
    if (Array.isArray(sample) || typeof sample === "object") {
      if (typeof value === "string") {
        try {
          return JSON.parse(value);
        } catch {
          return value as TResult;
        }
      }
      return value as TResult;
    }
    return value as TResult;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    const leadOperand =
      this.branches.find((b) => b.result !== null && b.result !== undefined)
        ?.result ?? this.elseExpr;
    const preferJsonb =
      this.branches.some((b) => detectJsonKind(b.result) === "jsonb") ||
      detectJsonKind(this.elseExpr) === "jsonb";
    const preferJson =
      !preferJsonb &&
      (this.branches.some((b) => detectJsonKind(b.result) === "json") ||
        detectJsonKind(this.elseExpr) === "json");

    const appendOpts: AppendOperandOptions = {
      preferJsonb,
      preferJson,
      leadOperand,
    };

    query.sql += "CASE";
    for (const b of this.branches) {
      query.sql += " WHEN ";
      b.condition.toQuery(query, ctx);
      query.sql += " THEN ";
      appendOperand(query, b.result, ctx, appendOpts);
    }
    if (this.elseExpr !== undefined) {
      query.sql += " ELSE ";
      appendOperand(query, this.elseExpr, ctx, appendOpts);
    }
    query.sql += " END";
  }
}

/**
 * Fluent builder for PostgreSQL `CASE` expressions.
 * Also acts as an executable `CaseFn` that evaluates to `TBranches | null` if `.else()` is omitted.
 */
export class CaseBuilder<
  TColumn extends AnyColumn = never,
  THasArg extends boolean = false,
  TBranches = never,
> extends CaseFn<TColumn, THasArg, TBranches | null> {
  constructor(branches: readonly CaseWhenBranch[]) {
    super(branches, undefined);
  }

  /**
   * Adds another `WHEN condition THEN result` branch to this CASE statement.
   *
   * @param condition - Boolean filter predicate.
   * @param thenResult - Value expression to evaluate when the condition is true.
   */
  when<TCondCol extends AnyColumn, TRes extends CaseOperand>(
    condition: FilterExpression<TCondCol>,
    thenResult: TRes,
  ): CaseBuilder<
    TColumn | TCondCol | ExprColumns<TRes>,
    Or<Or<THasArg, HasArg<TRes>>, HasArg<TCondCol>>,
    TBranches | InferCaseValue<TRes>
  > {
    return new CaseBuilder([
      ...this.branches,
      { condition, result: thenResult },
    ]);
  }

  /**
   * Completes the CASE statement with an `ELSE elseResult END`.
   *
   * @param elseResult - Default value expression when no WHEN condition matches.
   */
  else<TElse extends CaseOperand>(
    elseResult: TElse,
  ): CaseFn<
    TColumn | ExprColumns<TElse>,
    Or<THasArg, HasArg<TElse>>,
    TBranches | InferCaseValue<TElse>
  > {
    return new CaseFn(this.branches, elseResult);
  }

  /**
   * Terminates the CASE statement without an explicit `ELSE`.
   * In PostgreSQL, when no WHEN condition matches and ELSE is omitted, NULL is returned.
   */
  end(): CaseFn<TColumn, THasArg, TBranches | null> {
    return new CaseFn(this.branches, undefined);
  }
}

/**
 * Creates a PostgreSQL `CASE` expression starting with `WHEN condition THEN result`.
 *
 * Can be selected directly (returning `InferCaseValue<TRes> | null`), or chained
 * with further `.when(...)`, `.else(...)`, or `.end()`.
 *
 * @example
 * // Direct with implicit ELSE NULL:
 * badge: caseWhen(eq(users.type, "admin"), "Admin") // "Admin" | null
 *
 * // Nullable 1-to-1 relation in left join:
 * author: caseWhen(isNull(users.id), null)
 *   .else(jsonBuildObject({ id: users.id, name: users.name }))
 *
 * // Union of all branch results:
 * status: caseWhen(eq(orders.status, "paid"), "Complete")
 *   .when(eq(orders.status, "pending"), "In Progress")
 *   .else("Unknown") // "Complete" | "In Progress" | "Unknown"
 */
export function caseWhen<TCondCol extends AnyColumn, TRes extends CaseOperand>(
  condition: FilterExpression<TCondCol>,
  thenResult: TRes,
): CaseBuilder<
  TCondCol | ExprColumns<TRes>,
  Or<HasArg<TCondCol>, HasArg<TRes>>,
  InferCaseValue<TRes>
> {
  return new CaseBuilder([{ condition, result: thenResult }]);
}
