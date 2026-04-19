import type { AnyColumn, AnyTableWithColumns, TableColumn } from "../table";

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
 * Creates a named table-level UNIQUE constraint on two or more columns.
 * For single-column unique, use the column-level `unique` modifier instead.
 *
 * This function is passed as the second parameter to the `uniqueConstraints` callback.
 *
 * @example
 * ```ts
 * table("public", "user_roles", { userId: bigint({}), roleId: bigint({}) }, {
 *   uniqueConstraints: (t, unique) => [
 *     unique("unique_user_role", [t.userId, t.roleId]),
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
