import type { StdTableColumn } from "../table";

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

  /** Returns the constraint name as-is. */
  getName(): string {
    return this.#name;
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
 * Convention: `pk_<table>`
 *
 * @example
 * ```ts
 * table("public", "userRoles", { userId: bigint({}), roleId: bigint({}) }, {
 *   primaryKeyConstraint: (t, primaryKey) =>
 *     primaryKey("pk_user_roles", [t.userId, t.roleId]),
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
