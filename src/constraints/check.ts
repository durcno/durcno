import {
  type AnyFilter,
  appendFilterExpression,
  type FilterExpression,
} from "../filters/index";
import { Query, type QueryContext } from "../query-builders/query";
import type { Sql } from "../sql";
import type { AnyColumn, TableAnyColumn } from "../table";

/**
 * A check constraint expression that can be a filter condition, a raw SQL
 * snippet, or a boolean literal.
 */
export type CheckExpression<TScopeColumns extends TableAnyColumn | AnyColumn> =
  FilterExpression<TScopeColumns>;

// ============================================================================
// Check Constraint Class
// ============================================================================

/** A CHECK constraint for a table, storing its name and filter/SQL expression. */
export class Check {
  readonly #name: string;
  readonly #expr: AnyFilter | boolean | Sql;

  constructor(name: string, expr: AnyFilter | boolean | Sql) {
    this.#name = name;
    this.#expr = expr;
  }

  /** Returns the constraint name as-is. */
  getName(): string {
    return this.#name;
  }

  /**
   * Renders the constraint expression to a SQL string.
   * Pass a {@link QueryContext} with `null` alias entries to suppress table qualifiers
   * on specific tables (used by the snapshot builder for CHECK constraint SQL).
   */
  toSQL(ctx?: QueryContext): string {
    const query = new Query("", () => []);
    appendFilterExpression(this.#expr, query, ctx);
    return query.sql;
  }
}

/**
 * Creates a {@link Check} constraint from a filter expression or raw SQL.
 *
 * Convention: `check_<table>_<col>[_and_<col>]*[_<suffix>]?`
 *
 * @example
 * ```ts
 * table("public", "projects", { name: varchar({ length: 255 }) }, {
 *   checkConstraints: (t, check) => [
 *     check("check_projects_name_length", gte(length(t.name), 1)),
 *   ],
 * });
 * ```
 */
export function check(name: string, expr: AnyFilter | boolean | Sql): Check {
  return new Check(name, expr);
}
