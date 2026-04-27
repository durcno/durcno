import type { AnyColumn, StdTable, TableColumn } from "./table";
import type { Key } from "./types";

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

export class Index<Col extends AnyColumn> {
  readonly #columns: TableColumn<string, string, Key, Col>[];
  #using: IndexType;
  #unique: boolean;
  constructor(
    columns: TableColumn<string, string, Key, Col>[],
    using: IndexType,
    unique: boolean,
  ) {
    this.#columns = columns;
    this.#using = using;
    this.#unique = unique;
  }

  _ = {
    getColumns: () => this.#columns,
    getUsing: () => this.#using,
    getUnique: () => this.#unique,
    getName: (table: StdTable) => {
      return `${table._.name}_${this.#columns
        .map((col) => col.nameSnake)
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
}

export function index<Col extends AnyColumn>(
  columns: TableColumn<string, string, Key, Col>[],
  using?: IndexType,
) {
  return new Index(columns, using ?? "btree", false);
}

export function uniqueIndex<Col extends AnyColumn>(
  columns: TableColumn<string, string, Key, Col>[],
  using?: IndexType,
) {
  return new Index(columns, using ?? "btree", true);
}
