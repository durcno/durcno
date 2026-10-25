import type { RawRow, SqlArgType } from "../types";
import type { AnyArg } from "./prepare";

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

/**
 * One positional placeholder of a prepared statement: a supplied `Arg`, or a
 * value resolved on every `run()` — produced dynamically or captured at
 * build time.
 */
export type PreparedSlot =
  | {
      readonly kind: "arg";
      readonly key: string;
      readonly handler: AnyArg["handler"];
    }
  | {
      readonly kind: "deferred";
      readonly value: () => SqlArgType;
    };

/** Formats a positional placeholder, adding a cast when present. */
function formatPlaceholder(index: number, cast: string | null): string {
  return cast ? `$${index}::${cast}` : `$${index}`;
}

export class Query<TReturn = unknown> {
  readonly returnType!: TReturn;
  sql: string;
  arguments: SqlArgType[] = [];
  rowsHandler: (rows: RawRow[]) => TReturn;
  #argIndices: Map<AnyArg, number> | null = null;
  #preparedSlots: PreparedSlot[] | null = null;
  #nextPlaceholder = 0;
  constructor(sql: string, rowsHandler: (rows: RawRow[]) => TReturn) {
    this.sql = sql;
    this.rowsHandler = rowsHandler;
  }

  /** Registers a placeholder slot in the shared `$N` sequence and returns its number. */
  #allocateSlot(slot: PreparedSlot): number {
    const index = ++this.#nextPlaceholder;
    let slots = this.#preparedSlots;
    if (slots === null) {
      slots = [];
      this.#preparedSlots = slots;
    }
    slots.push(slot);
    return index;
  }

  /**
   * Appends a prepared-query `Arg` placeholder with an optional cast, falling
   * back to the `Arg`'s own cast. The number is assigned on first use and
   * reused by later occurrences of the same `Arg`.
   */
  addArg(arg: AnyArg, cast: string | null = arg.cast) {
    let indices = this.#argIndices;
    if (indices === null) {
      indices = new Map();
      this.#argIndices = indices;
    }
    let index = indices.get(arg);
    if (index === undefined) {
      index = this.#allocateSlot({
        kind: "arg",
        key: arg.key,
        handler: arg.handler,
      });
      indices.set(arg, index);
      arg.index = index;
    }
    this.sql += formatPlaceholder(index, cast);
  }

  /**
   * Registers a value captured at build time as a placeholder in the shared
   * `$N` sequence and returns the `$N[::cast]` string. Prepared statements
   * re-bind the value on every `run()`; non-prepared queries send it directly.
   */
  pushArg(value: SqlArgType, cast: string | null): string {
    const index = this.#allocateSlot({ kind: "deferred", value: () => value });
    this.arguments[index - 1] = value;
    return formatPlaceholder(index, value === null ? null : cast);
  }

  /**
   * Appends a placeholder whose value is produced on every prepared `run()`.
   * @internal
   */
  addDeferredArg(value: () => SqlArgType, cast: string | null): string {
    const index = this.#allocateSlot({ kind: "deferred", value });
    return formatPlaceholder(index, cast);
  }

  /**
   * Returns the placeholders of a prepared statement in `$N` order.
   * @internal
   */
  getPreparedSlots(): readonly PreparedSlot[] {
    return this.#preparedSlots ?? [];
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

export type AnyQuery = Query<unknown>;
