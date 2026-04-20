import type { $Pool, Connector, QueryExecutor } from "./connectors/common";
import { is } from "./entity";
import type { BuildFilterExpression } from "./filters/index";
import type { Config, DurcnoSetup } from "./index";
import { AggregateQuery } from "./query-builders/aggregates";
import { CountQuery } from "./query-builders/count";
import { DeleteQuery } from "./query-builders/delete";
import { DistinctQuery } from "./query-builders/distinct";
import { ExistsQuery } from "./query-builders/exists";
import { FirstQuery } from "./query-builders/first";
import { InsertBuilder } from "./query-builders/insert";
import { InsertReturningQuery } from "./query-builders/insert-returning";
import { RawQuery } from "./query-builders/raw";
import { RelationQueryBuilder } from "./query-builders/rq";
import { SelectBuilder } from "./query-builders/select";
import { UpdateBuilder } from "./query-builders/update";
import {
  type AnyColumn,
  type AnyRelations,
  type IsTableWC,
  Relations,
  type StdRelations,
  type StdTableWithColumns,
  Table,
  type TableWCorNever,
  type TableWithColumns,
  type TColsToLeftRight,
} from "./table";

// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnyDBorTX = Base<any, any, any, false>;

export type StdTableFullName = `"${string}"."${string}"`;

class Base<
  TTName extends string,
  TTables extends Record<
    TTName,
    TableWithColumns<string, string, Record<string, AnyColumn>>
  >,
  TAllRelations extends Record<StdTableFullName, AnyRelations>,
  TPrepare extends boolean,
> {
  #allRelations: TAllRelations;
  #config: Config;
  #connector: Connector;
  #executor: QueryExecutor | null;

  _ = {
    getConnector: () => this.#connector,
    getExecutor: this.#getExecutor.bind(this),
  };

  $: {
    tables: TTables;
    allRelations: TAllRelations;
    config: Config;
    pre: TPrepare;
  };

  constructor(
    tables: TTables,
    allRelations: TAllRelations,
    executor: QueryExecutor | null,
    connector: Connector,
    prepare: TPrepare,
  ) {
    this.#allRelations = allRelations;
    this.#config = connector.config;
    this.#executor = executor;
    this.#connector = connector;

    this.$ = {
      tables,
      allRelations,
      config: connector.config,
      pre: prepare,
    };
  }

  #getExecutor(): QueryExecutor {
    if (this.$.pre === true) {
      return null as unknown as QueryExecutor;
    } else if (this.#executor === null) {
      throw new Error("Cannot execute query: no database connection available");
    }
    return this.#executor;
  }

  /**
   * Start building an INSERT query for the specified table.
   * @param table The table to insert into
   * @returns An InsertBuilder instance to chain `.values()` and execute the insert
   */
  insert<TTable extends TTables[keyof TTables]>(table: TTable) {
    return new InsertBuilder(table, this.#config, this.#getExecutor());
  }

  /**
   * Start building a SELECT query from the specified table.
   * @param table The table to select from
   * @returns A FromBuilder instance to chain `.select()`, `.where()`, `.orderBy()`, etc.
   */
  from<
    UTSchema extends string,
    UTName extends string,
    UTColumns extends Record<string, AnyColumn>,
  >(table: TableWithColumns<UTSchema, UTName, UTColumns>) {
    return new SelectBuilder(
      table,
      null,
      undefined,
      this.#config,
      this.#getExecutor(),
      this.$.pre,
    );
  }

  /**
   * Start building an UPDATE query for the specified table.
   * @param table The table to update
   * @returns An UpdateBuilder instance to chain `.set()` and `.where()` clauses
   */
  update<TTable extends TTables[keyof TTables]>(table: TTable) {
    return new UpdateBuilder(
      table,
      this.#config,
      this.#getExecutor(),
      this.$.pre,
    );
  }

  /**
   * Start building a DELETE query for the specified table.
   * @param table The table to delete from
   * @returns A DeleteQuery instance to chain `.where()` and execute the deletion
   */
  delete<TTable extends TTables[keyof TTables]>(table: TTable) {
    return new DeleteQuery(
      table,
      undefined,
      undefined,
      this.#config,
      this.#getExecutor(),
      this.$.pre,
    );
  }

  /**
   * Count the number of rows in a table, optionally filtered by a where clause.
   * @param table The table to count rows from
   * @param where Optional where clause to filter rows
   * @returns Promise<number> - the count of matching rows
   */
  $count<TTable extends TTables[keyof TTables]>(
    table: TTable,
  ): CountQuery<TTable>;
  $count<
    TTable extends TTables[keyof TTables],
    TWhere extends BuildFilterExpression<
      TColsToLeftRight<TTable["_"]["columns"]>
    >,
  >(table: TTable, where: TWhere): CountQuery<TTable>;
  $count<TTable extends TTables[keyof TTables]>(
    table: TTable,
    where?: BuildFilterExpression<TColsToLeftRight<TTable["_"]["columns"]>>,
  ) {
    return new CountQuery(table, where, this.#config, this.#getExecutor());
  }

  /**
   * Check if any rows exist in a table, optionally filtered by a where clause.
   * @param table The table to check
   * @param where Optional where clause to filter rows
   * @returns Promise<boolean> - true if at least one row exists
   */
  $exists<TTable extends TTables[keyof TTables]>(
    table: TTable,
  ): ExistsQuery<TTable>;
  $exists<
    TTable extends TTables[keyof TTables],
    TWhere extends BuildFilterExpression<
      TColsToLeftRight<TTable["_"]["columns"]>
    >,
  >(table: TTable, where: TWhere): ExistsQuery<TTable>;
  $exists<TTable extends TTables[keyof TTables]>(
    table: TTable,
    where?: BuildFilterExpression<TColsToLeftRight<TTable["_"]["columns"]>>,
  ) {
    return new ExistsQuery(table, where, this.#config, this.#getExecutor());
  }

  /**
   * Get the first row from a table, optionally filtered by a where clause.
   * @param table The table to query
   * @param where Optional where clause to filter rows
   * @returns Promise<T | null> - the first row or null if no rows match
   */
  $first<TTable extends TTables[keyof TTables]>(
    table: TTable,
  ): FirstQuery<TTable>;
  $first<
    TTable extends TTables[keyof TTables],
    TWhere extends BuildFilterExpression<
      TColsToLeftRight<TTable["_"]["columns"]>
    >,
  >(table: TTable, where: TWhere): FirstQuery<TTable>;
  $first<TTable extends TTables[keyof TTables]>(
    table: TTable,
    where?: BuildFilterExpression<TColsToLeftRight<TTable["_"]["columns"]>>,
  ) {
    return new FirstQuery(table, where, this.#config, this.#getExecutor());
  }

  /**
   * Calculate the sum of a numeric column.
   * @param table The table to query
   * @param column The numeric column to sum
   * @param where Optional where clause to filter rows
   * @returns Promise<number | null> - the sum or null if no rows match
   */
  $sum<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
  >(
    table: TTable,
    column: TColumn,
  ): AggregateQuery<TTable, TColumn, number | null>;
  $sum<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
    TWhere extends BuildFilterExpression<
      TColsToLeftRight<TTable["_"]["columns"]>
    >,
  >(
    table: TTable,
    column: TColumn,
    where: TWhere,
  ): AggregateQuery<TTable, TColumn, number | null>;
  $sum<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
  >(
    table: TTable,
    column: TColumn,
    where?: BuildFilterExpression<TColsToLeftRight<TTable["_"]["columns"]>>,
  ) {
    return new AggregateQuery(
      table,
      column,
      "SUM",
      where,
      this.#config,
      this.#getExecutor(),
    );
  }

  /**
   * Calculate the average of a numeric column.
   * @param table The table to query
   * @param column The numeric column to average
   * @param where Optional where clause to filter rows
   * @returns Promise<number | null> - the average or null if no rows match
   */
  $avg<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
  >(
    table: TTable,
    column: TColumn,
  ): AggregateQuery<TTable, TColumn, number | null>;
  $avg<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
    TWhere extends BuildFilterExpression<
      TColsToLeftRight<TTable["_"]["columns"]>
    >,
  >(
    table: TTable,
    column: TColumn,
    where: TWhere,
  ): AggregateQuery<TTable, TColumn, number | null>;
  $avg<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
  >(
    table: TTable,
    column: TColumn,
    where?: BuildFilterExpression<TColsToLeftRight<TTable["_"]["columns"]>>,
  ) {
    return new AggregateQuery(
      table,
      column,
      "AVG",
      where,
      this.#config,
      this.#getExecutor(),
    );
  }

  /**
   * Find the minimum value of a column.
   * @param table The table to query
   * @param column The column to find the minimum of
   * @param where Optional where clause to filter rows
   * @returns Promise<number | null> - the minimum value or null if no rows match
   */
  $min<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
  >(
    table: TTable,
    column: TColumn,
  ): AggregateQuery<TTable, TColumn, number | null>;
  $min<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
    TWhere extends BuildFilterExpression<
      TColsToLeftRight<TTable["_"]["columns"]>
    >,
  >(
    table: TTable,
    column: TColumn,
    where: TWhere,
  ): AggregateQuery<TTable, TColumn, number | null>;
  $min<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
  >(
    table: TTable,
    column: TColumn,
    where?: BuildFilterExpression<TColsToLeftRight<TTable["_"]["columns"]>>,
  ) {
    return new AggregateQuery(
      table,
      column,
      "MIN",
      where,
      this.#config,
      this.#getExecutor(),
    );
  }

  /**
   * Find the maximum value of a column.
   * @param table The table to query
   * @param column The column to find the maximum of
   * @param where Optional where clause to filter rows
   * @returns Promise<number | null> - the maximum value or null if no rows match
   */
  $max<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
  >(
    table: TTable,
    column: TColumn,
  ): AggregateQuery<TTable, TColumn, number | null>;
  $max<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
    TWhere extends BuildFilterExpression<
      TColsToLeftRight<TTable["_"]["columns"]>
    >,
  >(
    table: TTable,
    column: TColumn,
    where: TWhere,
  ): AggregateQuery<TTable, TColumn, number | null>;
  $max<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
  >(
    table: TTable,
    column: TColumn,
    where?: BuildFilterExpression<TColsToLeftRight<TTable["_"]["columns"]>>,
  ) {
    return new AggregateQuery(
      table,
      column,
      "MAX",
      where,
      this.#config,
      this.#getExecutor(),
    );
  }

  /**
   * Get distinct values of a column.
   * @param table The table to query
   * @param column The column to get distinct values from
   * @param where Optional where clause to filter rows
   * @returns Promise<T[]> - array of distinct values
   */
  $distinct<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
  >(
    table: TTable,
    column: TColumn,
  ): DistinctQuery<TTable, TColumn, TColumn["ValTypeSelect"][]>;
  $distinct<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
    TWhere extends BuildFilterExpression<
      TColsToLeftRight<TTable["_"]["columns"]>
    >,
  >(
    table: TTable,
    column: TColumn,
    where: TWhere,
  ): DistinctQuery<TTable, TColumn, TColumn["ValTypeSelect"][]>;
  $distinct<
    TTable extends TTables[keyof TTables],
    TColumn extends TTable["_"]["columns"][keyof TTable["_"]["columns"]],
  >(
    table: TTable,
    column: TColumn,
    where?: BuildFilterExpression<TColsToLeftRight<TTable["_"]["columns"]>>,
  ) {
    return new DistinctQuery(
      table,
      column,
      where,
      this.#config,
      this.#getExecutor(),
    );
  }

  /**
   * Insert a row and return the inserted row with all columns.
   * @param table The table to insert into
   * @param values The values to insert
   * @returns Promise<T> - the inserted row with all columns including generated values
   */
  $insertReturning<TTable extends TTables[keyof TTables]>(
    table: TTable,
    values: {
      [colName in keyof TTable["_"]["columns"] as TTable["_"]["columns"][colName]["ValTypeInsert"] extends never
        ? never
        : undefined extends TTable["_"]["columns"][colName]["ValTypeInsert"]
          ? never
          : colName]: TTable["_"]["columns"][colName]["ValTypeInsert"];
    } & {
      [colName in keyof TTable["_"]["columns"] as TTable["_"]["columns"][colName]["ValTypeInsert"] extends never
        ? never
        : undefined extends TTable["_"]["columns"][colName]["ValTypeInsert"]
          ? colName
          : never]?: Exclude<
        TTable["_"]["columns"][colName]["ValTypeInsert"],
        undefined
      >;
    },
  ): InsertReturningQuery<
    TTable,
    {
      [ColName in keyof TTable["_"]["columns"]]: TTable["_"]["columns"][ColName]["ValTypeSelect"];
    }
  > {
    return new InsertReturningQuery(
      table,
      values as Record<string, unknown>,
      this.#config,
      this.#getExecutor(),
    );
  }

  /**
   * Start building a relational query for the specified table.
   *
   * Returns a builder with two methods:
   * - `.findMany(options)` — fetch all matching rows
   * - `.findFirst(options)` — fetch the first matching row (or `null`)
   *
   * Column selection works in two exclusive modes:
   * - **Include mode** — `columns: { id: true, name: true }` returns only these columns.
   * - **Exclude mode** — `columns: { password: false }` returns all columns except these.
   *
   * Use the `with` option to include related rows from other tables.
   * You can nest `with` to load deeply related data.
   *
   * @param table The table to query — must have relations registered via `relations()`.
   * @returns A `RelationQueryBuilder` with `.findMany()` and `.findFirst()` methods.
   */
  query<
    UTSchema extends string,
    UTName extends string,
    TColumns extends Record<string, AnyColumn>,
  >(table: TableWithColumns<UTSchema, UTName, TColumns>) {
    return new RelationQueryBuilder(
      table,
      this.#allRelations[table._.fullName],
      this.#allRelations,
      this.#config,
      this.#getExecutor(),
    );
  }

  /**
   * Execute a raw SQL query with optional parameter binding and custom result handler.
   * @param query The raw SQL query string with $1, $2, etc. placeholders for parameters
   * @param args Array of parameter values to bind to the query placeholders
   * @param rowsHandler Optional function to transform the raw result rows
   * @returns A RawQuery instance that resolves to the query result (or transformed result if handler provided)
   */
  raw<TReturn = unknown>(
    query: string,
    args: (string | number | null)[] = [],
    rowsHandler: ((rows: any[]) => TReturn) | undefined,
  ) {
    return new RawQuery(query, args, rowsHandler, this.#getExecutor());
  }
}

class DB<
  TTName extends string,
  TTables extends Record<
    TTName,
    TableWithColumns<string, string, Record<string, AnyColumn>>
  >,
  TAllRelations extends Record<StdTableFullName, AnyRelations>,
> extends Base<TTName, TTables, TAllRelations, false> {
  #pool: $Pool;

  constructor(
    tables: TTables,
    allRelations: TAllRelations,
    pool: $Pool,
    connector: Connector,
  ) {
    super(tables, allRelations, pool, connector, false);
    this.#pool = pool;
  }

  prepare() {
    return new Preparer(
      this.$.tables,
      this.$.allRelations,
      this._.getConnector(),
    );
  }

  /**
   * Execute multiple queries within a single database transaction in a new connection.
   * @param callback Function that receives a transaction context and to be used instead of db.
   * @returns Promise that resolves to the callback's return value
   */
  async transaction<T>(
    callback: (
      ...args: [Transaction<TTName, TTables, TAllRelations>]
    ) => Promise<T>,
  ): Promise<T> {
    const client = await this.#pool.acquireClient();

    try {
      await client.query("BEGIN;");
      const tx = new Transaction(
        this.$.tables,
        this.$.allRelations,
        client,
        this._.getConnector(),
        false,
      );
      const result = await callback(tx);
      await client.query("COMMIT;");
      await client.close();

      return result;
    } catch (error) {
      await client.query("ROLLBACK;");
      await client.close();
      throw error;
    }
  }

  async close(): Promise<true> {
    await this._.getExecutor()?.close();
    return true;
  }
}

class Transaction<
  TTNames extends string,
  TTables extends Record<
    TTNames,
    TableWithColumns<string, string, Record<string, AnyColumn>>
  >,
  TAllRelations extends Record<StdTableFullName, AnyRelations>,
> extends Base<TTNames, TTables, TAllRelations, false> {}

class Preparer<
  TTNames extends string,
  TTables extends Record<
    TTNames,
    TableWithColumns<string, string, Record<string, AnyColumn>>
  >,
  TAllRelations extends Record<StdTableFullName, AnyRelations>,
> extends Base<TTNames, TTables, TAllRelations, true> {
  constructor(
    tables: TTables,
    allRelations: TAllRelations,
    connector: Connector,
  ) {
    super(tables, allRelations, null, connector, true);
  }
}

export function database<TEntities extends Record<string, unknown>>(
  entities: TEntities,
  setup: DurcnoSetup,
) {
  const tables = Object.fromEntries(
    Object.entries(entities)
      .map(([name, entity]) => {
        if (is(entity, Table)) {
          entity._.config = setup.config;
          return [name, entity] as [string, StdTableWithColumns];
        }
        return undefined;
      })
      .filter(
        (entry): entry is [string, StdTableWithColumns] => entry !== undefined,
      ),
  );

  const allRelations = Object.fromEntries(
    Object.entries(entities)
      .map(([_, entity]) => {
        if (typeof entity === "function" && is(entity(), Relations)) {
          return [entity().table._.fullName, entity()] as [
            string,
            StdRelations,
          ];
        }
        return undefined;
      })
      .filter((entry): entry is [string, StdRelations] => entry !== undefined),
  );
  return new DB(
    tables,
    allRelations,
    setup.connector.getPool(),
    setup.connector,
  ) as unknown as DB<
    string,
    {
      [Export in keyof TEntities as IsTableWC<TEntities[Export]> extends true
        ? Export
        : never]: TableWCorNever<TEntities[Export]>;
    },
    {
      [Export in keyof TEntities as TEntities[Export] extends (
        ...args: unknown[]
      ) => infer TRelations
        ? TRelations extends Relations<
            infer TSchema,
            infer TName,
            infer _x,
            infer _y
          >
          ? `\"${TSchema}\".\"${TName}\"`
          : never
        : never]: TEntities[Export] extends (
        ...args: unknown[]
      ) => infer TRelations
        ? TRelations extends Relations<
            infer TTSchema,
            infer TTName,
            infer TTColumns,
            infer TTRelations
          >
          ? Relations<TTSchema, TTName, TTColumns, TTRelations>
          : never
        : never;
    }
  >;
}
