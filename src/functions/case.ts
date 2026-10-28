import { isCol } from "../entity";
import {
  filterReferencedColumns,
  type GroupedFilterExpression,
} from "../filters";
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
  type HasAggregateOf,
  type HasArg,
  SqlFn,
} from "./index";
import {
  type NormalizedScalar,
  normalizeScalar,
  type ScalarArg,
  type ScalarQueryLike,
} from "./subquery";

/**
 * Valid operand for CASE branches and result clauses:
 * columns, SqlFns, raw Sql instances, prepared arguments, literals, objects, arrays, and null.
 */
export type CaseOperand =
  | AnyColumn
  | AnySqlFn
  | ScalarQueryLike
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

/** One `WHEN ... THEN ...` branch. */
export interface CaseWhenBranch<T = CaseOperand> {
  condition: GroupedFilterExpression<AnyColumn, boolean>;
  result: T;
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

/** Columns a `WHEN` condition reads. */
type ConditionColumns<TCondition> = TCondition extends {
  $: { Columns: infer C };
}
  ? C
  : never;

/**
 * PostgreSQL `CASE` expression. The extra parameters carry the branch, `ELSE`
 * and condition expressions so `HasAggregateOf` can inspect them.
 */
export class CaseFn<
  TColumn extends AnyColumn = AnyColumn,
  TResult = unknown,
  TBranchResult extends CaseOperand = CaseOperand,
  TElse extends CaseOperand | undefined = CaseOperand | undefined,
  TConditions = never,
  THasArg extends boolean = false,
> extends SqlFn<
  TColumn,
  "scalar",
  string,
  TResult,
  THasArg,
  HasAggregateOf<TBranchResult | TElse | TConditions>
> {
  constructor(
    readonly branches: readonly CaseWhenBranch<TBranchResult>[],
    readonly elseExpr: TElse,
  ) {
    super(
      SqlFn._hasAggregate(branches) || SqlFn._hasAggregate(elseExpr),
      SqlFn._hasWindow(branches) || SqlFn._hasWindow(elseExpr),
    );
  }

  /** Columns the branches, `ELSE` and `WHEN` conditions read; `[]` when unknown. */
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
      const conditionCols = filterReferencedColumns(b.condition);
      if (conditionCols === null) return [];
      cols.push(...conditionCols);
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
    let hasDate = false;
    let hasOther = false;
    for (const b of this.branches) {
      if (b.result === null || b.result === undefined) continue;
      if (b.result instanceof Date) hasDate = true;
      else hasOther = true;
    }
    if (this.elseExpr !== null && this.elseExpr !== undefined) {
      if (this.elseExpr instanceof Date) hasDate = true;
      else hasOther = true;
    }

    const appendOpts: AppendOperandOptions = {
      preferJsonb,
      preferJson,
      leadOperand,
      dateCastFallback: hasDate && !hasOther ? "timestamptz" : undefined,
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
  TBranches = never,
  TBranchResult extends CaseOperand = CaseOperand,
  TConditions = never,
  THasArg extends boolean = false,
> extends CaseFn<
  TColumn,
  TBranches | null,
  TBranchResult,
  undefined,
  TConditions,
  THasArg
> {
  constructor(branches: readonly CaseWhenBranch<TBranchResult>[]) {
    super(branches, undefined);
  }

  /**
   * Adds another `WHEN condition THEN result` branch to this CASE statement.
   *
   * @param condition - Boolean filter predicate.
   * @param thenResult - Value expression to evaluate when the condition is true.
   */
  when<
    TCondition extends GroupedFilterExpression<AnyColumn>,
    TRes extends CaseOperand,
  >(
    condition: TCondition,
    thenResult: ScalarArg<TRes>,
  ): CaseBuilder<
    | TColumn
    | ConditionColumns<TCondition>
    | ExprColumns<NormalizedScalar<TRes>>,
    TBranches | InferCaseValue<NormalizedScalar<TRes>>,
    TBranchResult | NormalizedScalar<TRes>,
    TConditions | TCondition,
    Or<Or<THasArg, HasArg<NormalizedScalar<TRes>>>, HasArg<TCondition>>
  > {
    const result = normalizeScalar(thenResult) as NormalizedScalar<TRes>;
    const branches: CaseWhenBranch<TBranchResult | NormalizedScalar<TRes>>[] = [
      ...this.branches,
      { condition, result },
    ];
    return new CaseBuilder(branches);
  }

  /**
   * Completes the CASE statement with an `ELSE elseResult END`.
   *
   * @param elseResult - Default value expression when no WHEN condition matches.
   */
  else<TElse extends CaseOperand>(
    elseResult: ScalarArg<TElse>,
  ): CaseFn<
    TColumn | ExprColumns<NormalizedScalar<TElse>>,
    TBranches | InferCaseValue<NormalizedScalar<TElse>>,
    TBranchResult,
    NormalizedScalar<TElse>,
    TConditions,
    Or<THasArg, HasArg<NormalizedScalar<TElse>>>
  > {
    return new CaseFn(
      this.branches,
      normalizeScalar(elseResult) as NormalizedScalar<TElse>,
    );
  }

  /**
   * Terminates the CASE statement without an explicit `ELSE`.
   * In PostgreSQL, when no WHEN condition matches and ELSE is omitted, NULL is returned.
   */
  end(): CaseFn<
    TColumn,
    TBranches | null,
    TBranchResult,
    undefined,
    TConditions,
    THasArg
  > {
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
export function caseWhen<
  TCondition extends GroupedFilterExpression<AnyColumn>,
  TRes extends CaseOperand,
>(
  condition: TCondition,
  thenResult: ScalarArg<TRes>,
): CaseBuilder<
  ConditionColumns<TCondition> | ExprColumns<NormalizedScalar<TRes>>,
  InferCaseValue<NormalizedScalar<TRes>>,
  NormalizedScalar<TRes>,
  TCondition,
  Or<HasArg<TCondition>, HasArg<NormalizedScalar<TRes>>>
> {
  return new CaseBuilder([
    {
      condition,
      result: normalizeScalar(thenResult) as NormalizedScalar<TRes>,
    },
  ]);
}
