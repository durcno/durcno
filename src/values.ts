import { entityType } from "./symbols";
import { type AnyColumn, Table } from "./table";
import type { Key } from "./types";
import { VirtualColumn, type VirtualizedColumn } from "./virtual-table";

/**
 * Maps the declared columns of a values alias to accessors bound to it, so
 * `V.colName` renders `"alias"."colName"` while keeping the source type.
 */
export type ValuesColumns<
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> = {
  [K in keyof TColumns]: VirtualizedColumn<TName, K & Key, TColumns[K]>;
};

/**
 * The cell type of a values row: required when the source column is
 * non-nullable, `null | undefined` otherwise (`undefined` renders `NULL`).
 */
export type ValuesRowCell<TColumn extends AnyColumn> = TColumn extends
  | { isNotNull: true }
  | { isPrimaryKey: true }
  ? TColumn["ValType"]
  : TColumn["ValType"] | null | undefined;

/** One row payload of a values alias, keyed by the declared column names. */
export type ValuesRow<TColumns extends Record<string, AnyColumn>> = {
  [K in keyof TColumns]: ValuesRowCell<TColumns[K]>;
};

/** Row payloads accepted by a values alias's `.as()`. */
export type ValuesRows<TColumns extends Record<string, AnyColumn>> =
  readonly ValuesRow<TColumns>[];

/**
 * Payloads live off the instance so a column may be named `rows` without
 * shadowing builder state.
 */
const rowsBySource = new WeakMap<object, readonly Record<string, unknown>[]>();

/** Returns the rows bound to a values alias. @internal */
export function getValuesRows(
  source: object,
): readonly Record<string, unknown>[] | undefined {
  return rowsBySource.get(source);
}

/**
 * A typed alias for an inline `(VALUES ...)` list, usable as an `UPDATE ... FROM`
 * source. Columns wrap their declared source columns, so values keep the
 * source column's SQL type and encoding while qualifying under the alias name.
 */
export class ValuesSource<
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> extends Table<"", TName, TColumns> {
  static readonly [entityType] = "ValuesSource";
  declare readonly $isVirtual: true;
  constructor(
    name: TName,
    columns: Record<string, AnyColumn>,
    rows: readonly Record<string, unknown>[],
  ) {
    super("", name, wrapValuesColumns(name, columns) as TColumns, {});
    rowsBySource.set(this, rows);
    const source = this;
    for (const colName in this._.columns) {
      Object.defineProperty(source, colName, {
        get() {
          return source._.columns[colName];
        },
      });
    }
  }
}

function wrapValuesColumns(
  name: string,
  sources: Record<string, AnyColumn>,
): Record<string, AnyColumn> {
  for (const key in sources) {
    // `_` holds the table config; a column accessor would shadow and recurse.
    if (key === "_") {
      throw new Error(
        `Values alias "${name}" cannot declare a column named "_"; the name is reserved by the alias API.`,
      );
    }
  }
  return Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [
      key,
      new VirtualColumn(source),
    ]),
  );
}

/** A values alias widened for use as a constraint; invariant in its columns. */
// biome-ignore lint/suspicious/noExplicitAny: ValuesSource is invariant in its columns
export type AnyValuesWithColumns = ValuesSource<any, any>;

export type ValuesWithColumns<
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> = ValuesSource<TName, TColumns> & TColumns;
