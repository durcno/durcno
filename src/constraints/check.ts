import type { AnyFilter, Filter } from "../filters/index";
import { Query, type QueryContext } from "../query-builders/query";
import { Sql } from "../sql";
import type { TableAnyColumn } from "../table";

/**
 * A check constraint expression that can be a filter condition or a raw SQL snippet.
 * Used in `checkConstraints` table extra to define `CHECK` constraints.
 */
export type CheckExpression<TScopeColumns extends TableAnyColumn> =
  | Filter<TScopeColumns, false>
  | Sql;

// ============================================================================
// Check Constraint Class
// ============================================================================

/** A CHECK constraint for a table, storing its name and filter/SQL expression. */
export class Check {
  readonly #name: string;
  readonly #expr: AnyFilter | Sql;

  constructor(name: string, expr: AnyFilter | Sql) {
    this.#name = name;
    this.#expr = expr;
  }

  /** Returns the constraint name, appending `_check` suffix if not already present. */
  getName(): string {
    return this.#name.includes("check") ? this.#name : `${this.#name}_check`;
  }

  /**
   * Renders the constraint expression to a SQL string.
   * Pass a {@link QueryContext} with `null` alias entries to suppress table qualifiers
   * on specific tables (used by the snapshot builder for CHECK constraint SQL).
   */
  toSQL(ctx?: QueryContext): string {
    if (this.#expr instanceof Sql) {
      return this.#expr.string;
    }
    const query = new Query("", () => []);
    this.#expr.toQuery(query, ctx);
    return query.sql;
  }
}

/** Creates a {@link Check} constraint from a filter expression or raw SQL. */
export function check(name: string, expr: AnyFilter | Sql): Check {
  return new Check(name, expr);
}
