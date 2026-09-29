import type { AnyCteWithColumns } from "../cte";
import type { AnyColumn } from "../table";
import type { Key } from "../types";
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
  for (let i = 0; i < ctes.length; i++) {
    const cte = ctes[i];
    query.sql += `${cte._.fullName} AS (`;
    cte.query.toQuery(query);
    query.sql += i < ctes.length - 1 ? "), " : ") ";
  }
}

/**
 * View of select aliases passed to query clause callbacks (e.g. orderBy, groupBy).
 * Maps each select alias key to its string literal name.
 */
export type SelectAliasesView<TSelects> =
  TSelects extends Record<string, unknown>
    ? { readonly [K in keyof TSelects]: Extract<K, string> }
    : Record<never, never>;

/**
 * Minimal structural view of a table, enough to resolve the columns of a
 * `SELECT *` result set by driver key.
 */
type StarSource = {
  _: {
    columns: Record<string, AnyColumn>;
    columnsBySql: Record<string, AnyColumn>;
  };
};

/**
 * Precomputed column resolution for a `SELECT *` result set.
 * A driver key always maps to the same column for every row, so the lookup is
 * done once by {@link buildStarRowsPlan} and replayed per row by
 * {@link applyStarRowsPlan}.
 */
export type StarRowsPlan = {
  /** Driver (SQL) key of each projected column, in order. */
  sqlKeys: string[];
  /** camelCase output key of each projected column, in order. */
  outKeys: string[];
  /** Column converting each value, in order. */
  columns: AnyColumn[];
};

/**
 * Resolves every key of a `SELECT *` result set to its column, falling back to
 * the joined tables. The last matching join wins, mirroring the SQL projection
 * order of overlapping column names.
 *
 * @param table - The primary table.
 * @param joins - Joined tables to fall back to, or null.
 * @param sqlKeys - Driver keys to resolve, e.g. `Object.keys(rows[0])`.
 * @throws If a key belongs to none of the tables.
 */
export function buildStarRowsPlan(
  table: StarSource,
  joins: readonly { table: StarSource }[] | null | undefined,
  sqlKeys: readonly string[],
): StarRowsPlan {
  const outKeys: string[] = [];
  const columns: AnyColumn[] = [];
  for (let i = 0; i < sqlKeys.length; i++) {
    const key = sqlKeys[i];
    let column = table._.columnsBySql[key] ?? table._.columns[key];
    if (column === undefined && joins) {
      for (let j = 0; j < joins.length; j++) {
        const joinCols = joins[j].table._;
        const joinCol = joinCols.columnsBySql[key] ?? joinCols.columns[key];
        if (joinCol !== undefined) {
          column = joinCol;
        }
      }
    }
    if (column === undefined) {
      throw new Error(`Column ${key} not found in any table`);
    }
    outKeys.push(column.name as string);
    columns.push(column);
  }
  return { sqlKeys: sqlKeys.slice(), outKeys, columns };
}

/**
 * Converts driver rows to camelCase objects using a prebuilt plan.
 * Always returns a new array of new objects; the input rows are left untouched.
 */
export function applyStarRowsPlan(
  rows: Record<string, unknown>[],
  plan: StarRowsPlan,
): Record<string, unknown>[] {
  const sqlKeys = plan.sqlKeys;
  const outKeys = plan.outKeys;
  const columns = plan.columns;
  const width = sqlKeys.length;
  const newRows: Record<string, unknown>[] = new Array(rows.length);
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const newRow: Record<string, unknown> = {};
    for (let i = 0; i < width; i++) {
      newRow[outKeys[i]] = columns[i].fromDriver(row[sqlKeys[i]]);
    }
    newRows[r] = newRow;
  }
  return newRows;
}

/**
 * Converts `SELECT *`-shaped driver rows to camelCase objects, resolving the
 * column of every driver key once for the whole result set.
 *
 * @param rows - Driver rows; empty input yields an empty array.
 * @param table - The primary table.
 * @param joins - Joined tables to fall back to, or null.
 */
export function mapStarRows(
  rows: Record<string, unknown>[],
  table: StarSource,
  joins?: readonly { table: StarSource }[] | null,
): Record<string, unknown>[] {
  if (rows.length === 0) return [];
  return applyStarRowsPlan(
    rows,
    buildStarRowsPlan(table, joins, Object.keys(rows[0])),
  );
}

/**
 * Resolves the resulting column map type for a `RETURNING` clause.
 */
export type ReturningColumns<
  TColumns extends Record<string, AnyColumn>,
  TReturning,
> = TReturning extends "*"
  ? TColumns
  : TReturning extends Record<Key, boolean>
    ? true extends TReturning[keyof TReturning]
      ? {
          [K in keyof TColumns as K extends keyof TReturning
            ? TReturning[K] extends true
              ? K
              : never
            : never]: TColumns[K];
        }
      : {
          [K in keyof TColumns as K extends keyof TReturning
            ? TReturning[K] extends false
              ? never
              : K
            : K]: TColumns[K];
        }
    : Record<never, never>;

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

/**
 * Appends the `RETURNING ...` SQL clause to `query.sql`.
 * Handles `"*"`, inclusion (`{col: true}`), and exclusion (`{col: false}`)
 * patterns, consistent with `resolveReturningColumns`.
 */
export function buildReturningClause(
  columns: Record<string, AnyColumn>,
  returning: "*" | Record<string, boolean> | undefined,
  query: AnyQuery,
): void {
  if (!returning) return;
  if (returning === "*") {
    query.sql += " RETURNING *";
    return;
  }
  const hasTrue = Object.values(returning).some((v) => v === true);
  const returningFields = Object.keys(columns).filter((key) =>
    hasTrue ? returning[key] === true : returning[key] !== false,
  );
  if (returningFields.length === 0) return;
  query.sql += " RETURNING ";
  query.sql += returningFields
    .map((field) => `"${columns[field].nameSql}"`)
    .join(", ");
}
