import type { AnyColumn, TableColumn } from "../table";
import type { Key } from "../types";

// ============================================================================
// Unique Constraint
// ============================================================================

export class UniqueConstraint {
  readonly #name: string;
  readonly #columns: TableColumn<string, string, Key, AnyColumn>[];

  constructor(
    name: string,
    columns: TableColumn<string, string, Key, AnyColumn>[],
  ) {
    if (columns.length < 2) {
      throw new Error(
        "UNIQUE constraint requires at least two columns. For single-column unique, use the column-level 'unique' modifier instead.",
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
 * Creates a named table-level UNIQUE constraint on two or more columns.
 * For single-column unique, use the column-level `unique` modifier instead.
 *
 * This function is passed as the second parameter to the `uniqueConstraints` callback.
 *
 * Convention: `unique_<table>_<col1>[_and_<col2>]*`
 *
 * @example
 * ```ts
 * table("public", "userRoles", { userId: bigint({}), roleId: bigint({}) }, {
 *   uniqueConstraints: (t, unique) => [
 *     unique("unique_user_roles_user_id_and_role_id", [t.userId, t.roleId]),
 *   ],
 * });
 * ```
 */
export function uniqueConstraint(
  name: string,
  columns: [
    TableColumn<string, string, Key, AnyColumn>,
    TableColumn<string, string, Key, AnyColumn>,
    ...TableColumn<string, string, Key, AnyColumn>[],
  ],
) {
  return new UniqueConstraint(name, columns);
}

export type UniqueConstraintFn = typeof uniqueConstraint;
