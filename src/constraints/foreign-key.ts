import type { Column, OnDeleteAction } from "../columns/common";
import type { AnyColumn, StdTableColumn } from "../table";

// ============================================================================
// Foreign Key Constraint
// ============================================================================

/**
 * Intermediate builder returned by `fk(column)`.
 * Call `.references(refColumn)` to finalise into a `ForeignKey`.
 */
export class ForeignKeyBuilder<TCol extends AnyColumn> {
  readonly #column: StdTableColumn<TCol>;

  constructor(column: StdTableColumn<TCol>) {
    this.#column = column;
  }

  /**
   * Specify the referenced column.
   * The referenced column's value type must match the source column's value type.
   */
  references<TRefCol extends Column<any, TCol["ValType"]>>(
    ref: StdTableColumn<TRefCol>,
  ): ForeignKey {
    return new ForeignKey(
      this.#column as unknown as StdTableColumn,
      ref as unknown as StdTableColumn,
      "CASCADE",
    );
  }
}

/**
 * Represents a finalised table-level foreign key constraint.
 * Created via `fk(column).references(refColumn)`.
 */
export class ForeignKey {
  readonly #column: StdTableColumn;
  readonly #reference: StdTableColumn;
  #onDelete: OnDeleteAction;

  constructor(
    column: StdTableColumn,
    reference: StdTableColumn,
    onDelete: OnDeleteAction,
  ) {
    this.#column = column;
    this.#reference = reference;
    this.#onDelete = onDelete;
  }

  /**
   * Override the default `CASCADE` delete action.
   *
   * @param action - The `ON DELETE` action to apply.
   * @returns `this` for chaining.
   */
  onDelete(action: OnDeleteAction): this {
    this.#onDelete = action;
    return this;
  }

  _ = {
    /** Returns the source column of the foreign key. */
    getColumn: (): StdTableColumn => this.#column,
    /** Returns the referenced column of the foreign key. */
    getReference: (): StdTableColumn => this.#reference,
    /** Returns the configured `ON DELETE` action. */
    getOnDelete: (): OnDeleteAction => this.#onDelete,
  };
}

/**
 * Entry point for defining a table-level foreign key constraint.
 * Use inside the `foreignKeys` callback in `TableExtra`.
 *
 * Because `foreignKeys` receives the fully-constructed table as a typed
 * parameter `t`, column references are already resolved — no thunk needed.
 *
 * @param column - The source column on this table.
 * @returns A `ForeignKeyBuilder` to chain `.references(refColumn)` on.
 *
 * @example
 * ```ts
 * table("public", "comments", { ... }, {
 *   foreignKeys: (t, fk) => [
 *     fk(t.parentId).references(t.id).onDelete("SET NULL"),
 *   ],
 * });
 * ```
 */
export function fk<TCol extends AnyColumn>(
  column: StdTableColumn<TCol>,
): ForeignKeyBuilder<TCol> {
  return new ForeignKeyBuilder(column);
}

/** The type of the `fk` helper injected into the `foreignKeys` callback. */
export type ForeignKeyFn = typeof fk;
