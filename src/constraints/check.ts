import { isTableCol } from "../entity";
import type { Sql } from "../sql";
import type { StdTableColumn, TableColumn } from "../table";

// ============================================================================
// Operator Types
// ============================================================================

export type ComparisonOp =
  | "="
  | "<>"
  | "<"
  | ">"
  | "<="
  | ">="
  | "IN"
  | "NOT IN";
export type PatternOp = "LIKE" | "SIMILAR TO" | "~";
export type LogicalOp = "AND" | "OR";

// ============================================================================
// Expression Types
// ============================================================================

export interface ComparisonExpr {
  type: "comparison";
  left: StdTableColumn | FunctionExpr;
  op: ComparisonOp | PatternOp;
  right: unknown;
}

export interface LogicalExpr {
  type: "logical";
  op: LogicalOp;
  expressions: CheckExpr[];
}

export interface FunctionExpr {
  type: "function";
  name: string;
  args: (StdTableColumn | unknown)[];
}

export interface RawExpr {
  type: "raw";
  sql: string;
}

export type CheckExpr = ComparisonExpr | LogicalExpr | FunctionExpr | RawExpr;

// ============================================================================
// Snapshot Expression Types (JSON-serializable)
// ============================================================================

export type SnapshotComparisonOp =
  | "="
  | "<>"
  | "<"
  | ">"
  | "<="
  | ">="
  | "IN"
  | "NOT IN";
export type SnapshotPatternOp = "LIKE" | "SIMILAR TO" | "~";
export type SnapshotLogicalOp = "AND" | "OR";

/**
 * A tagged column reference stored in a snapshot expression.
 * Stores the snake_case column name so it can be quoted correctly in SQL output.
 */
export interface ExprColumnRef {
  type: "col";
  /** Snake_case column name as used in PostgreSQL (e.g. `user_id`). */
  name: string;
}

export interface SnapshotComparisonExpr {
  type: "comparison";
  left: ExprColumnRef | SnapshotFunctionExpr;
  op: SnapshotComparisonOp | SnapshotPatternOp;
  /** Column ref, or a pre-rendered SQL string (incl. `(v1, v2)` for IN lists). */
  right: ExprColumnRef | string;
}

export interface SnapshotLogicalExpr {
  type: "logical";
  op: SnapshotLogicalOp;
  expressions: SnapshotCheckExpr[];
}

export interface SnapshotFunctionExpr {
  type: "function";
  name: string;
  /** Column refs or pre-rendered SQL strings. */
  args: (ExprColumnRef | string)[];
}

export interface SnapshotRawExpr {
  type: "raw";
  sql: string;
}

export type SnapshotCheckExpr =
  | SnapshotComparisonExpr
  | SnapshotLogicalExpr
  | SnapshotFunctionExpr
  | SnapshotRawExpr;

// ============================================================================
// CheckBuilder Class
// ============================================================================

export class CheckBuilder {
  // Comparison methods - typesafe column references
  eq<TCol extends StdTableColumn>(
    col: TCol,
    value: TCol["ValType"],
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "=", right: value };
  }

  neq<TCol extends StdTableColumn>(
    col: TCol,
    value: TCol["ValType"],
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "<>", right: value };
  }

  gt<TCol extends StdTableColumn>(
    col: TCol,
    value: TCol["ValType"],
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: ">", right: value };
  }

  gte<TCol extends StdTableColumn>(
    col: TCol,
    value: TCol["ValType"],
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: ">=", right: value };
  }

  lt<TCol extends StdTableColumn>(
    col: TCol,
    value: TCol["ValType"],
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "<", right: value };
  }

  lte<TCol extends StdTableColumn>(
    col: TCol,
    value: TCol["ValType"],
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "<=", right: value };
  }

  like<TCol extends StdTableColumn>(
    col: TCol,
    pattern: string,
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "LIKE", right: pattern };
  }

  similarTo<TCol extends StdTableColumn>(
    col: TCol,
    pattern: string,
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "SIMILAR TO", right: pattern };
  }

  regex<TCol extends StdTableColumn>(
    col: TCol,
    pattern: string,
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "~", right: pattern };
  }

  // Set membership operators (lists of strings or numbers)
  in<TCol extends StdTableColumn>(
    col: TCol,
    values: TCol["ValType"][],
  ): ComparisonExpr {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("IN expression requires a non-empty array of values");
    }
    return { type: "comparison", left: col, op: "IN", right: values };
  }

  notIn<TCol extends StdTableColumn>(
    col: TCol,
    values: TCol["ValType"][],
  ): ComparisonExpr {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("NOT IN expression requires a non-empty array of values");
    }
    return { type: "comparison", left: col, op: "NOT IN", right: values };
  }

  // Logical operators
  and(...expressions: CheckExpr[]): LogicalExpr {
    return { type: "logical", op: "AND", expressions };
  }

  or(...expressions: CheckExpr[]): LogicalExpr {
    return { type: "logical", op: "OR", expressions };
  }

  // SQL Functions
  length<TCol extends StdTableColumn>(col: TCol): FunctionExpr {
    return { type: "function", name: "length", args: [col] };
  }

  lower<TCol extends StdTableColumn>(col: TCol): FunctionExpr {
    return { type: "function", name: "lower", args: [col] };
  }

  upper<TCol extends StdTableColumn>(col: TCol): FunctionExpr {
    return { type: "function", name: "upper", args: [col] };
  }

  trim<TCol extends StdTableColumn>(col: TCol): FunctionExpr {
    return { type: "function", name: "trim", args: [col] };
  }

  coalesce<TCol extends StdTableColumn>(
    col: TCol,
    defaultValue: TCol["ValType"],
  ): FunctionExpr {
    return { type: "function", name: "coalesce", args: [col, defaultValue] };
  }

  // Function comparison helpers
  fnEq(fn: FunctionExpr, value: unknown): ComparisonExpr {
    return { type: "comparison", left: fn, op: "=", right: value };
  }

  fnNeq(fn: FunctionExpr, value: unknown): ComparisonExpr {
    return { type: "comparison", left: fn, op: "<>", right: value };
  }

  fnGt(fn: FunctionExpr, value: number): ComparisonExpr {
    return { type: "comparison", left: fn, op: ">", right: value };
  }

  fnGte(fn: FunctionExpr, value: number): ComparisonExpr {
    return { type: "comparison", left: fn, op: ">=", right: value };
  }

  fnLt(fn: FunctionExpr, value: number): ComparisonExpr {
    return { type: "comparison", left: fn, op: "<", right: value };
  }

  fnLte(fn: FunctionExpr, value: number): ComparisonExpr {
    return { type: "comparison", left: fn, op: "<=", right: value };
  }

  // Raw SQL escape hatch
  raw(sql: string): RawExpr {
    return { type: "raw", sql };
  }

  // Convert expression to SQL string
  toSQL(expr: CheckExpr): string {
    return exprToSQL(expr);
  }
}

// ============================================================================
// Check Constraint Class
// ============================================================================

export class Check {
  readonly #name: string;
  readonly #expr: CheckExpr;

  constructor(name: string, expr: CheckExpr) {
    this.#name = name;
    this.#expr = expr;
  }

  getName(): string {
    return this.#name.includes("check") ? this.#name : `${this.#name}_check`;
  }

  getExpression(): string {
    return exprToSQL(this.#expr);
  }

  toSnapshotExpr(): SnapshotCheckExpr {
    return exprToSnapshot(this.#expr);
  }
}

// Factory function
export function check(name: string, expr: CheckExpr): Check {
  return new Check(name, expr);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Converts a raw JavaScript value to a SQL literal string.
 * Used as a fallback when no column type context is available.
 */
function formatUnknown(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}

function exprToSQL(expr: CheckExpr): string {
  if (expr.type === "raw") {
    return expr.sql;
  }

  if (expr.type === "comparison") {
    let left: string;
    if (isTableCol(expr.left)) {
      left = `"${expr.left.nameSnake}"`;
    } else if (expr.left.type === "function") {
      left = exprToSQL(expr.left);
    } else {
      left = String(expr.left);
    }
    // Special handling for IN / NOT IN with arrays
    if (expr.op === "IN" || expr.op === "NOT IN") {
      if (Array.isArray(expr.right)) {
        const list = expr.right
          .map((v) => (isTableCol(v) ? `"${v.nameSnake}"` : formatUnknown(v)))
          .join(", ");
        return `${left} ${expr.op} (${list})`;
      }

      // Fallback: single value (wrap in parens)
      const singleRight = isTableCol(expr.right)
        ? `"${expr.right.nameSnake}"`
        : formatUnknown(expr.right);
      return `${left} ${expr.op} (${singleRight})`;
    }
    const right = isTableCol(expr.right)
      ? `"${expr.right.nameSnake}"`
      : isTableCol(expr.left)
        ? expr.left.toSQL(expr.right as never)
        : formatUnknown(expr.right);

    return `${left} ${expr.op} ${right}`;
  }

  if (expr.type === "logical") {
    const parts = expr.expressions.map((e) => exprToSQL(e));
    return `(${parts.join(` ${expr.op} `)})`;
  }

  if (expr.type === "function") {
    const args = expr.args.map((arg) =>
      isTableCol(arg) ? `"${arg.nameSnake}"` : formatUnknown(arg),
    );
    return `${expr.name}(${args.join(", ")})`;
  }

  throw new Error("Unknown expression type");
}

function exprToSnapshot(expr: CheckExpr): SnapshotCheckExpr {
  if (expr.type === "raw") {
    return { type: "raw", sql: expr.sql };
  }

  if (expr.type === "comparison") {
    // Convert left side to ExprColumnRef or SnapshotFunctionExpr
    let left: ExprColumnRef | SnapshotFunctionExpr;
    if (isTableCol(expr.left)) {
      left = { type: "col", name: expr.left.nameSnake as string };
    } else {
      left = exprToSnapshot(expr.left) as SnapshotFunctionExpr;
    }

    // Convert right side: column ref becomes ExprColumnRef, values are rendered to SQL strings
    let right: ExprColumnRef | string;
    if (isTableCol(expr.right)) {
      right = { type: "col", name: expr.right.nameSnake as string };
    } else if (
      (expr.op === "IN" || expr.op === "NOT IN") &&
      Array.isArray(expr.right)
    ) {
      // For IN / NOT IN: render each element and join as a pre-formatted SQL tuple string
      const refCol = isTableCol(expr.left) ? expr.left : undefined;
      const list = (expr.right as unknown[]).map((v) => {
        if (isTableCol(v)) return `"${v.nameSnake}"`;
        return refCol ? refCol.toSQL(v) : formatUnknown(v);
      });
      right = `(${list.join(", ")})`;
    } else if (isTableCol(expr.left)) {
      // Use the column's toSQL for type-aware serialization — handles both scalar
      // values and array values (dimension columns) correctly via ARRAY[...] syntax.
      right = expr.left.toSQL(expr.right as never);
    } else {
      // Left is a FunctionExpr - its return type differs from any column arg type,
      // so fall back to formatValue (function comparison values are always plain numbers/strings)
      right = formatUnknown(expr.right);
    }

    return { type: "comparison", left, op: expr.op, right };
  }

  if (expr.type === "logical") {
    return {
      type: "logical",
      op: expr.op,
      expressions: expr.expressions.map((e) => exprToSnapshot(e)),
    };
  }

  if (expr.type === "function") {
    // Find the first column arg - used as type context for non-column args (e.g. coalesce default value)
    const refCol = expr.args.find(isTableCol);
    return {
      type: "function",
      name: expr.name,
      args: expr.args.map((arg) => {
        if (isTableCol(arg)) {
          return { type: "col" as const, name: arg.nameSnake as string };
        }
        return refCol ? refCol.toSQL(arg) : formatUnknown(arg);
      }),
    };
  }

  throw new Error("Unknown expression type");
}

/** Type guard for {@link ExprColumnRef}. */
export function isExprColumnRef(value: unknown): value is ExprColumnRef {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ExprColumnRef).type === "col"
  );
}

/** Convert a snapshot expression back to a SQL string. */
export function snapshotExprToSQL(expr: SnapshotCheckExpr): string {
  if (expr.type === "raw") {
    return expr.sql;
  }

  if (expr.type === "comparison") {
    const left = isExprColumnRef(expr.left)
      ? `"${expr.left.name}"`
      : snapshotExprToSQL(expr.left);
    // Right is either a column ref or a pre-rendered SQL string (values rendered at snapshot time)
    const right = isExprColumnRef(expr.right)
      ? `"${expr.right.name}"`
      : expr.right;
    return `${left} ${expr.op} ${right}`;
  }

  if (expr.type === "logical") {
    const parts = expr.expressions.map((e) => snapshotExprToSQL(e));
    const wrappedParts = parts.map((p) => `(${p})`);
    return wrappedParts.join(` ${expr.op} `);
  }

  if (expr.type === "function") {
    const args = expr.args.map((a) => (isExprColumnRef(a) ? `"${a.name}"` : a));
    return `${expr.name}(${args.join(", ")})`;
  }

  throw new Error("Unknown expression type");
}

// ============================================================================
// MigrationCheckBuilder — migration-context check builder
// ============================================================================

/**
 * Callback type for check expressions in migration DDL builders.
 * Receives a {@link MigrationCheckBuilder} and returns a {@link SnapshotCheckExpr}.
 */
export type MigrationCheckExprCallback = (
  builder: MigrationCheckBuilder,
) => SnapshotCheckExpr;

/**
 * A check-expression builder for use inside migration files.
 *
 * Unlike {@link CheckBuilder}, which works with live {@link TableColumn} objects,
 * this builder accepts column names as strings and values as {@link Sql} instances.
 * It returns {@link SnapshotCheckExpr} objects directly, which are stored by
 * {@link CreateTableBuilder} / {@link AlterTableBuilder} and rendered to SQL
 * via {@link snapshotExprToSQL}.
 *
 * Because all methods are stateless, destructuring is safe:
 * ```typescript
 * .check("positive_price", ({ gt }) => gt("price", sql`0`))
 * ```
 */
export class MigrationCheckBuilder {
  // ------------------------------------------------------------------
  // Private factories
  // Arrow functions so that `this` is bound even when methods are destructured.
  // ------------------------------------------------------------------

  /** Builds a column-comparison snapshot node. */
  #colComparison = (
    col: string,
    op: ComparisonOp | PatternOp,
    value: Sql,
  ): SnapshotComparisonExpr => {
    return {
      type: "comparison",
      left: { type: "col", name: col },
      op,
      right: value.toSQL(),
    };
  };

  /** Builds a function-comparison snapshot node. */
  #fnComparison = (
    fn: SnapshotFunctionExpr,
    op: ComparisonOp,
    value: Sql,
  ): SnapshotComparisonExpr => {
    return { type: "comparison", left: fn, op, right: value.toSQL() };
  };

  // ------------------------------------------------------------------
  // Comparison operators
  // ------------------------------------------------------------------

  /** `col = value` */
  eq = (col: string, value: Sql): SnapshotComparisonExpr => {
    return this.#colComparison(col, "=", value);
  };

  /** `col <> value` */
  neq = (col: string, value: Sql): SnapshotComparisonExpr => {
    return this.#colComparison(col, "<>", value);
  };

  /** `col > value` */
  gt = (col: string, value: Sql): SnapshotComparisonExpr => {
    return this.#colComparison(col, ">", value);
  };

  /** `col >= value` */
  gte = (col: string, value: Sql): SnapshotComparisonExpr => {
    return this.#colComparison(col, ">=", value);
  };

  /** `col < value` */
  lt = (col: string, value: Sql): SnapshotComparisonExpr => {
    return this.#colComparison(col, "<", value);
  };

  /** `col <= value` */
  lte = (col: string, value: Sql): SnapshotComparisonExpr => {
    return this.#colComparison(col, "<=", value);
  };

  /** `col LIKE pattern` */
  like = (col: string, value: Sql): SnapshotComparisonExpr => {
    return this.#colComparison(col, "LIKE", value);
  };

  /** `col SIMILAR TO pattern` */
  similarTo = (col: string, value: Sql): SnapshotComparisonExpr => {
    return this.#colComparison(col, "SIMILAR TO", value);
  };

  /** `col ~ pattern` */
  regex = (col: string, value: Sql): SnapshotComparisonExpr => {
    return this.#colComparison(col, "~", value);
  };

  /**
   * `col IN (...)` — pass the full tuple as a single sql literal:
   * ```typescript
   * in("status", sql`('active', 'pending')`)
   * ```
   */
  in = (col: string, value: Sql): SnapshotComparisonExpr => {
    return this.#colComparison(col, "IN", value);
  };

  /**
   * `col NOT IN (...)` — pass the full tuple as a single sql literal:
   * ```typescript
   * notIn("status", sql`('archived', 'deleted')`)
   * ```
   */
  notIn = (col: string, value: Sql): SnapshotComparisonExpr => {
    return this.#colComparison(col, "NOT IN", value);
  };

  // ------------------------------------------------------------------
  // Logical operators
  // ------------------------------------------------------------------

  /** `(expr1 AND expr2 ...)` */
  and = (...expressions: SnapshotCheckExpr[]): SnapshotLogicalExpr => {
    return { type: "logical", op: "AND", expressions };
  };

  /** `(expr1 OR expr2 ...)` */
  or = (...expressions: SnapshotCheckExpr[]): SnapshotLogicalExpr => {
    return { type: "logical", op: "OR", expressions };
  };

  // ------------------------------------------------------------------
  // SQL functions (return a SnapshotFunctionExpr for use with fn* methods)
  // ------------------------------------------------------------------

  /** Builds a single-column function snapshot node. */
  #colFn = (name: string, col: string): SnapshotFunctionExpr => {
    return { type: "function", name, args: [{ type: "col", name: col }] };
  };

  /** `length(col)` */
  length = (col: string): SnapshotFunctionExpr => {
    return this.#colFn("length", col);
  };

  /** `lower(col)` */
  lower = (col: string): SnapshotFunctionExpr => {
    return this.#colFn("lower", col);
  };

  /** `upper(col)` */
  upper = (col: string): SnapshotFunctionExpr => {
    return this.#colFn("upper", col);
  };

  /** `trim(col)` */
  trim = (col: string): SnapshotFunctionExpr => {
    return this.#colFn("trim", col);
  };

  /** `coalesce(col, default)` */
  coalesce = (col: string, value: Sql): SnapshotFunctionExpr => {
    return {
      type: "function",
      name: "coalesce",
      args: [{ type: "col", name: col }, value.toSQL()],
    };
  };

  // ------------------------------------------------------------------
  // Function comparisons
  // ------------------------------------------------------------------

  /** `fn(col) = value` */
  fnEq = (fn: SnapshotFunctionExpr, value: Sql): SnapshotComparisonExpr => {
    return this.#fnComparison(fn, "=", value);
  };

  /** `fn(col) <> value` */
  fnNeq = (fn: SnapshotFunctionExpr, value: Sql): SnapshotComparisonExpr => {
    return this.#fnComparison(fn, "<>", value);
  };

  /** `fn(col) > value` */
  fnGt = (fn: SnapshotFunctionExpr, value: Sql): SnapshotComparisonExpr => {
    return this.#fnComparison(fn, ">", value);
  };

  /** `fn(col) >= value` */
  fnGte = (fn: SnapshotFunctionExpr, value: Sql): SnapshotComparisonExpr => {
    return this.#fnComparison(fn, ">=", value);
  };

  /** `fn(col) < value` */
  fnLt = (fn: SnapshotFunctionExpr, value: Sql): SnapshotComparisonExpr => {
    return this.#fnComparison(fn, "<", value);
  };

  /** `fn(col) <= value` */
  fnLte = (fn: SnapshotFunctionExpr, value: Sql): SnapshotComparisonExpr => {
    return this.#fnComparison(fn, "<=", value);
  };

  // ------------------------------------------------------------------
  // Raw SQL escape hatch
  // ------------------------------------------------------------------

  /** Emit a raw SQL expression verbatim. */
  raw = (sql: string): SnapshotRawExpr => {
    return { type: "raw", sql };
  };
}

// ============================================================================
// snapshotExprToCheckBuilderCode — snapshot expr → TS source code
// ============================================================================

/** Maps a comparison operator to its MigrationCheckBuilder method name. */
const opToMethod: Record<string, string> = {
  "=": "eq",
  "<>": "neq",
  ">": "gt",
  ">=": "gte",
  "<": "lt",
  "<=": "lte",
  LIKE: "like",
  "SIMILAR TO": "similarTo",
  "~": "regex",
  IN: "in",
  "NOT IN": "notIn",
};

/** Maps a comparison operator to its fn* MigrationCheckBuilder method name. */
const fnOpToMethod: Record<string, string> = {
  "=": "fnEq",
  "<>": "fnNeq",
  ">": "fnGt",
  ">=": "fnGte",
  "<": "fnLt",
  "<=": "fnLte",
};

/**
 * Method names that are JS reserved words and cannot be used as plain destructure
 * bindings. Maps them to a safe local alias used in the emitted callback body.
 * e.g. `in` → destructured as `{ in: inOp }`, called as `inOp(...)`.
 */
const reservedMethodAlias: Record<string, string> = {
  in: "inOp",
};

/** Wraps a pre-rendered SQL string in a sql`...` template literal. */
function wrapSql(value: string): string {
  // Escape any backticks that appear in the value itself
  return `sql\`${value.replace(/`/g, "\\`")}\``;
}

/**
 * Walks a {@link SnapshotCheckExpr} tree and collects all
 * {@link MigrationCheckBuilder} method names referenced, for use in the
 * destructuring pattern of the emitted callback.
 */
function collectMethods(expr: SnapshotCheckExpr, names: Set<string>): void {
  if (expr.type === "raw") {
    names.add("raw");
    return;
  }

  if (expr.type === "comparison") {
    // Col-to-col comparison (right is an ExprColumnRef) — fall back to raw
    if (isExprColumnRef(expr.right)) {
      names.add("raw");
      return;
    }
    if (expr.left.type === "function") {
      // fn* method + the function name itself (e.g. "fnGt" + "length")
      names.add(fnOpToMethod[expr.op] ?? "fnEq");
      names.add(expr.left.name);
    } else {
      names.add(opToMethod[expr.op] ?? "eq");
    }
    return;
  }

  if (expr.type === "logical") {
    names.add(expr.op === "AND" ? "and" : "or");
    for (const e of expr.expressions) {
      collectMethods(e, names);
    }
    return;
  }

  if (expr.type === "function") {
    names.add(expr.name);
  }
}

/**
 * Builds the destructuring string for the callback parameter, handling
 * JS reserved word collisions (e.g. `in` → `in: inOp`).
 */
function buildDestructure(names: Set<string>): string {
  return [...names]
    .sort()
    .map((name) => {
      const alias = reservedMethodAlias[name];
      return alias ? `${name}: ${alias}` : name;
    })
    .join(", ");
}

/**
 * Returns the local identifier to use when calling a method in the body,
 * accounting for reserved word aliases.
 */
function callName(method: string): string {
  return reservedMethodAlias[method] ?? method;
}

/**
 * Renders a {@link SnapshotFunctionExpr} as a source-code call string,
 * e.g. `length("name")` or `coalesce("name", sql\`'default'\`)`.
 */
function renderFunctionExpr(fn: SnapshotFunctionExpr): string {
  const args = fn.args.map((a) =>
    typeof a === "string"
      ? wrapSql(a)
      : isExprColumnRef(a)
        ? JSON.stringify(a.name)
        : wrapSql(snapshotExprToSQL(a)),
  );
  return `${fn.name}(${args.join(", ")})`;
}

/**
 * Recursively renders a {@link SnapshotCheckExpr} as a source-code expression
 * string using {@link MigrationCheckBuilder} method calls.
 */
function renderExpr(expr: SnapshotCheckExpr): string {
  if (expr.type === "raw") {
    return `raw(${JSON.stringify(expr.sql)})`;
  }

  if (expr.type === "comparison") {
    // Col-to-col comparison — emit raw SQL as a fallback
    if (isExprColumnRef(expr.right)) {
      return `raw(${JSON.stringify(snapshotExprToSQL(expr))})`;
    }

    if (expr.left.type === "function") {
      const method = fnOpToMethod[expr.op] ?? "fnEq";
      return `${callName(method)}(${renderFunctionExpr(expr.left)}, ${wrapSql(expr.right)})`;
    }

    const method = opToMethod[expr.op] ?? "eq";
    return `${callName(method)}(${JSON.stringify(expr.left.name)}, ${wrapSql(expr.right)})`;
  }

  if (expr.type === "logical") {
    const method = expr.op === "AND" ? "and" : "or";
    const parts = expr.expressions.map((e) => renderExpr(e)).join(", ");
    return `${method}(${parts})`;
  }

  if (expr.type === "function") {
    return renderFunctionExpr(expr);
  }

  throw new Error("Unknown SnapshotCheckExpr type");
}

/**
 * Converts a {@link SnapshotCheckExpr} into a TypeScript callback string
 * suitable for embedding in a generated migration file.
 *
 * @example
 * // { type: "comparison", left: { type: "col", name: "price" }, op: ">", right: "0" }
 * // → '({ gt }) => gt("price", sql`0`)'
 *
 * @example
 * // IN expression — 'in' is a JS reserved word, aliased as 'inOp':
 * // → '({ in: inOp }) => inOp("category_id", sql`(1, 2, 3)`)'
 */
export function snapshotExprToCheckBuilderCode(
  expr: SnapshotCheckExpr,
): string {
  const names = new Set<string>();
  collectMethods(expr, names);
  const destructure = buildDestructure(names);
  const body = renderExpr(expr);
  return `({ ${destructure} }) => ${body}`;
}
