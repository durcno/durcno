import type { AnyScalarSqlFn } from "../functions";
import { SqlFn } from "../functions";
import type {
  AnyColumn,
  AnyTableWithColumns,
  StdTableWithColumns,
  TableWithColumns,
} from "../table";
import type { Valueof } from "../types";
import type { AnySelectableSource } from "../virtual-table";
import type { Query } from "./query";

/**
 * Represents a GROUP BY reference to a named select alias (e.g. `"sal"`).
 * PostgreSQL allows GROUP BY to reference output column aliases.
 */
export class GroupByAlias<TKey extends string> {
  constructor(readonly key: TKey) {}

  /** Appends `"key"` (quoted alias) to the query SQL. */
  toQuery(query: Query): void {
    query.sql += `"${this.key}"`;
  }
}

export type StdGroupByAlias = GroupByAlias<string>;

/**
 * A view of the select map passed to the `.groupBy()` callback.
 * Each key maps to a `GroupByAlias` that renders the alias name in SQL.
 */
export type GroupBySelectView<
  TSelects extends Record<string, AnySelectableSource>,
> = {
  readonly [K in keyof TSelects]: GroupByAlias<Extract<K, string>>;
};

/**
 * Valid group-by item for a query on `TTableWC`.
 * Accepts a direct table column, a scalar `SqlFn`, or a `GroupByAlias` from the select map.
 *
 * Note: Aggregate `SqlFn` are intentionally excluded — PostgreSQL does not permit
 * aggregate expressions in GROUP BY. Use scalar expressions or column references instead.
 */
export type GroupByExpression<
  TTableWC extends AnyTableWithColumns,
  TPrepare extends boolean = false,
  TSelects extends Record<string, AnySelectableSource> | undefined = undefined,
> =
  | Valueof<TTableWC["_"]["columns"]>
  | SqlFn<
      Valueof<TTableWC["_"]["columns"]>,
      TPrepare extends true ? boolean : false,
      "scalar"
    >
  | (TSelects extends Record<string, AnySelectableSource>
      ? GroupByAlias<Extract<keyof TSelects, string>>
      : never);

export type StdGroupByExpression = GroupByExpression<
  StdTableWithColumns,
  boolean,
  Record<string, AnySelectableSource>
>;

export type AnyGroupByExpression = GroupByExpression<
  TableWithColumns<string, string, Record<string, AnyColumn>>,
  boolean,
  Record<string, AnySelectableSource>
>;

/**
 * Creates the view object passed to the `.groupBy()` callback.
 * Maps each key of `selects` to a `GroupByAlias` that renders as `"key"` in SQL.
 */
export function createGroupBySelectView<
  TSelects extends Record<string, AnySelectableSource>,
>(selects: TSelects): GroupBySelectView<TSelects> {
  return Object.fromEntries(
    Object.keys(selects).map((k) => [k, new GroupByAlias(k)]),
  ) as GroupBySelectView<TSelects>;
}

/**
 * Type guard: returns `true` if `value` is a `GroupByAlias`.
 */
export function isGroupByAlias(value: unknown): value is StdGroupByAlias {
  return value instanceof GroupByAlias;
}

/**
 * Type guard: returns `true` if `value` is a scalar `SqlFn`.
 * Used inside `toQuery()` to distinguish scalar expressions from raw columns.
 */
export function isScalarSqlFn(value: unknown): value is AnyScalarSqlFn {
  return value instanceof SqlFn;
}
