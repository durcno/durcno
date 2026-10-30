import { IndexOn } from "./columns/common";
import type { Filter } from "./filters/index";
import { SqlFn } from "./functions/index";
import { Query, type QueryContext } from "./query-builders/query";
import { Sql } from "./sql";
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

/**
 * A scalar SQL function accepted as an index key.
 * Aggregates, window functions, and prepared `Arg` values are not valid in
 * index expressions.
 */
export type IndexExpressionFn = SqlFn<
  AnyColumn,
  "scalar",
  string,
  unknown,
  false,
  false
>;

/**
 * A key in an index: a column, a column with an operator class, or an SQL
 * expression. Prefer scalar `SqlFn` builders over raw `Sql`.
 */
export type IndexColumn = StdTableColumn | IndexOn | Sql | IndexExpressionFn;

/**
 * Returns whether an index key is an SQL expression rather than a column.
 * @internal
 */
export function isIndexExpression(
  value: unknown,
): value is Sql | IndexExpressionFn {
  return value instanceof Sql || value instanceof SqlFn;
}

/**
 * Renders an index expression to SQL.
 * @internal
 * @param expression - The `Sql` or scalar `SqlFn` expression.
 * @param ctx - Optional context used to suppress table qualifiers.
 */
export function renderIndexExpression(
  expression: Sql | IndexExpressionFn,
  ctx?: QueryContext,
): string {
  if (
    expression instanceof SqlFn &&
    (expression._.sqlFnType !== "scalar" ||
      expression._.hasAggregate ||
      expression._.hasWindow)
  ) {
    throw new Error(
      "Index expressions support scalar functions only; aggregate and window functions are not allowed.",
    );
  }
  const query = new Query("", () => []);
  expression.toQuery(query, ctx);
  if (query.getPreparedSlots().length > 0) {
    throw new Error(
      "Index expressions cannot contain prepared arguments (Arg).",
    );
  }
  return query.sql;
}

export class Index {
  readonly #name?: string;
  readonly #columns: IndexColumn[];
  #using: IndexType;
  #unique: boolean;
  #where?: IndexWhereExpression;

  constructor(
    columns: IndexColumn[],
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
      const names: string[] = [];
      for (const col of this.#columns) {
        if (col instanceof IndexOn) {
          names.push(col.column.nameSql);
        } else if (isIndexExpression(col)) {
          throw new Error(
            `Expression indexes require an explicit name. Pass a name as the first argument to index() or uniqueIndex() for table "${table._.fullName}".`,
          );
        } else {
          names.push(col.nameSql);
        }
      }
      return `${table._.nameSql}_${names.join("_")}_index`;
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
 * Creates an index with a custom name on one or more columns or expressions.
 *
 * @param name - The custom index name.
 * @param columns - Array of columns, operator-class keys, or SQL expressions.
 * @param using - Optional index type (default: `"btree"`).
 */
export function index(
  name: string,
  columns: IndexColumn[],
  using?: IndexType,
): Index;
/**
 * Creates an index on one or more columns with an auto-generated name.
 * Expression keys require a custom name.
 *
 * @param columns - Array of table columns to index.
 * @param using - Optional index type (default: `"btree"`).
 */
export function index(columns: IndexColumn[], using?: IndexType): Index;
export function index(
  nameOrColumns: string | IndexColumn[],
  columnsOrUsing?: IndexColumn[] | IndexType,
  using?: IndexType,
): Index {
  if (typeof nameOrColumns === "string") {
    return new Index(
      columnsOrUsing as IndexColumn[],
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
 * Creates a unique index with a custom name on one or more columns or expressions.
 *
 * @param name - The custom index name.
 * @param columns - Array of columns, operator-class keys, or SQL expressions.
 * @param using - Optional index type (default: `"btree"`).
 */
export function uniqueIndex(
  name: string,
  columns: IndexColumn[],
  using?: IndexType,
): Index;
/**
 * Creates a unique index on one or more columns with an auto-generated name.
 * Expression keys require a custom name.
 *
 * @param columns - Array of table columns to index.
 * @param using - Optional index type (default: `"btree"`).
 */
export function uniqueIndex(columns: IndexColumn[], using?: IndexType): Index;
export function uniqueIndex(
  nameOrColumns: string | IndexColumn[],
  columnsOrUsing?: IndexColumn[] | IndexType,
  using?: IndexType,
): Index {
  if (typeof nameOrColumns === "string") {
    return new Index(
      columnsOrUsing as IndexColumn[],
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
