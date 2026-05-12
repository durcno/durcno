import type { Arg } from "./pre";

export type SqlArgType = string | number | null;

/**
 * Rendering context passed to `toQuery` for alias overrides.
 * Used when building nested relational subqueries where the real table name
 * is aliased to a path-based alias (e.g. `"posts__comments"`), and in check
 * constraint expressions where columns must render without a table qualifier.
 */
export type QueryContext = {
  /**
   * Maps `"schema.table"` (plain dot-separated, e.g. `"public.comments"`) to an SQL alias
   * string (e.g. `"posts__comments"`) or `null`.
   * - A string value replaces the default table qualifier in the rendered SQL.
   * - `null` suppresses the table qualifier entirely, emitting only the quoted column name
   *   (used for CHECK constraint expressions).
   */
  tableAliases?: Map<string, string | null>;
};

export class Query<TReturn = unknown> {
  readonly returnType!: TReturn;
  sql: string;
  arguments: SqlArgType[] = [];
  rowsHandler: (rows: any[]) => TReturn;
  constructor(sql: string, rowsHandler: (rows: any[]) => TReturn) {
    this.sql = sql;
    this.rowsHandler = rowsHandler;
  }

  /** Appends a prepared-query `Arg` placeholder with optional cast suffix. */
  addArg(arg: Arg<any>) {
    const castSuffix = arg.cast ? `::${arg.cast}` : "";
    this.sql += `$${arg.index}${castSuffix}`;
    this.arguments.push(arg.key);
  }

  /** Pushes an argument value and returns the `$N[::cast]` placeholder string. */
  pushArg(value: SqlArgType, cast: string | null): string {
    this.arguments.push(value);
    const idx = this.arguments.length;
    return cast && value !== null ? `$${idx}::${cast}` : `$${idx}`;
  }

  /** Returns a human-readable representation of the query for debugging. */
  prettify(): string {
    const args = this.arguments
      .map((v, i) => `  $${i + 1} = ${v === null ? "NULL" : JSON.stringify(v)}`)
      .join("\n");
    return args.length > 0
      ? `SQL:\n  ${this.sql}\nArguments:\n${args}`
      : `SQL:\n  ${this.sql}`;
  }
}
