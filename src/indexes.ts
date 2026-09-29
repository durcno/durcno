import { IndexOn } from "./columns/common";
import type { Filter } from "./filters/index";
import type { Sql } from "./sql";
import type { AnyColumn, StdTable, StdTableColumn } from "./table";

export type IndexType =
  | "btree"
  | "hash"
  | "gist"
  | "spgist"
  | "gin"
  | "brin"
  | "hnsw"
  | "ivfflat"
  | (string & {});

/**
 * Expression accepted in an index WHERE predicate for partial indexes.
 * Supports type-safe `Filter` conditions without `Arg` placeholders, or raw `Sql`.
 */
export type IndexWhereExpression = Filter<AnyColumn, false> | Sql;

export class Index<Col extends AnyColumn = AnyColumn> {
  readonly #name?: string;
  readonly #columns: (StdTableColumn<Col> | IndexOn<Col>)[];
  #using: IndexType;
  #unique: boolean;
  #where?: IndexWhereExpression;

  constructor(
    columns: (StdTableColumn<Col> | IndexOn<Col>)[],
    using: IndexType,
    unique: boolean,
    name?: string,
  ) {
    this.#columns = columns;
    this.#using = using;
    this.#unique = unique;
    this.#name = name;
  }

  _ = {
    getColumns: () => this.#columns,
    getUsing: () => this.#using,
    getUnique: () => this.#unique,
    getWhere: () => this.#where,
    getName: (table: StdTable) => {
      if (this.#name) return this.#name;
      return `${table._.nameSql}_${this.#columns
        .map((col) =>
          col instanceof IndexOn ? col.column.nameSql : col.nameSql,
        )
        .join("_")}_index`;
    },
  };

  /**
   * Change the index type to use.
   *
   * SQL equivalent: `USING <index_type>`
   * ```sql
   * CREATE INDEX ON table_name (column)
   *   USING gist;
   * ```
   *
   * @param using - the index method to use (gin, gist, etc.)
   * @returns the current `Index` instance for chaining
   */
  using(using: IndexType) {
    this.#using = using;
    return this;
  }

  /**
   * Add a WHERE predicate to create a partial index.
   *
   * SQL equivalent: `WHERE <condition>`
   * ```sql
   * CREATE INDEX ON table_name (column)
   *   WHERE condition;
   * ```
   *
   * @param predicate - The filter condition or raw SQL expression, or callback returning one.
   * @returns the current `Index` instance for chaining
   */
  where(predicate: IndexWhereExpression | (() => IndexWhereExpression)) {
    this.#where = typeof predicate === "function" ? predicate() : predicate;
    return this;
  }
}

/**
 * Creates an index with a custom name on one or more columns.
 *
 * @param name - The custom index name.
 * @param columns - Array of table columns to index.
 * @param using - Optional index type (default: `"btree"`).
 */
export function index<Col extends AnyColumn>(
  name: string,
  columns: (StdTableColumn<Col> | IndexOn<Col>)[],
  using?: IndexType,
): Index<Col>;
/**
 * Creates an index on one or more columns with an auto-generated name.
 *
 * @param columns - Array of table columns to index.
 * @param using - Optional index type (default: `"btree"`).
 */
export function index<Col extends AnyColumn>(
  columns: (StdTableColumn<Col> | IndexOn<Col>)[],
  using?: IndexType,
): Index<Col>;
export function index<Col extends AnyColumn>(
  nameOrColumns: string | (StdTableColumn<Col> | IndexOn<Col>)[],
  columnsOrUsing?: (StdTableColumn<Col> | IndexOn<Col>)[] | IndexType,
  using?: IndexType,
): Index<Col> {
  if (typeof nameOrColumns === "string") {
    return new Index(
      columnsOrUsing as (StdTableColumn<Col> | IndexOn<Col>)[],
      using ?? "btree",
      false,
      nameOrColumns,
    );
  }
  return new Index(
    nameOrColumns,
    (columnsOrUsing as IndexType) ?? "btree",
    false,
  );
}

/**
 * Creates a unique index with a custom name on one or more columns.
 *
 * @param name - The custom index name.
 * @param columns - Array of table columns to index.
 * @param using - Optional index type (default: `"btree"`).
 */
export function uniqueIndex<Col extends AnyColumn>(
  name: string,
  columns: (StdTableColumn<Col> | IndexOn<Col>)[],
  using?: IndexType,
): Index<Col>;
/**
 * Creates a unique index on one or more columns with an auto-generated name.
 *
 * @param columns - Array of table columns to index.
 * @param using - Optional index type (default: `"btree"`).
 */
export function uniqueIndex<Col extends AnyColumn>(
  columns: (StdTableColumn<Col> | IndexOn<Col>)[],
  using?: IndexType,
): Index<Col>;
export function uniqueIndex<Col extends AnyColumn>(
  nameOrColumns: string | (StdTableColumn<Col> | IndexOn<Col>)[],
  columnsOrUsing?: (StdTableColumn<Col> | IndexOn<Col>)[] | IndexType,
  using?: IndexType,
): Index<Col> {
  if (typeof nameOrColumns === "string") {
    return new Index(
      columnsOrUsing as (StdTableColumn<Col> | IndexOn<Col>)[],
      using ?? "btree",
      true,
      nameOrColumns,
    );
  }
  return new Index(
    nameOrColumns,
    (columnsOrUsing as IndexType) ?? "btree",
    true,
  );
}
