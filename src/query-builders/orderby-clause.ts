import { isTCol } from "../entity";
import type { AnyScalarSqlFn, SqlFn } from "../functions";
import type { AnyTableWC, AnyTableWithColumns, TableAnyColumn } from "../table";
import type { Valueof } from "../types";
import type { Query } from "./query";

class Order<
  TTableColumn extends TableAnyColumn | string,
  TOrder extends "ASC" | "DESC",
> {
  readonly field: TTableColumn;
  readonly dir: TOrder;
  constructor(field: TTableColumn, dir: TOrder) {
    this.field = field;
    this.dir = dir;
  }

  /** Appends the order fragment to the query SQL. */
  toQuery(query: Query) {
    if (typeof this.field === "string") {
      query.sql += `"${this.field}" ${this.dir}`;
    } else {
      query.sql += `${this.field.fullName} ${this.dir}`;
    }
  }
}

/**
 * Order clause built from a `SqlFn` value expression (e.g. `ST_Distance(...)`).
 * Used via `asc(sqlFn)` or `desc(sqlFn)`.
 *
 * @template TSqlFn - The table column(s) the underlying expression references.
 * @template THasArg - `true` when the underlying expression embeds an `Arg` placeholder.
 */
export class OrderSqlFn<TSqlFn extends AnyScalarSqlFn> {
  /** Phantom field: the column(s) this order expression references — mirrors `Filter.$Columns`. */
  readonly $Columns!: TSqlFn["$Columns"];
  /** Phantom field: `true` when this order expression embeds an `Arg` placeholder. */
  readonly $HasArg!: TSqlFn["$HasArg"];

  constructor(
    private readonly fn: TSqlFn,
    private readonly dir: "ASC" | "DESC",
  ) {}

  /** Appends the order fragment (expression + direction) to the query SQL. */
  toQuery(query: Query) {
    this.fn.toQuery(query);
    query.sql += ` ${this.dir}`;
  }
}

export type { Order };

/**
 * Valid orderBy item for a query on `TTableWC`.
 *
 * @template TTableWC - The table being queried.
 * @template TPrepare - When `true`, `OrderSqlFn` items carrying `Arg` placeholders are allowed.
 *   Defaults to `false` (non-prepared context).
 */
export type OrderBy<
  TTableWC extends AnyTableWithColumns,
  TSelects extends Record<string, any> | undefined,
  TPrepare extends boolean = false,
> =
  | Order<Valueof<TTableWC["_"]["columns"]>, "ASC" | "DESC">
  | Order<Extract<keyof TSelects, string>, "ASC" | "DESC">
  | OrderSqlFn<SqlFn<Valueof<TTableWC["_"]["columns"]>, TPrepare, "scalar">>;

/**
 * Creates an ascending order clause for a column or a `SqlFn` expression.
 *
 * @example
 * db.from(Users).select().orderBy(asc(Users.createdAt))
 * db.from(Properties).select().orderBy(asc(stDistance(Properties.location, point)))
 */
export function asc<TTableColumn extends TableAnyColumn | string>(
  field: TTableColumn,
): Order<TTableColumn, "ASC">;
export function asc<TSqlFn extends AnyScalarSqlFn>(
  fn: TSqlFn,
): OrderSqlFn<TSqlFn>;
export function asc(fieldOrFn: TableAnyColumn | AnyScalarSqlFn) {
  if (typeof fieldOrFn === "string" || isTCol(fieldOrFn)) {
    return new Order(fieldOrFn, "ASC");
  }
  return new OrderSqlFn(fieldOrFn as AnyScalarSqlFn, "ASC");
}

/**
 * Creates a descending order clause for a column or a `SqlFn` expression.
 *
 * @example
 * db.from(Users).select().orderBy(desc(Users.createdAt))
 * db.from(Properties).select().orderBy(desc(stDistance(Properties.location, point)))
 */
export function desc<TTableColumn extends TableAnyColumn | string>(
  field: TTableColumn,
): Order<TTableColumn, "DESC">;
export function desc<TSqlFn extends AnyScalarSqlFn>(
  fn: TSqlFn,
): OrderSqlFn<TSqlFn>;
export function desc(fieldOrFn: TableAnyColumn | AnyScalarSqlFn) {
  if (typeof fieldOrFn === "string" || isTCol(fieldOrFn)) {
    return new Order(fieldOrFn, "DESC");
  }
  return new OrderSqlFn(fieldOrFn as AnyScalarSqlFn, "DESC");
}
