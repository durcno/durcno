import { resolveFromDriver } from "../columns/common";
import type { AnyCteWithColumns } from "../cte";
import { is, isTCol } from "../entity";
import { SqlFn } from "../functions";
import type { AnyColumn, AnyTableWithColumns } from "../table";
import type { Key } from "../types";
import { getValuesRows, ValuesSource } from "../values";
import type { AnyQuery } from "./query";

/** Replaces any driver value with `null` — used for `null` projections. */
function toNull(): unknown {
  return null;
}

/** Converts a driver value to `bigint`, mapping NULL to `null`. */
function fromDriverBigInt(value: unknown): bigint | null {
  return value === null || value === undefined
    ? null
    : BigInt(value as string | number);
}

/** Converts a driver value to `boolean`, mapping NULL to `null`. */
function fromDriverBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  return value === true || value === "t" || value === "true";
}

/** Converts a driver value to `number`, mapping NULL to `null`. */
function fromDriverNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/**
 * Returns the driver-to-JS converter for a single projection item, or null
 * when the value passes through untouched (raw `Sql`, string literals).
 */
export function buildSelectItemConverter(
  item: unknown,
): ((value: unknown) => unknown) | null {
  if (item === null) return toNull;
  if (isTCol(item)) {
    const column = item as unknown as AnyColumn;
    // Not `resolveFromDriver` — keeping the closure local to this function
    // avoids polymorphism at the call site (~20% faster on mixed projections).
    return (value) => column.fromDriver(value);
  }
  if (item instanceof SqlFn) {
    return (value) => item.fromDriverValue(value);
  }
  const type = typeof item;
  if (type === "bigint") return fromDriverBigInt;
  if (type === "boolean") return fromDriverBoolean;
  if (type === "number") return fromDriverNumber;
  return null;
}

/**
 * Renders the `WITH cte1 AS (...), cte2 AS (...) ` prefix into `query.sql`.
 *
 * Emits nothing when `ctes` is empty. The closing `) ` goes out after the loop
 * so no iteration has to compute a last index, which leaves an empty list with
 * a `WITH` and no body — so the guard comes first and callers need not check.
 */
export function buildWithClause(
  ctes: readonly AnyCteWithColumns[],
  query: AnyQuery,
): void {
  if (ctes.length === 0) return;
  query.sql += "WITH ";
  for (let i = 0; i < ctes.length; i++) {
    if (i !== 0) query.sql += "), ";
    query.sql += `${ctes[i]._.fullName} AS (`;
    ctes[i].query.toQuery(query);
  }
  query.sql += ") ";
}

/**
 * Appends the `FROM ...` clause of an `UPDATE` statement to `query.sql`.
 * A values alias renders as `(VALUES ...) AS "name"("col", ...)`, every other
 * source (table or CTE) by its full name.
 */
export function buildUpdateFromClause(
  froms: readonly AnyTableWithColumns[],
  query: AnyQuery,
): void {
  for (let i = 0; i < froms.length; i++) {
    if (i !== 0) query.sql += ", ";
    const source = froms[i];
    if (is(source, ValuesSource)) {
      appendValuesSource(source, query);
    } else {
      query.sql += source._.fullName;
    }
  }
}

/**
 * Renders one values alias as `(VALUES ...) AS "name"("col", ...)`.
 *
 * Cell casts are hoisted out of the row loop. `undefined`/`null` cells render
 * `NULL`, cast with the column's SQL type so a NULL cell never falls back to
 * `text` in the VALUES list.
 */
function appendValuesSource(
  source: ValuesSource<string, Record<string, AnyColumn>>,
  query: AnyQuery,
): void {
  const rows = getValuesRows(source);
  if (rows === undefined || rows.length === 0) {
    throw new Error(`Values alias "${source._.name}" has no rows.`);
  }
  const columns = source._.columns as Record<string, AnyColumn>;
  const names: string[] = [];
  const cols: AnyColumn[] = [];
  const casts: string[] = [];
  for (const key in columns) {
    names.push(key);
    cols.push(columns[key]);
    casts.push(columns[key].sqlType);
  }

  query.sql += "(VALUES";
  for (let i = 0; i < rows.length; i++) {
    if (i !== 0) query.sql += ",\n";
    query.sql += " (";
    const row = rows[i];
    for (let j = 0; j < cols.length; j++) {
      if (j !== 0) query.sql += ", ";
      const value = row[names[j]];
      if (value === undefined || value === null) {
        query.sql += `NULL::${casts[j]}`;
      } else {
        query.sql += cols[j].toSQL(value as never, { cast: true });
      }
    }
    query.sql += ")";
  }
  query.sql += `) AS "${source._.nameSql}"(`;
  for (let j = 0; j < cols.length; j++) {
    if (j !== 0) query.sql += ", ";
    query.sql += `"${cols[j].nameSql}"`;
  }
  query.sql += ")";
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
 * Precomputed conversion plan for a `SELECT *` result set. Built once by
 * {@link buildStarRowsPlan}, applied per-row by {@link applyStarRowsPlan}.
 */
export type StarRowsPlan = {
  /** Writes one converted driver column into the output row. */
  readonly converts: readonly ((
    row: Record<string, unknown>,
    out: Record<string, unknown>,
  ) => void)[];
  /**
   * True when every driver key already equals its output key, so the driver row
   * can be converted in place instead of allocating a new object.
   */
  readonly inPlace: boolean;
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
  const converts: StarRowsPlan["converts"][number][] = [];
  let inPlace = true;
  for (const key of sqlKeys) {
    let column = table._.columnsBySql[key] ?? table._.columns[key];
    if (column === undefined && joins) {
      for (let j = joins.length - 1; j >= 0; j--) {
        const joinCols = joins[j].table._;
        const joinCol = joinCols.columnsBySql[key] ?? joinCols.columns[key];
        if (joinCol !== undefined) {
          column = joinCol;
          break;
        }
      }
    }
    if (column === undefined) {
      throw new Error(`Column ${key} not found in any table`);
    }
    const outKey = column.name as string;
    if (outKey !== key) inPlace = false;
    const fromDriver = resolveFromDriver(column);
    converts.push((row, out) => {
      out[outKey] = fromDriver(row[key]);
    });
  }
  return { converts, inPlace };
}

/**
 * Converts driver rows using a prebuilt plan. When no key needs renaming,
 * rows are converted in place; otherwise new objects are allocated.
 */
export function applyStarRowsPlan(
  rows: Record<string, unknown>[],
  plan: StarRowsPlan,
): Record<string, unknown>[] {
  const converts = plan.converts;
  if (plan.inPlace) {
    for (const row of rows) {
      for (const convert of converts) {
        convert(row, row);
      }
    }
    return rows;
  }
  const newRows: Record<string, unknown>[] = new Array(rows.length);
  let out = 0;
  for (const row of rows) {
    const newRow: Record<string, unknown> = {};
    for (const convert of converts) {
      convert(row, newRow);
    }
    newRows[out++] = newRow;
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
  const resolved: Record<string, AnyColumn> = {};
  for (const key in columns) {
    if (hasTrue ? ret[key] === true : ret[key] !== false) {
      resolved[key] = columns[key];
    }
  }
  return resolved as ReturningColumns<TColumns, TReturning>;
}

/**
 * Appends `RETURNING ...` to `query.sql`. Accepts `"*"`, inclusion, and
 * exclusion like `resolveReturningColumns`. `qualifier` renders qualified
 * columns for statements with FROM sources.
 */
export function buildReturningClause(
  columns: Record<string, AnyColumn>,
  returning: "*" | Record<string, boolean> | undefined,
  query: AnyQuery,
  qualifier?: string | null,
): void {
  if (!returning) return;
  if (returning === "*") {
    query.sql += qualifier ? ` RETURNING "${qualifier}".*` : " RETURNING *";
    return;
  }
  const hasTrue = Object.values(returning).some((v) => v === true);
  let opened = false;
  for (const key in columns) {
    const include = hasTrue
      ? returning[key] === true
      : returning[key] !== false;
    if (!include) continue;
    if (opened) {
      query.sql += ", ";
    } else {
      query.sql += " RETURNING ";
      opened = true;
    }
    const name = columns[key].nameSql;
    query.sql += qualifier ? `"${qualifier}"."${name}"` : `"${name}"`;
  }
}

/**
 * Returns the SQL for a column's generated default: a deferred placeholder
 * for prepared statements, or an inline literal otherwise.
 */
export function generatedValueSQL<TColumn extends AnyColumn>(
  query: AnyQuery,
  column: TColumn,
  getValue: () => TColumn["ValType"] | null,
  prepared: boolean,
): string {
  if (prepared) {
    return query.addDeferredArg(
      () => column.toDriver(getValue()),
      column.sqlCast,
    );
  }
  return column.toSQL(getValue(), { cast: true });
}
