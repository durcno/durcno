import type { StdTable, StdTableColumn } from "../table";

// ============================================================================
// Primary Key Constraint
// ============================================================================

export class PrimaryKeyConstraint {
  readonly #name: string;
  readonly #columns: StdTableColumn[];

  constructor(name: string, columns: StdTableColumn[]) {
    if (columns.length < 2) {
      throw new Error(
        "PRIMARY KEY constraint requires at least two columns. For single-column primary key, use the column-level 'pk()' function instead.",
      );
    }
    this.#name = name;
    this.#columns = columns;
  }

  getName(table: StdTable): string {
    return this.#name.startsWith(`${table._.name}_`)
      ? this.#name
      : `${table._.name}_${this.#name}`;
  }

  getColumns(): string[] {
    return this.#columns.map((col) => col.nameSql);
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
  columns: [StdTableColumn, StdTableColumn, ...StdTableColumn[]],
) {
  return new PrimaryKeyConstraint(name, columns);
}

export type PrimaryKeyConstraintFn = typeof primaryKeyConstraint;
