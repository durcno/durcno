import { isTableCol } from "../entity";
import type { AnyColumn, TableColumn } from "../table";

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

export interface SnapshotComparisonExpr {
  type: "comparison";
  left: string | SnapshotFunctionExpr;
  op: SnapshotComparisonOp | SnapshotPatternOp;
  right: unknown;
}

export interface SnapshotLogicalExpr {
  type: "logical";
  op: SnapshotLogicalOp;
  expressions: SnapshotCheckExpr[];
}

export interface SnapshotFunctionExpr {
  type: "function";
  name: string;
  args: (string | unknown)[];
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
    values: (TCol["ValType"] & (string | number))[],
  ): ComparisonExpr {
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error("IN expression requires a non-empty array of values");
    }
    return { type: "comparison", left: col, op: "IN", right: values };
  }

  notIn<TCol extends TableColumn<string, string, Key, AnyColumn>>(
    col: TCol,
    values: (TCol["ValType"] & (string | number))[],
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

function formatValue(value: unknown): string {
  if (value === null) return "NULL";
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return `'${value.toISOString()}'`;
  return String(value);
}

function exprToSQL(expr: CheckExpr): string {
  if (expr.type === "raw") {
    return expr.sql;
  }

  if (expr.type === "comparison") {
    let left: string;
    if (isTableCol(expr.left)) {
      left = `"${expr.left.name}"`;
    } else if (expr.left.type === "function") {
      left = exprToSQL(expr.left);
    } else {
      left = String(expr.left);
    }
    // Special handling for IN / NOT IN with arrays
    if (expr.op === "IN" || expr.op === "NOT IN") {
      if (Array.isArray(expr.right)) {
        const list = expr.right
          .map((v) => (isTableCol(v) ? `"${v.name}"` : formatValue(v)))
          .join(", ");
        return `${left} ${expr.op} (${list})`;
      }

      // Fallback: single value (wrap in parens)
      const singleRight = isTableCol(expr.right)
        ? `"${expr.right.name}"`
        : formatValue(expr.right);
      return `${left} ${expr.op} (${singleRight})`;
    }
    const right = isTableCol(expr.right)
      ? `"${expr.right.name}"`
      : formatValue(expr.right);

    return `${left} ${expr.op} ${right}`;
  }

  if (expr.type === "logical") {
    const parts = expr.expressions.map((e) => exprToSQL(e));
    return `(${parts.join(` ${expr.op} `)})`;
  }

  if (expr.type === "function") {
    const args = expr.args.map((arg) =>
      isTableCol(arg) ? `"${arg.name}"` : formatValue(arg),
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
    let left: string | SnapshotFunctionExpr;
    if (isTableCol(expr.left)) {
      left = expr.left.name as string;
    } else if (expr.left.type === "function") {
      left = exprToSnapshot(expr.left) as SnapshotFunctionExpr;
    } else {
      left = String(expr.left);
    }

    const right = isTableCol(expr.right)
      ? (expr.right.name as string)
      : expr.right;

    return {
      type: "comparison",
      left,
      op: expr.op,
      right,
    };
  }

  if (expr.type === "logical") {
    return {
      type: "logical",
      op: expr.op,
      expressions: expr.expressions.map((e) => exprToSnapshot(e)),
    };
  }

  if (expr.type === "function") {
    return {
      type: "function",
      name: expr.name,
      args: expr.args.map((arg) =>
        isTableCol(arg) ? (arg.name as string) : arg,
      ),
    };
  }

  throw new Error("Unknown expression type");
}

// Convert snapshot expression back to SQL
export function snapshotExprToSQL(expr: SnapshotCheckExpr): string {
  if (expr.type === "raw") {
    return expr.sql;
  }

  if (expr.type === "comparison") {
    const left =
      typeof expr.left === "string"
        ? `"${expr.left}"`
        : snapshotExprToSQL(expr.left);
    const right = formatSnapshotValue(expr.right);
    return `${left} ${expr.op} ${right}`;
  }

  if (expr.type === "logical") {
    const parts = expr.expressions.map((e) => snapshotExprToSQL(e));
    const wrappedParts = parts.map((p) => `(${p})`);
    return wrappedParts.join(` ${expr.op} `);
  }

  if (expr.type === "function") {
    const args = expr.args.map((a) =>
      typeof a === "string" ? `"${a}"` : formatSnapshotValue(a),
    );
    return `${expr.name}(${args.join(", ")})`;
  }

  throw new Error("Unknown expression type");
}

function formatSnapshotValue(value: unknown): string {
  if (value === null) return "NULL";
  if (Array.isArray(value)) {
    const list = value.map((v) => formatSnapshotValue(v)).join(", ");
    return `(${list})`;
  }
  if (typeof value === "string") return `'${value.replace(/'/g, "''")}'`;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value);
}
