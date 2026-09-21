import type { AnyScalarSqlFn } from "../functions";
import { SqlFn } from "../functions";
import type {
  AnyColumn,
  AnyTableWithColumns,
  StdTableWithColumns,
  TableAnyColumn,
  TableWithColumns,
} from "../table";
import type { Valueof } from "../types";

/**
 * Valid group-by item for a query on `TTableWC`.
 * Accepts a direct table column, a scalar `SqlFn`, or a select alias name.
 *
 * Note: Aggregate `SqlFn` are intentionally excluded — PostgreSQL does not permit
 * aggregate expressions in GROUP BY. Use scalar expressions or column references instead.
 */
export type GroupByExpression<
  TTableOrCols extends AnyTableWithColumns | TableAnyColumn,
  TPrepare extends boolean = false,
  TSelects extends Record<string, unknown> | undefined = undefined,
> =
  | (TTableOrCols extends AnyTableWithColumns
      ? Valueof<TTableOrCols["_"]["columns"]>
      : TTableOrCols)
  | SqlFn<
      TTableOrCols extends AnyTableWithColumns
        ? Valueof<TTableOrCols["_"]["columns"]>
        : TTableOrCols,
      TPrepare extends true ? boolean : false,
      "scalar"
    >
  | Extract<keyof TSelects, string>;

export type StdGroupByExpression = GroupByExpression<
  StdTableWithColumns,
  boolean,
  Record<string, unknown>
>;

export type AnyGroupByExpression = GroupByExpression<
  TableWithColumns<string, string, Record<string, AnyColumn>>,
  boolean,
  Record<string, unknown>
>;

/**
 * Type guard: returns `true` if `value` is a scalar `SqlFn`.
 * Used inside `toQuery()` to distinguish scalar expressions from raw columns.
 */
export function isScalarSqlFn(value: unknown): value is AnyScalarSqlFn {
  return value instanceof SqlFn;
}
