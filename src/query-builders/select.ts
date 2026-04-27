import type { QueryExecutor } from "../connectors/common";
import type { BuildFilterExpression, StdCondition } from "../filters/index";
import type {
  AnyColumn,
  AnyTableWithColumns,
  BuildScmTblColumns,
  StdTableColumn,
  TableColumn,
  TableWithColumns,
  TColsToLeftRight,
} from "../table";
import type {
  Key,
  Prettify,
  SelfOrArray,
  UnionToIntersection,
  Valueof,
} from "../types";
import { camelToSnake, snakeToCamel } from "../utils";
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
          on: BuildFilterExpression<
            TColsToLeftRight<AnyTableWithColumns["_"]["columns"]>
          >;
        },
        ...{
          table: AnyTableWithColumns;
          on: BuildFilterExpression<
            TColsToLeftRight<AnyTableWithColumns["_"]["columns"]>
          >;
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
    TOn extends BuildFilterExpression<
      TColsToLeftRight<
        BuildScmTblColumns<TTSchema, TTName, TTColumns> &
          BuildScmTblColumns<TJoinTSchema, TJoinTName, TJoinTColumns> &
          (TInnerJoins extends unknown[]
            ? UnionToIntersection<
                TInnerJoins[number]["table"]["$"]["_"]["scmTblColumns"]
              >
            : Record<never, never>)
      >
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
          on: BuildFilterExpression<
            TColsToLeftRight<AnyTableWithColumns["$"]["_"]["scmTblColumns"]>
          >;
        },
        ...{
          table: AnyTableWithColumns;
          on: BuildFilterExpression<
            TColsToLeftRight<AnyTableWithColumns["$"]["_"]["scmTblColumns"]>
          >;
        }[],
      ],
  TSelects extends
    | Record<
        string,
        | Valueof<
            NoInfer<
              TableWithColumns<TTSchema, TTName, TTColumns>
            >["_"]["columns"]
          >
        | (TInnerJoins extends unknown[]
            ? Valueof<TInnerJoins[number]["table"]["_"]["columns"]>
            : never)
      >
    | undefined,
  TPrepare extends boolean,
  TWhere extends
    | BuildFilterExpression<
        TColsToLeftRight<
          NoInfer<TableWithColumns<TTSchema, TTName, TTColumns>>["_"]["columns"]
        >,
        TPrepare
      >
    | undefined,
  TOrderBy extends
    | OrderBy<NoInfer<TableWithColumns<TTSchema, TTName, TTColumns>>>
    | OrderBy<NoInfer<TableWithColumns<TTSchema, TTName, TTColumns>>>[]
    | undefined,
  TReturn = (TSelects extends Record<string, unknown>
    ? {
        [TCol in keyof TSelects]: TSelects[TCol] extends TableColumn<
          string,
          string,
          Key,
          infer TColumn
        >
          ? TColumn["ValTypeSelect"]
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
      | BuildFilterExpression<
          TColsToLeftRight<
            BuildScmTblColumns<TTSchema, TTName, TTColumns> &
              (TInnerJoins extends unknown[]
                ? UnionToIntersection<
                    TInnerJoins[number]["table"]["$"]["_"]["scmTblColumns"]
                  >
                : Record<never, never>)
          >,
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
          | OrderBy<TableWithColumns<TTSchema, TTName, TTColumns>>
          | (TInnerJoins extends unknown[]
              ? OrderBy<TInnerJoins[number]["table"]>
              : never)
        )
      | (
          | OrderBy<TableWithColumns<TTSchema, TTName, TTColumns>>
          | (TInnerJoins extends unknown[]
              ? OrderBy<TInnerJoins[number]["table"]>
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
    query.sql += this.#$select
      ? Object.entries(this.#$select)
          .map(
            ([key, column]) =>
              `${(column as StdTableColumn).fullName} AS ${camelToSnake(key)}`,
          )
          .join(", ")
      : "*";
    query.sql += " FROM ";
    query.sql += this.#table._.fullName;
    this.#$innerJoins?.forEach((innerJoin) => {
      const join = innerJoin;
      query.sql += ` INNER JOIN ${join.table._.fullName} ON ${join.on.toSQL()}`;
    });
    if (this.#$where) {
      query.sql += " WHERE ";
      if (this.#prepare) {
        this.#$where.toQuery(query);
      } else {
        query.sql += this.#$where.toSQL();
      }
    }
    if (this.#$orderBy) {
      const orders = Array.isArray(this.#$orderBy)
        ? this.#$orderBy
        : [this.#$orderBy];
      query.sql += ` ORDER BY ${orders.map((o) => o.toSQL()).join(", ")}`;
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
    const { columns } = this.#table._;
    const cols = this.#$select ?? columns;
    rows.forEach((row) => {
      for (const [key, value] of Object.entries(row)) {
        const keyCamel = snakeToCamel(key);
        const column = cols[keyCamel] as AnyColumn;
        row[keyCamel] = column.fromDriver(value);
        if (keyCamel !== key) delete row[key];
      }
    });
    return rows as TReturn;
  }
}

// biome-ignore lint/suspicious/noExplicitAny: <>
type AnySQ = SelectQuery<any, any, any, any, any, any, any, any>;

export type AnySelectQuery = AnySQ;
