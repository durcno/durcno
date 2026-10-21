import type { NonAggregateSqlFn } from "../functions";
import type {
  AnyColumn,
  AnyTableWithColumns,
  StdTableWithColumns,
  TableAnyColumn,
  TableWithColumns,
} from "../table";
import type { Valueof } from "../types";

/**
 * Valid `GROUP BY` item: a column, a non-aggregate `SqlFn`, or a select alias.
 * PostgreSQL refuses an aggregate here, however deeply wrapped.
 */
export type GroupByExpression<
  TTableOrCols extends AnyTableWithColumns | TableAnyColumn,
  TPrepare extends boolean = false,
  TSelects extends Record<string, unknown> | undefined = undefined,
> =
  | (TTableOrCols extends AnyTableWithColumns
      ? Valueof<TTableOrCols["_"]["columns"]>
      : TTableOrCols)
  | NonAggregateSqlFn<
      TTableOrCols extends AnyTableWithColumns
        ? Valueof<TTableOrCols["_"]["columns"]>
        : TTableOrCols,
      unknown,
      TPrepare extends true ? boolean : false
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
