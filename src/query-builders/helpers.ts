import { resolveFromDriver } from "../columns/common";
import type { AnyCteWithColumns } from "../cte";
import { is, isTCol } from "../entity";
import {
  type InferValueType,
  type NonAggregateSqlFn,
  SqlFn,
} from "../functions";
import { escIdentifier, Sql } from "../sql";
import type { AnyColumn, AnyTableWithColumns } from "../table";
import type { Key, RawRow, Valueof } from "../types";
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
 * Precomputed conversion of an explicit object projection. Which converter a
 * key needs depends only on the projection, never on the row, so the type
 * dispatch is resolved once and replayed per row.
 */
export type ProjectionRowsPlan = {
  keys: string[];
  converts: ((value: unknown) => unknown)[];
};

/** Builds the conversion plan of an explicit projection for the given keys. */
export function buildProjectionRowsPlan(
  projection: Record<string, unknown>,
  keys: readonly string[],
): ProjectionRowsPlan {
  const planKeys: string[] = [];
  const converts: ((value: unknown) => unknown)[] = [];
  for (const key of keys) {
    const convert = buildSelectItemConverter(projection[key]);
    if (convert === null) continue;
    planKeys.push(key);
    converts.push(convert);
  }
  return { keys: planKeys, converts };
}

/** Applies a prebuilt projection conversion plan in place. */
export function applyProjectionRowsPlan(
  rows: Record<string, unknown>[],
  plan: ProjectionRowsPlan,
): Record<string, unknown>[] {
  const keys = plan.keys;
  const converts = plan.converts;
  const width = keys.length;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let i = 0; i < width; i++) {
      row[keys[i]] = converts[i](row[keys[i]]);
    }
  }
  return rows;
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
 * A single aliased projection value in a `RETURNING` clause: a target-table
 * column, a non-aggregate scalar `SqlFn`, or a raw `Sql` expression.
 */
export type ReturningSelectItem<
  TColumns extends Record<string, AnyColumn>,
  TPrepare extends boolean = false,
> =
  | Valueof<TColumns>
  | NonAggregateSqlFn<
      Valueof<TColumns>,
      unknown,
      TPrepare extends true ? boolean : false
    >
  | Sql;

/** Aliased RETURNING projection: `{ alias: column | SqlFn | Sql }`. */
export type ReturningAliases<
  TColumns extends Record<string, AnyColumn>,
  TPrepare extends boolean = false,
> = Record<string, ReturningSelectItem<TColumns, TPrepare>>;

/** Keeps a value when it is a boolean flag, otherwise removes it. */
type BooleanFlag<T> = T extends boolean ? T : never;

/** Rejects non-boolean values in a `RETURNING` inclusion/exclusion map. */
export type ReturningFlags<T> = {
  [K in keyof T]: BooleanFlag<T[K]>;
};

/** Resolves the row type produced by a `RETURNING` clause. */
export type ReturningRow<
  TColumns extends Record<string, AnyColumn>,
  TReturning,
> = TReturning extends "*"
  ? {
      [ColName in keyof TColumns]: TColumns[ColName]["ValTypeSelect"];
    }
  : TReturning extends Record<Key, boolean>
    ? TReturning extends {
        [ColName in keyof TColumns]?: false;
      }
      ? {
          [ColName in keyof TColumns as TReturning[ColName] extends false
            ? never
            : ColName]: TColumns[ColName]["ValTypeSelect"];
        }
      : {
          [ColName in keyof TColumns as TReturning[ColName] extends true
            ? ColName
            : never]: TColumns[ColName]["ValTypeSelect"];
        }
    : TReturning extends Record<string, unknown>
      ? { [K in keyof TReturning]: InferValueType<TReturning[K]> }
      : Record<never, never>;

/** Resolves the array (or `null`) result type of a `RETURNING` clause. */
export type ReturningResult<
  TColumns extends Record<string, AnyColumn>,
  TReturning,
> = TReturning extends undefined ? null : ReturningRow<TColumns, TReturning>[];

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
    : TReturning extends Record<string, unknown>
      ? TReturning
      : Record<never, never>;

/**
 * True when a `RETURNING` map holds aliased expressions rather than boolean
 * inclusion/exclusion flags.
 *
 * @throws If the map mixes flags with expressions.
 */
export function isAliasedReturning(
  returning: Record<string, unknown>,
): boolean {
  let hasAlias = false;
  let hasFlag = false;
  for (const key in returning) {
    if (typeof returning[key] === "boolean") {
      hasFlag = true;
    } else {
      hasAlias = true;
    }
  }
  if (hasFlag && hasAlias) {
    throw new Error(
      "RETURNING cannot mix boolean column flags with aliased expressions.",
    );
  }
  return hasAlias;
}

/** Per-query cache of the conversion plan for an aliased `RETURNING` projection. */
export type ReturningRowsCache = {
  plan: ProjectionRowsPlan | null;
};

/**
 * Converts driver rows for an aliased `RETURNING` projection, building the
 * plan once and reusing it across executions. Returns `null` when the
 * projection is not aliased, so the caller falls back to `mapStarRows`.
 */
export function applyAliasedReturningRows(
  rows: RawRow[],
  returning: unknown,
  cache: ReturningRowsCache,
): RawRow[] | null {
  if (!returning || returning === "*") return null;
  const projection = returning as Record<string, unknown>;
  if (!isAliasedReturning(projection)) return null;
  if (rows.length === 0) return [];
  cache.plan ??= buildProjectionRowsPlan(projection, Object.keys(projection));
  return applyProjectionRowsPlan(rows, cache.plan);
}

/**
 * Validates aliased `RETURNING` expressions against the target table.
 *
 * @throws If an alias is empty, references another table, is an aggregate or
 *   window expression, or is not a column, scalar `SqlFn`, or raw `Sql`.
 */
function assertReturningAliases(
  table: AnyTableWithColumns,
  returning: Record<string, unknown>,
): void {
  for (const alias in returning) {
    if (alias.length === 0) {
      throw new Error("RETURNING alias names must be non-empty.");
    }
    const expr = returning[alias];
    if (isTCol(expr)) {
      const exprTable = (
        expr as unknown as {
          table?: { _: { schema: string; name: string } };
        }
      ).table;
      if (
        exprTable &&
        (exprTable._.schema !== table._.schema ||
          exprTable._.name !== table._.name)
      ) {
        throw new Error(
          `RETURNING alias "${alias}" references a column from another table. Only columns of the returned table are allowed.`,
        );
      }
      continue;
    }
    if (expr instanceof SqlFn) {
      if (expr._.hasAggregate || expr._.hasWindow) {
        throw new Error(
          `RETURNING alias "${alias}" cannot use an aggregate or window expression.`,
        );
      }
      continue;
    }
    if (expr instanceof Sql) {
      continue;
    }
    throw new Error(
      `RETURNING alias "${alias}" must be a table column, scalar SqlFn, or raw Sql.`,
    );
  }
}

/** Validates an aliased `RETURNING` map, if the map uses aliases. */
export function validateReturning(
  table: AnyTableWithColumns,
  returning: "*" | Record<string, unknown> | undefined,
): void {
  if (!returning || returning === "*") return;
  if (isAliasedReturning(returning)) {
    assertReturningAliases(table, returning);
  }
}

/**
 * Resolves the output columns for a RETURNING clause.
 * - No returning → empty record
 * - `"*"` → all table columns
 * - Partial object → filter by `true`/`false` flags
 * - Aliased object → the alias-to-expression map
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
  const ret = returning as Record<string, unknown>;
  if (isAliasedReturning(ret)) {
    return ret as ReturningColumns<TColumns, TReturning>;
  }
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
 * Appends `RETURNING ...` to `query.sql`. Accepts `"*"`, inclusion, exclusion,
 * and aliased expressions. `qualifier` renders qualified columns for statements
 * with FROM sources.
 */
export function buildReturningClause(
  columns: Record<string, AnyColumn>,
  returning: "*" | Record<string, unknown> | undefined,
  query: AnyQuery,
  qualifier?: string | null,
): void {
  if (!returning) return;
  if (returning === "*") {
    query.sql += qualifier ? ` RETURNING "${qualifier}".*` : " RETURNING *";
    return;
  }
  if (isAliasedReturning(returning)) {
    let opened = false;
    for (const alias in returning) {
      if (opened) {
        query.sql += ", ";
      } else {
        query.sql += " RETURNING ";
        opened = true;
      }
      const expr = returning[alias];
      if (isTCol(expr)) {
        const name = (expr as unknown as AnyColumn).nameSql;
        query.sql += qualifier ? `"${qualifier}"."${name}"` : `"${name}"`;
      } else if (expr instanceof SqlFn) {
        expr.toQuery(query);
      } else if (expr instanceof Sql) {
        expr.toQuery(query);
      } else {
        throw new Error(
          `RETURNING alias "${alias}" must be a table column, scalar SqlFn, or raw Sql.`,
        );
      }
      query.sql += ` AS "${escIdentifier(alias)}"`;
    }
    return;
  }
  const hasTrue = Object.values(returning).some((value) => value === true);
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
