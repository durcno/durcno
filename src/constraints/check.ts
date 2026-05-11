import { isTableCol } from "../entity";
import type { AnyFilter, Filter } from "../filters/index";
import { Query } from "../query-builders/query";
import { Sql } from "../sql";
import type {
  StdTable,
  StdTableColumn,
  StdTableWithColumns,
  TableAnyColumn,
} from "../table";

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

  /** Renders the constraint expression to a SQL string. */
  toSQL(): string {
    if (this.#expr instanceof Sql) {
      return this.#expr.string;
    }
    const query = new Query("", () => []);
    this.#expr.toQuery(query);
    return query.sql;
  }
}

/** Creates a {@link Check} constraint from a filter expression or raw SQL. */
export function check(name: string, expr: AnyFilter | Sql): Check {
  return new Check(name, expr);
}

// ============================================================================
// Table proxy helpers for check constraints
// ============================================================================

/**
 * Wraps a column proxy so that `fullName` returns the unqualified quoted name,
 * e.g. `"price"` instead of `"public"."price"`.
 * Required so filter conditions in check constraints emit unqualified column names.
 */
function proxyColumnForCheck(col: StdTableColumn): StdTableColumn {
  return new Proxy(col, {
    get(target, prop) {
      if (prop === "fullName") return `"${target.nameSnake}"`;
      if (prop === "toQuery")
        return (val: Query) => (val.sql += `"${target.nameSnake}"`);
      const val = Reflect.get(target, prop, target);
      if (typeof val === "function")
        return (val as (...args: unknown[]) => unknown).bind(target);
      return val;
    },
  }) as StdTableColumn;
}

/**
 * Wraps a table so that any column access returns a check-safe column proxy.
 * Pass the result to the `checkConstraints` callback so filters produce correct SQL.
 */
export function createCheckTableProxy(
  table: StdTable | StdTableWithColumns,
): StdTableWithColumns {
  return new Proxy(table, {
    get(target, prop) {
      const val = Reflect.get(target, prop, target);
      if (isTableCol(val)) return proxyColumnForCheck(val as StdTableColumn);
      if (typeof val === "function")
        return (val as (...args: unknown[]) => unknown).bind(target);
      return val;
    },
  }) as StdTableWithColumns;
}
