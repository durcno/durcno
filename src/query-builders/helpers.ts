import type { AnyCteWithColumns } from "../cte";
import type { AnyColumn } from "../table";
import type { ReturningColumns } from "../virtual-table";
import type { AnyQuery } from "./query";

/**
 * Renders the `WITH cte1 AS (...), cte2 AS (...) ` prefix into `query.sql`.
 * Call only when `ctes` is non-empty.
 */
export function buildWithClause(
  ctes: readonly AnyCteWithColumns[],
  query: AnyQuery,
): void {
  query.sql += "WITH ";
  ctes.forEach((cte, i) => {
    query.sql += `${cte._.fullName} AS (`;
    cte.query.toQuery(query);
    query.sql += i < ctes.length - 1 ? "), " : ") ";
  });
}

/**
 * Resolves the output columns for a RETURNING clause.
 * - No returning → empty record
 * - `"*"` → all table columns
 * - Partial object → filter by `true`/`false` flags
 */
export function resolveReturningColumns<
  TColumns extends Record<string, AnyColumn>,
  TReturning,
>(
  columns: TColumns,
  returning: TReturning,
): ReturningColumns<TColumns, TReturning> {
  if (!returning) {
    return {} as ReturningColumns<TColumns, TReturning>;
  }
  if (returning === "*") {
    return columns as ReturningColumns<TColumns, TReturning>;
  }
  const ret = returning as Record<string, boolean>;
  const hasTrue = Object.values(ret).some((value) => value === true);
  return Object.fromEntries(
    Object.entries(columns).filter(([key]) =>
      hasTrue ? ret[key] === true : ret[key] !== false,
    ),
  ) as ReturningColumns<TColumns, TReturning>;
}
