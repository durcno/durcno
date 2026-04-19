import type { AnyColumn, AnyTableWithColumns, TableColumn } from "../table";

class Order<
  TTSchema extends string,
  TTName extends string,
  TCName extends Key,
  TCol extends AnyColumn,
  TOrder extends "ASC" | "DESC",
> {
  readonly field: TableColumn<TTSchema, TTName, TCName, TCol>;
  readonly order: TOrder;
  constructor(
    field: TableColumn<TTSchema, TTName, TCName, TCol>,
    order: TOrder,
  ) {
    this.field = field;
    this.order = order;
  }

  toSQL(): string {
    return `${this.field.fullName} ${this.order}`;
  }
}

export type { Order };

export type OrderBy<TTableWC extends AnyTableWithColumns> = TTableWC extends any
  ? {
      [ColName in keyof TTableWC["_"]["columns"]]: TTableWC["_"]["columns"][ColName] extends TableColumn<
        infer TTSchema,
        infer TTName,
        infer TCName,
        infer TColumn
      >
        ? Order<TTSchema, TTName, TCName, TColumn, "ASC" | "DESC">
        : never;
    }[keyof TTableWC["_"]["columns"]]
  : never;

export function asc<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
>(field: TableColumn<CTSchema, CTName, CName, Col>) {
  return new Order(field, "ASC");
}

export function desc<
  CTSchema extends string,
  CTName extends string,
  CName extends Key,
  Col extends AnyColumn,
>(field: TableColumn<CTSchema, CTName, CName, Col>) {
  return new Order(field, "DESC");
}
