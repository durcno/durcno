import type { QueryExecutor } from "../connectors/common";
import type { AnyCteWithColumns } from "../cte";
import { is, isCol } from "../entity";
import type {
  FilterExpression,
  HavingExpression,
  StdCondition,
} from "../filters/index";
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
import type { MergeJoinedColumns, SelectableSource } from "../virtual-table";
import {
  createGroupBySelectView,
  type GroupByAlias,
  type GroupByExpression,
  type GroupBySelectView,
  isGroupByAlias,
  isScalarSqlFn,
  type StdGroupByExpression,
} from "./groupby-clause";
import { buildWithClause } from "./helpers";
import type { OrderExpression } from "./orderby-clause";
import { type AnyArg, Arg } from "./pre";
import { type AnyQuery, Query } from "./query";
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
  readonly #$ctes: readonly AnyCteWithColumns[] | null;

  constructor(
    table: TableWithColumns<TTSchema, TTName, TTColumns>,
    innerJoins: TInnerJoins,
    distinctOn: StdTableColumn[] | undefined,
    executor: QueryExecutor,
    prepare: TPrepare,
    ctes: readonly AnyCteWithColumns[] | null = null,
  ) {
    this.#table = table;
    this.#$innerJoins = innerJoins;
    this.#$distinctOn = distinctOn;
    this.#executor = executor;
    this.#prepare = prepare;
    this.#$ctes = ctes;
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
      this.#$ctes,
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
      this.#$ctes,
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
      undefined,
      undefined,
      this.#executor,
      this.#prepare,
      this.#$ctes,
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
    | OrderExpression<
        TableWithColumns<TTSchema, TTName, TTColumns>,
        TSelects,
        TPrepare
      >
    | OrderExpression<
        TableWithColumns<TTSchema, TTName, TTColumns>,
        TSelects,
        TPrepare
      >[]
    | undefined,
  TGroupBy extends StdGroupByExpression[] | undefined = undefined,
  THaving extends
    | HavingExpression<
        | Valueof<TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]>
        | (TInnerJoins extends unknown[]
            ? Valueof<TInnerJoins[number]["table"]["_"]["columns"]>
            : never),
        TPrepare
      >
    | undefined = undefined,
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
  readonly #$groupBy: TGroupBy;
  readonly #$having: THaving;
  #$limit: number | bigint | AnyArg | undefined;
  #$offset: number | bigint | AnyArg | undefined;
  readonly #executor: QueryExecutor;
  readonly #prepare: TPrepare;
  readonly #$ctes: readonly AnyCteWithColumns[] | null;

  constructor(
    table: TableWithColumns<TTSchema, TTName, TTColumns>,
    innerJoins: TInnerJoins,
    select: TSelects,
    distinctOn: StdTableColumn[] | undefined,
    where: TWhere,
    orderBy: TOrderBy,
    groupBy: TGroupBy,
    having: THaving,
    limit: number | bigint | AnyArg | undefined,
    offset: number | bigint | AnyArg | undefined,
    executor: QueryExecutor,
    prepare: TPrepare,
    ctes: readonly AnyCteWithColumns[] | null = null,
  ) {
    super();
    this.#table = table;
    this.#$select = select;
    this.#$distinctOn = distinctOn;
    this.#$innerJoins = innerJoins;
    this.#$where = where;
    this.#$orderBy = orderBy;
    this.#$groupBy = groupBy;
    this.#$having = having;
    this.#$limit = limit;
    this.#$offset = offset;
    this.#executor = executor;
    this.#prepare = prepare;
    this.#$ctes = ctes;
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
      this.#$groupBy,
      this.#$having,
      this.#$limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    );
  }

  orderBy<
    TOrderBys extends
      | (
          | OrderExpression<
              TableWithColumns<TTSchema, TTName, TTColumns>,
              TSelects,
              TPrepare
            >
          | (TInnerJoins extends unknown[]
              ? OrderExpression<
                  TInnerJoins[number]["table"],
                  TSelects,
                  TPrepare
                >
              : never)
        )
      | (
          | OrderExpression<
              TableWithColumns<TTSchema, TTName, TTColumns>,
              TSelects,
              TPrepare
            >
          | (TInnerJoins extends unknown[]
              ? OrderExpression<
                  TInnerJoins[number]["table"],
                  TSelects,
                  TPrepare
                >
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
      this.#$groupBy,
      this.#$having,
      this.#$limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    );
  }

  /**
   * Adds an explicit GROUP BY clause. Overrides auto GROUP BY detection when set.
   *
   * **Direct form** — a single column/expression or array:
   * ```ts
   * db.from(Users).select({ type: Users.type, total: count('*') }).groupBy(Users.type)
   * ```
   *
   * **Callback form** — references named select-map aliases (requires `.select({...})`):
   * ```ts
   * db.from(Users).select({ lname: lower(Users.username) }).groupBy(({ lname }) => [lname])
   * ```
   */
  groupBy<
    TItems extends
      | GroupByExpression<
          TableWithColumns<TTSchema, TTName, TTColumns>,
          TPrepare,
          TSelects extends Record<string, SelectableSource>
            ? TSelects
            : undefined
        >
      | GroupByExpression<
          TableWithColumns<TTSchema, TTName, TTColumns>,
          TPrepare,
          TSelects extends Record<string, SelectableSource>
            ? TSelects
            : undefined
        >[],
  >(groupBy: TItems): Omit<this, "groupBy">;
  groupBy(
    callback: TSelects extends Record<string, SelectableSource>
      ? (
          selects: GroupBySelectView<TSelects>,
        ) => GroupByExpression<
          TableWithColumns<TTSchema, TTName, TTColumns>,
          TPrepare,
          TSelects
        >[]
      : never,
  ): Omit<this, "groupBy">;
  groupBy(
    groupByOrCallback:
      | StdGroupByExpression
      | StdGroupByExpression[]
      | ((
          selects: Record<string, GroupByAlias<string>>,
        ) => StdGroupByExpression[]),
  ): Omit<this, "groupBy"> {
    const items =
      typeof groupByOrCallback === "function"
        ? groupByOrCallback(
            createGroupBySelectView(
              this.#$select as Record<string, SelectableSource>,
            ),
          )
        : Array.isArray(groupByOrCallback)
          ? groupByOrCallback
          : [groupByOrCallback];
    return new SelectQuery(
      this.#table,
      this.#$innerJoins,
      this.#$select,
      this.#$distinctOn,
      this.#$where,
      this.#$orderBy,
      items as StdGroupByExpression[],
      this.#$having,
      this.#$limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    ) as unknown as Omit<this, "groupBy">;
  }

  /**
   * Adds a HAVING clause to filter grouped results.
   * Supports aggregate-to-literal and aggregate-to-aggregate comparisons.
   *
   * ```ts
   * db.from(Users).select({ type: Users.type, total: count('*') })
   *   .groupBy(Users.type)
   *   .having(gte(count('*'), 2))
   * ```
   */
  having<
    TH extends HavingExpression<
      | Valueof<TableWithColumns<TTSchema, TTName, TTColumns>["_"]["columns"]>
      | (TInnerJoins extends unknown[]
          ? Valueof<TInnerJoins[number]["table"]["_"]["columns"]>
          : never),
      TPrepare
    >,
  >(having: TH): Omit<this, "having"> {
    return new SelectQuery(
      this.#table,
      this.#$innerJoins,
      this.#$select,
      this.#$distinctOn,
      this.#$where,
      this.#$orderBy,
      this.#$groupBy,
      having,
      this.#$limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    ) as unknown as Omit<this, "having">;
  }

  limit(
    limit: TPrepare extends true
      ? number | bigint | Arg<number> | Arg<bigint>
      : number | bigint,
  ) {
    return new SelectQuery(
      this.#table,
      this.#$innerJoins,
      this.#$select,
      this.#$distinctOn,
      this.#$where,
      this.#$orderBy,
      this.#$groupBy,
      this.#$having,
      limit,
      this.#$offset,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    ) as unknown as Omit<this, "limit">;
  }

  offset(
    offset: TPrepare extends true
      ? number | bigint | Arg<number> | Arg<bigint>
      : number | bigint,
  ) {
    return new SelectQuery(
      this.#table,
      this.#$innerJoins,
      this.#$select,
      this.#$distinctOn,
      this.#$where,
      this.#$orderBy,
      this.#$groupBy,
      this.#$having,
      this.#$limit,
      offset,
      this.#executor,
      this.#prepare,
      this.#$ctes,
    ) as unknown as Omit<this, "offset">;
  }

  toQuery(parentQuery?: AnyQuery): Query<TReturn> {
    const isRoot = parentQuery === undefined;
    const query: Query<TReturn> = parentQuery
      ? (parentQuery as unknown as Query<TReturn>)
      : new Query<TReturn>("", this.handleRows.bind(this));

    if (isRoot && this.#$ctes?.length) {
      buildWithClause(this.#$ctes, query);
    }

    query.sql += "SELECT ";
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
    if (this.#$groupBy?.length) {
      // Explicit GROUP BY — bypasses auto GROUP BY detection
      query.sql += " GROUP BY ";
      for (let i = 0; i < this.#$groupBy.length; i++) {
        const expr = this.#$groupBy[i];
        if (isGroupByAlias(expr)) {
          expr.toQuery(query); // → "alias"
        } else if (isScalarSqlFn(expr)) {
          expr.toQuery(query); // → floor(...)
        } else {
          query.sql += (expr as StdTableColumn).fullName; // → "schema"."table"."col"
        }
        if (i < this.#$groupBy.length - 1) query.sql += ", ";
      }
    } else if (entries) {
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
    // HAVING — emitted after GROUP BY (explicit or auto)
    if (this.#$having) {
      query.sql += " HAVING ";
      this.#$having.toQuery(query);
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
    if (this.#$limit !== undefined) {
      query.sql += " LIMIT ";
      if (is(this.#$limit, Arg)) {
        query.addArg(this.#$limit);
      } else {
        query.sql += this.#$limit.toString();
      }
    }
    if (this.#$offset !== undefined) {
      query.sql += " OFFSET ";
      if (is(this.#$offset, Arg)) {
        query.addArg(this.#$offset);
      } else {
        query.sql += this.#$offset.toString();
      }
    }
    return query;
  }

  async execute(): Promise<TReturn> {
    const query = this.toQuery();
    query.sql += ";";
    const res = await this.#executor.execQuery(query);
    const rows = this.#executor.getRows(res);
    return this.handleRows(rows);
  }

  /**
   * Returns the resolved output columns of this query.
   * When an explicit `.select()` was provided the select-map entries are returned;
   * otherwise the table's own columns are merged with any joined table columns.
   */
  getResolvedColumns(): Prettify<
    TSelects extends Record<string, SelectableSource>
      ? TSelects
      : MergeJoinedColumns<TTColumns, TInnerJoins>
  > {
    if (this.#$select) {
      return { ...this.#$select } as Prettify<
        TSelects extends Record<string, SelectableSource>
          ? TSelects
          : MergeJoinedColumns<TTColumns, TInnerJoins>
      >;
    }
    const cols: Record<string, SelectableSource> = { ...this.#table._.columns };
    this.#$innerJoins?.forEach((j) => {
      Object.assign(cols, j.table._.columns);
    });
    return cols as Prettify<
      TSelects extends Record<string, SelectableSource>
        ? TSelects
        : MergeJoinedColumns<TTColumns, TInnerJoins>
    >;
  }

  handleRows(rows: Record<string, unknown>[]) {
    if (this.#$select !== undefined) {
      rows.forEach((row) => {
        for (const [key, value] of Object.entries(row)) {
          const colOrFn = (
            this.#$select as Record<string, StdTableColumn | StdSqlFn>
          )[key];
          row[key] = isCol(colOrFn)
            ? colOrFn.fromDriver(value)
            : colOrFn.fromDriverValue(value);
        }
      });
      return rows as TReturn;
    } else {
      const newRows: Record<string, unknown>[] = [];
      rows.forEach((row) => {
        const newRow: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          let column = this.#table._.columnsBySql[key];
          if (column === undefined) {
            this.#$innerJoins?.forEach((innerJoin) => {
              const joinCol = innerJoin.table._.columnsBySql[key];
              if (joinCol !== undefined) {
                column = joinCol;
              }
            });
          }
          if (column === undefined)
            throw new Error(`Column ${key} not found in any table`);
          newRow[column.name] = column.fromDriver(value);
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
