import type { AnyColumn, AnyTableWithColumns, TableColumn } from "../table";
import type { Key } from "../types";

// ============================================================================
// Primary Key Constraint
// ============================================================================

export class PrimaryKeyConstraint {
  readonly #name: string;
  readonly #columns: TableColumn<string, string, Key, AnyColumn>[];

  constructor(
    name: string,
    columns: TableColumn<string, string, Key, AnyColumn>[],
  ) {
    if (columns.length < 2) {
      throw new Error(
        "PRIMARY KEY constraint requires at least two columns. For single-column primary key, use the column-level 'pk()' function instead.",
      );
    }
    this.#name = name;
    this.#columns = columns;
  }

  getName<TTable extends AnyTableWithColumns>(table: TTable): string {
    return this.#name.startsWith(`${table._.name}_`)
      ? this.#name
      : `${table._.name}_${this.#name}`;
  }

  getColumns(): string[] {
    return this.#columns.map((col) => col.nameSnake as string);
  }
}

/**
 * Creates a named table-level PRIMARY KEY constraint on two or more columns.
 * A table can have at most one primary key constraint.
 * For single-column primary key, use the column-level `pk()` function instead.
 *
 * This function is passed as the second parameter to the `primaryKeyConstraint` callback.
 *
 * @example
 * ```ts
 * table("public", "user_roles", { userId: bigint({}), roleId: bigint({}) }, {
 *   primaryKeyConstraint: (t, primaryKey) =>
 *     primaryKey("pk", [t.userId, t.roleId]),
 * });
 * ```
 */
export function primaryKeyConstraint(
  name: string,
  columns: [
    TableColumn<string, string, Key, AnyColumn>,
    TableColumn<string, string, Key, AnyColumn>,
    ...TableColumn<string, string, Key, AnyColumn>[],
  ],
) {
  return new PrimaryKeyConstraint(name, columns);
}

export type PrimaryKeyConstraintFn = typeof primaryKeyConstraint;
