import type { QueryExecutor } from "../connectors/common";
import type { FilterExpression, StdCondition } from "../filters/index";
import type { AnySqlFn, StdSqlFn } from "../functions/index";
import { SqlFn } from "../functions/index";
import type {
  AnyColumn,
  AnyTableWithColumns,
  StdTableColumn,
  TableAnyColumn,
  TableWithColumns,
} from "../table";
import type {
  Prettify,
  SelfOrArray,
  UnionToIntersection,
  Valueof,
} from "../types";
import { snakeToCamel } from "../utils";
import type { OrderBy } from "./orderby-clause";
import { Query } from "./query";
import { QueryPromise } from "./query-promise";

export class SelectBuilder<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TPrepare extends boolean,
  TInnerJoins extends
    | null
    | [
        {
          table: AnyTableWithColumns;
          on: FilterExpression<Valueof<AnyTableWithColumns["_"]["columns"]>>;
        },
        ...{
          table: AnyTableWithColumns;
          on: FilterExpression<Valueof<AnyTableWithColumns["_"]["columns"]>>;
        }[],
      ],
> {
  readonly #table: TableWithColumns<TTSchema, TTName, TTColumns>;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;
  readonly #$innerJoins: TInnerJoins;
  readonly #$distinctOn: StdTableColumn[] | undefined;

  constructor(
    table: TableWithColumns<TTSchema, TTName, TTColumns>,
    innerJoins: TInnerJoins,
    distinctOn: StdTableColumn[] | undefined,
    executor: QueryExecutor,
    prepare: TPrepare,
  ) {
    this.#table = table;
    this.#$innerJoins = innerJoins;
    this.#$distinctOn = distinctOn;
    this.#executor = executor;
    this.#prepare = prepare;
  }

  innerJoin<
    TJoinTSchema extends string,
    TJoinTName extends string,
    TJoinTColumns extends Record<string, AnyColumn>,
    TOn extends FilterExpression<
      | Valueof<TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]>
      | Valueof<
          TableWithColumns<
            TJoinTSchema,
            TJoinTName,
            TJoinTColumns
          >["_"]["columns"]
        >
      | (TInnerJoins extends unknown[]
          ? Valueof<TInnerJoins[number]["table"]["_"]["columns"]>
          : never)
    >,
  >(
    table: TableWithColumns<TJoinTSchema, TJoinTName, TJoinTColumns>,
    on: TOn,
  ): SelectBuilder<
    TTSchema,
    TTName,
    TTColumns,
    TPrepare,
    TInnerJoins extends unknown[]
      ? [
          ...TInnerJoins,
          {
            table: TableWithColumns<TJoinTSchema, TJoinTName, TJoinTColumns>;
            on: StdCondition;
          },
        ]
      : [
          {
            table: TableWithColumns<TJoinTSchema, TJoinTName, TJoinTColumns>;
            on: StdCondition;
          },
        ]
  > {
    return new SelectBuilder(
      this.#table,
      this.#$innerJoins
        ? [...this.#$innerJoins, { table, on }]
        : ([{ table, on }] as any),
      undefined,
      this.#executor,
      this.#prepare,
    );
  }

  distinctOn(
    columns: SelfOrArray<
      | Valueof<TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]>
      | (TInnerJoins extends unknown[]
          ? Valueof<TInnerJoins[number]["table"]["_"]["columns"]>
          : never)
    >,
  ): Omit<
    SelectBuilder<TTSchema, TTName, TTColumns, TPrepare, TInnerJoins>,
    "distinctOn" | "innerJoin"
  > {
    return new SelectBuilder(
      this.#table,
      this.#$innerJoins,
      (Array.isArray(columns) ? columns : [columns]) as StdTableColumn[],
      this.#executor,
      this.#prepare,
    );
  }

  select(): SelectQuery<
    TTSchema,
    TTName,
    TTColumns,
    TInnerJoins,
    undefined,
    TPrepare,
    undefined,
    undefined
  >;
  select<
    TSelects extends Record<
      string,
      | Valueof<TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]>
      | (TInnerJoins extends unknown[]
          ? Valueof<TInnerJoins[number]["table"]["_"]["columns"]>
          : never)
      | SqlFn<
          Valueof<
            TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]
          >,
          TPrepare
        >
      | (TInnerJoins extends unknown[]
          ? SqlFn<
              Valueof<TInnerJoins[number]["table"]["_"]["columns"]>,
              TPrepare
            >
          : never)
    >,
  >(
    selects: TSelects,
  ): SelectQuery<
    TTSchema,
    TTName,
    TTColumns,
    TInnerJoins,
    TSelects,
    TPrepare,
    undefined,
    undefined
  >;
  select<
    TSelects extends
      | Record<
          string,
          | Valueof<
              TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]
            >
          | (TInnerJoins extends unknown[]
              ? Valueof<TInnerJoins[number]["table"]["_"]["columns"]>
              : never)
          | SqlFn<
              Valueof<
                TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]
              >,
              TPrepare
            >
          | (TInnerJoins extends unknown[]
              ? SqlFn<
                  Valueof<TInnerJoins[number]["table"]["_"]["columns"]>,
                  TPrepare
                >
              : never)
        >
      | undefined,
  >(selects?: TSelects) {
    return new SelectQuery(
      this.#table,
      this.#$innerJoins,
      selects,
      this.#$distinctOn,
      undefined,
      undefined,
      undefined,
      undefined,
      this.#executor,
      this.#prepare,
    );
  }
}

export class SelectQuery<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TInnerJoins extends
    | null
    | [
        {
          table: AnyTableWithColumns;
          on: FilterExpression<Valueof<AnyTableWithColumns["_"]["columns"]>>;
        },
        ...{
          table: AnyTableWithColumns;
          on: FilterExpression<Valueof<AnyTableWithColumns["_"]["columns"]>>;
        }[],
      ],
  TSelects extends
    | Record<
        string,
        | Valueof<TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]>
        | (TInnerJoins extends unknown[]
            ? Valueof<TInnerJoins[number]["table"]["_"]["columns"]>
            : never)
        | SqlFn<any, boolean>
      >
    | undefined,
  TPrepare extends boolean,
  TWhere extends
    | FilterExpression<
        | Valueof<TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]>
        | (TInnerJoins extends unknown[]
            ? Valueof<TInnerJoins[number]["table"]["_"]["columns"]>
            : never),
        TPrepare
      >
    | undefined,
  TOrderBy extends
    | OrderBy<TableWithColumns<TTSchema, TTName, TTColumns>, TSelects, TPrepare>
    | OrderBy<
        TableWithColumns<TTSchema, TTName, TTColumns>,
        TSelects,
        TPrepare
      >[]
    | undefined,
  TReturn = (TSelects extends Record<string, unknown>
    ? {
        [TCol in keyof TSelects]: TSelects[TCol] extends TableAnyColumn
          ? TSelects[TCol]["ValTypeSelect"]
          : TSelects[TCol] extends AnySqlFn
            ? TSelects[TCol]["$"]["TsType"]
            : never;
      }
    : Prettify<
        TableWithColumns<TTSchema, TTName, TTColumns>["$"]["inferSelect"] &
          (TInnerJoins extends unknown[]
            ? UnionToIntersection<
                TInnerJoins[number]["table"]["$"]["inferSelect"]
              >
            : Record<never, never>)
      >)[],
> extends QueryPromise<TReturn> {
  readonly #table: TableWithColumns<TTSchema, TTName, TTColumns>;
  readonly #$select: TSelects;
  readonly #$distinctOn: StdTableColumn[] | undefined;
  readonly #$where: TWhere;
  readonly #$innerJoins: TInnerJoins;
  readonly #$orderBy: TOrderBy;
  #$limit: number | undefined;
  #$offset: number | undefined;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;

  constructor(
    table: TableWithColumns<TTSchema, TTName, TTColumns>,
    innerJoins: TInnerJoins,
    select: TSelects,
    distinctOn: StdTableColumn[] | undefined,
    where: TWhere,
    orderBy: TOrderBy,
    limit: number | undefined,
    offset: number | undefined,
    executor: QueryExecutor,
    prepare: TPrepare,
  ) {
    super();
    this.#table = table;
    this.#$select = select;
    this.#$distinctOn = distinctOn;
    this.#$innerJoins = innerJoins;
    this.#$where = where;
    this.#$orderBy = orderBy;
    this.#$limit = limit;
    this.#$offset = offset;
    this.#executor = executor;
    this.#prepare = prepare;
  }

  where<
    TWhere extends
      | FilterExpression<
          | Valueof<
              TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]
            >
          | (TInnerJoins extends unknown[]
              ? Valueof<TInnerJoins[number]["table"]["_"]["columns"]>
              : never),
          TPrepare
        >
      | undefined,
  >(where: TWhere) {
    return new SelectQuery(
      this.#table,
      this.#$innerJoins,
      this.#$select,
      this.#$distinctOn,
      where,
      this.#$orderBy,
      this.#$limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
    );
  }

  orderBy<
    TOrderBys extends
      | (
          | OrderBy<
              TableWithColumns<TTSchema, TTName, TTColumns>,
              TSelects,
              TPrepare
            >
          | (TInnerJoins extends unknown[]
              ? OrderBy<TInnerJoins[number]["table"], TSelects, TPrepare>
              : never)
        )
      | (
          | OrderBy<
              TableWithColumns<TTSchema, TTName, TTColumns>,
              TSelects,
              TPrepare
            >
          | (TInnerJoins extends unknown[]
              ? OrderBy<TInnerJoins[number]["table"], TSelects, TPrepare>
              : never)
        )[],
  >(orderBy: TOrderBys) {
    return new SelectQuery(
      this.#table,
      this.#$innerJoins,
      this.#$select,
      this.#$distinctOn,
      this.#$where,
      orderBy,
      this.#$limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
    );
  }

  limit(limit: number) {
    return new SelectQuery(
      this.#table,
      this.#$innerJoins,
      this.#$select,
      this.#$distinctOn,
      this.#$where,
      this.#$orderBy,
      limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
    ) as unknown as Omit<this, "limit">;
  }

  offset(offset: number) {
    return new SelectQuery(
      this.#table,
      this.#$innerJoins,
      this.#$select,
      this.#$distinctOn,
      this.#$where,
      this.#$orderBy,
      this.#$limit,
      offset,
      this.#executor,
      this.#prepare,
    ) as unknown as Omit<this, "offset">;
  }

  toQuery(): Query<TReturn> {
    const query = new Query<TReturn>("SELECT ", this.handleRows.bind(this));
    if (this.#$distinctOn?.length) {
      query.sql += `DISTINCT ON (${this.#$distinctOn.map((c) => c.fullName).join(", ")}) `;
    }
    const entries = this.#$select ? Object.entries(this.#$select) : null;
    if (entries) {
      for (let i = 0; i < entries.length; i++) {
        const [key, colOrFn] = entries[i];
        if (colOrFn instanceof SqlFn) {
          colOrFn.toQuery(query);
          query.sql += ` AS "${key}"`;
        } else {
          query.sql += `${(colOrFn as StdTableColumn).fullName} AS "${key}"`;
        }
        if (i < entries.length - 1) query.sql += ", ";
      }
    } else {
      query.sql += "*";
    }
    query.sql += " FROM ";
    query.sql += this.#table._.fullName;
    this.#$innerJoins?.forEach((innerJoin) => {
      const join = innerJoin;
      query.sql += ` INNER JOIN ${join.table._.fullName} ON `;
      join.on.toQuery(query);
    });
    if (this.#$where) {
      query.sql += " WHERE ";
      this.#$where.toQuery(query);
    }
    if (entries) {
      const hasAggregate = entries.some(
        ([, colOrFn]) => colOrFn instanceof SqlFn && colOrFn.isAggregate,
      );
      if (hasAggregate) {
        const nonAggEntries = entries.filter(
          ([, colOrFn]) => !(colOrFn instanceof SqlFn) || !colOrFn.isAggregate,
        );
        if (nonAggEntries.length > 0) {
          query.sql += " GROUP BY ";
          for (let i = 0; i < nonAggEntries.length; i++) {
            const [, colOrFn] = nonAggEntries[i];
            if (colOrFn instanceof SqlFn) {
              colOrFn.toQuery(query);
            } else {
              query.sql += (colOrFn as StdTableColumn).fullName;
            }
            if (i < nonAggEntries.length - 1) query.sql += ", ";
          }
        }
      }
    }
    if (this.#$orderBy) {
      const orders = Array.isArray(this.#$orderBy)
        ? this.#$orderBy
        : [this.#$orderBy];
      query.sql += " ORDER BY ";
      for (let i = 0; i < orders.length; i++) {
        orders[i].toQuery(query);
        if (i < orders.length - 1) query.sql += ", ";
      }
    }
    if (this.#$limit) query.sql += ` LIMIT ${this.#$limit}`;
    if (this.#$offset) query.sql += ` OFFSET ${this.#$offset}`;
    return query;
  }

  async execute(): Promise<TReturn> {
    const query = this.toQuery();
    query.sql += ";";
    const res = await this.#executor.execQuery(query);
    const rows = this.#executor.getRows(res);
    return this.handleRows(rows);
  }

  handleRows(rows: Record<string, unknown>[]) {
    if (this.#$select !== undefined) {
      rows.forEach((row) => {
        for (const [key, value] of Object.entries(row)) {
          const colOrFn = (
            this.#$select as Record<string, StdTableColumn | StdSqlFn>
          )[key];
          row[key] = colOrFn.fromDriver(value);
        }
      });
      return rows as TReturn;
    } else {
      const newRows: Record<string, unknown>[] = [];
      rows.forEach((row) => {
        const newRow: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          const keyCamel = snakeToCamel(key);
          let column = this.#table._.columns[keyCamel];
          if (column === undefined) {
            this.#$innerJoins?.forEach((innerJoin) => {
              const joinCol = innerJoin.table._.columns[keyCamel];
              if (joinCol !== undefined) {
                column = joinCol;
              }
            });
          }
          if (column === undefined)
            throw new Error(`Column ${keyCamel} not found in any table`);
          newRow[keyCamel] = column.fromDriver(value);
        }
        newRows.push(newRow);
      });
      return newRows as TReturn;
    }
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <>
type AnySQ = SelectQuery<any, any, any, any, any, any, any, any>;

export type AnySelectQuery = AnySQ;
