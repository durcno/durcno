import { isTableCol } from "../entity";
import type { AnyColumn, TableColumn } from "../table";
import type { Key } from "../types";

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
  left: TableColumn<string, string, Key, AnyColumn> | FunctionExpr;
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
  args: (TableColumn<string, string, Key, AnyColumn> | unknown)[];
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
  eq<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
    value: TCol["ValType"],
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "=", right: value };
  }

  neq<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
    value: TCol["ValType"],
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "<>", right: value };
  }

  gt<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
    value: TCol["ValType"],
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: ">", right: value };
  }

  gte<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
    value: TCol["ValType"],
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: ">=", right: value };
  }

  lt<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
    value: TCol["ValType"],
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "<", right: value };
  }

  lte<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
    value: TCol["ValType"],
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "<=", right: value };
  }

  like<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
    pattern: string,
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "LIKE", right: pattern };
  }

  similarTo<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
    pattern: string,
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "SIMILAR TO", right: pattern };
  }

  regex<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
    pattern: string,
  ): ComparisonExpr {
    return { type: "comparison", left: col, op: "~", right: pattern };
  }

  // Set membership operators (lists of strings or numbers)
  in<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
    values: TCol["ValType"][],
  ): ComparisonExpr {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("IN expression requires a non-empty array of values");
    }
    return { type: "comparison", left: col, op: "IN", right: values };
  }

  notIn<TCol extends TableColumn<string, string, Key, AnyColumn>>(
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
  length<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
  ): FunctionExpr {
    return { type: "function", name: "length", args: [col] };
  }

  lower<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
  ): FunctionExpr {
    return { type: "function", name: "lower", args: [col] };
  }

  upper<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
  ): FunctionExpr {
    return { type: "function", name: "upper", args: [col] };
  }

  trim<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
  ): FunctionExpr {
    return { type: "function", name: "trim", args: [col] };
  }

  coalesce<TCol extends TableColumn<string, string, Key, AnyColumn>>(
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
function isExprColumnRef(value: unknown): value is ExprColumnRef {
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
