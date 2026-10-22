import { isTCol } from "../entity";
import type { AnySqlFn, NonAggregateSqlFn, ScopedSqlFn } from "../functions";
import { escIdentifier } from "../sql";
import type { AnyTableWithColumns, TableAnyColumn } from "../table";
import type { Valueof } from "../types";
import type { Query, QueryContext } from "./query";

export type OrderDirection = "ASC" | "DESC";

export class Order<
  TTableColumn extends TableAnyColumn | string,
  TOrder extends "ASC" | "DESC",
> {
  /** Phantom field: the column(s) this order expression references — mirrors `Filter.$Columns`. */
  readonly $Columns!: TTableColumn extends TableAnyColumn
    ? TTableColumn
    : never;
  /** Phantom field: `true` when this order expression embeds an `Arg` placeholder. */
  readonly $HasArg!: false;

  readonly field: TTableColumn;
  readonly dir: TOrder;
  constructor(field: TTableColumn, dir: TOrder) {
    this.field = field;
    this.dir = dir;
  }

  /** Appends the order fragment to the query SQL. */
  toQuery(query: Query, ctx?: QueryContext) {
    if (typeof this.field === "string") {
      query.sql += `"${escIdentifier(this.field)}" ${this.dir}`;
    } else {
      this.field.toQuery(query, ctx);
      query.sql += ` ${this.dir}`;
    }
  }
}

export type StdOrder = Order<string, OrderDirection>;

/** Order clause built from a `SqlFn`, via `asc()`/`desc()`. */
export class OrderSqlFn<TSqlFn extends AnySqlFn> {
  /** Phantom field: the column(s) this order expression references — mirrors `Filter.$Columns`. */
  readonly $Columns!: TSqlFn["$Columns"];
  /** Phantom field: `true` when this order expression embeds an `Arg` placeholder. */
  readonly $HasArg!: TSqlFn["$HasArg"];

  constructor(
    private readonly fn: TSqlFn,
    private readonly dir: "ASC" | "DESC",
  ) {}

  /** Appends the order fragment (expression + direction) to the query SQL. */
  toQuery(query: Query, ctx?: QueryContext) {
    this.fn.toQuery(query, ctx);
    query.sql += ` ${this.dir}`;
  }
}

export type StdOrderSqlFn = OrderSqlFn<AnySqlFn>;

/**
 * Order item an aggregate accepts inside its own `ORDER BY`; an aggregate is
 * refused because it would nest.
 */
export type AnyOrder =
  | Order<TableAnyColumn | string, OrderDirection>
  | OrderSqlFn<NonAggregateSqlFn>;

/**
 * Valid orderBy item for a query. An aggregate is allowed here; PostgreSQL
 * reads `ORDER BY` after grouping.
 *
 * @template TTableOrCols - The table or column(s) being queried.
 * @template TPrepare - When `true`, `OrderSqlFn` items carrying `Arg` placeholders are allowed.
 *   Defaults to `false` (non-prepared context).
 * @template TSelects - Select shape map for output alias references.
 */
export type OrderExpression<
  TTableOrCols extends AnyTableWithColumns | TableAnyColumn,
  TPrepare extends boolean = false,
  TSelects extends Record<string, unknown> | undefined = undefined,
> =
  | Order<
      TTableOrCols extends AnyTableWithColumns
        ? Valueof<TTableOrCols["_"]["columns"]>
        : TTableOrCols,
      "ASC" | "DESC"
    >
  | Order<Extract<keyof TSelects, string>, "ASC" | "DESC">
  | OrderSqlFn<
      ScopedSqlFn<
        TTableOrCols extends AnyTableWithColumns
          ? Valueof<TTableOrCols["_"]["columns"]>
          : TTableOrCols,
        TPrepare extends true ? boolean : false
      >
    >;

/**
 * Creates an ascending order clause for a column or a `SqlFn` expression.
 *
 * @example
 * ```ts
 * db.from(Users).select("*").orderBy(() => asc(Users.createdAt))
 * db.from(Properties).select("*").orderBy(() => asc(stDistance(Properties.location, point)))
 * ```
 */
export function asc<TTableColumn extends TableAnyColumn | string>(
  field: TTableColumn,
): Order<TTableColumn, "ASC">;
export function asc<TSqlFn extends AnySqlFn>(fn: TSqlFn): OrderSqlFn<TSqlFn>;
export function asc(fieldOrFn: TableAnyColumn | AnySqlFn) {
  if (typeof fieldOrFn === "string" || isTCol(fieldOrFn)) {
    return new Order(fieldOrFn, "ASC");
  }
  return new OrderSqlFn(fieldOrFn as AnySqlFn, "ASC");
}

/**
 * Creates a descending order clause for a column or a `SqlFn` expression.
 *
 * @example
 * ```ts
 * db.from(Users).select("*").orderBy(() => desc(Users.createdAt))
 * db.from(Properties).select("*").orderBy(() => desc(stDistance(Properties.location, point)))
 * ```
 */
export function desc<TTableColumn extends TableAnyColumn | string>(
  field: TTableColumn,
): Order<TTableColumn, "DESC">;
export function desc<TSqlFn extends AnySqlFn>(fn: TSqlFn): OrderSqlFn<TSqlFn>;
export function desc(fieldOrFn: TableAnyColumn | AnySqlFn) {
  if (typeof fieldOrFn === "string" || isTCol(fieldOrFn)) {
    return new Order(fieldOrFn, "DESC");
  }
  return new OrderSqlFn(fieldOrFn as AnySqlFn, "DESC");
}
