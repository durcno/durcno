import { is, isCol, isTCol } from "../entity";
import type { AnyArg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import { escIdentifier, escLiteral, Sql } from "../sql";
import { type AnyColumn, type AnyTableWithColumns, Table } from "../table";
import { AggregateSqlFn } from "./aggregate";
import {
  type AnySqlFn,
  appendOperand,
  type ExprColumns,
  type HasArg,
  type InferValueType,
  SqlFn,
} from "./index";

/**
 * Valid operand for JSON functions:
 * columns, SqlFns, raw Sql instances, prepared arguments, literals, objects, arrays, and null.
 */
export type JsonOperand =
  | AnyColumn
  | AnySqlFn
  | Sql
  | AnyArg
  | string
  | number
  | bigint
  | boolean
  | Date
  | readonly unknown[]
  | Record<string, unknown>
  | null;

/** Helper to extract column union from all values of a record. */
export type RecordExprColumns<TRecord extends Record<string, unknown>> =
  ExprColumns<TRecord[keyof TRecord]>;

/** Helper to check if any field in a record embeds an Arg placeholder. */
export type RecordHasArg<TRecord extends Record<string, unknown>> =
  true extends HasArg<TRecord[keyof TRecord]> ? true : false;

/** Helper to extract HasArg flag across a tuple of expressions. */
export type HasArgInTuple<TTuple extends readonly unknown[]> =
  TTuple extends readonly [infer Head, ...infer Tail]
    ? HasArg<Head> extends true
      ? true
      : HasArgInTuple<Tail>
    : false;

// ============================================================================
// json_build_object & jsonb_build_object
// ============================================================================

/**
 * SQL scalar expression: `json_build_object(...)`
 * Builds a JSON object out of a key-value mapping of columns, expressions, or literals.
 */
export class JsonBuildObjectFn<
  TFields extends Record<string, JsonOperand>,
  THasArg extends boolean = RecordHasArg<TFields>,
> extends SqlFn<
  RecordExprColumns<TFields>,
  THasArg,
  "scalar",
  "json",
  { [K in keyof TFields]: InferValueType<TFields[K]> }
> {
  constructor(readonly fields: TFields) {
    super();
  }

  /** Returns all table columns directly referenced by fields of this JSON object. */
  get referencedColumns(): AnyColumn[] {
    const cols: AnyColumn[] = [];
    for (const val of Object.values(this.fields)) {
      if (isCol(val)) {
        cols.push(val);
      } else if (
        val instanceof SqlFn &&
        "referencedColumns" in val &&
        Array.isArray(val.referencedColumns)
      ) {
        cols.push(...val.referencedColumns);
      }
    }
    return cols;
  }

  toDriverValue(
    value: { [K in keyof TFields]: InferValueType<TFields[K]> } | null,
  ): unknown {
    return value;
  }

  toSQLValue(
    value: { [K in keyof TFields]: InferValueType<TFields[K]> } | null,
  ): string {
    return value === null
      ? "NULL"
      : `'${JSON.stringify(value).replace(/'/g, "''")}'::json`;
  }

  fromDriverValue(
    value: unknown,
  ): { [K in keyof TFields]: InferValueType<TFields[K]> } | null {
    return SqlFn._jsonFromDriver(value) as
      | {
          [K in keyof TFields]: InferValueType<TFields[K]>;
        }
      | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "json_build_object(";
    const entries = Object.entries(this.fields);
    entries.forEach(([key, val], idx) => {
      query.sql += `'${escLiteral(key)}', `;
      appendOperand(query, val, ctx);
      if (idx < entries.length - 1) query.sql += ", ";
    });
    query.sql += ")";
  }
}

/**
 * SQL scalar expression: `jsonb_build_object(...)`
 * Builds a JSONB object out of a key-value mapping of columns, expressions, or literals.
 */
export class JsonbBuildObjectFn<
  TFields extends Record<string, JsonOperand>,
  THasArg extends boolean = RecordHasArg<TFields>,
> extends SqlFn<
  RecordExprColumns<TFields>,
  THasArg,
  "scalar",
  "jsonb",
  { [K in keyof TFields]: InferValueType<TFields[K]> }
> {
  constructor(readonly fields: TFields) {
    super();
  }

  /** Returns all table columns directly referenced by fields of this JSON object. */
  get referencedColumns(): AnyColumn[] {
    const cols: AnyColumn[] = [];
    for (const val of Object.values(this.fields)) {
      if (isCol(val)) {
        cols.push(val);
      } else if (
        val instanceof SqlFn &&
        "referencedColumns" in val &&
        Array.isArray(val.referencedColumns)
      ) {
        cols.push(...val.referencedColumns);
      }
    }
    return cols;
  }

  toDriverValue(
    value: { [K in keyof TFields]: InferValueType<TFields[K]> } | null,
  ): unknown {
    return value;
  }

  toSQLValue(
    value: { [K in keyof TFields]: InferValueType<TFields[K]> } | null,
  ): string {
    return value === null
      ? "NULL"
      : `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }

  fromDriverValue(
    value: unknown,
  ): { [K in keyof TFields]: InferValueType<TFields[K]> } | null {
    return SqlFn._jsonFromDriver(value) as
      | {
          [K in keyof TFields]: InferValueType<TFields[K]>;
        }
      | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "jsonb_build_object(";
    const entries = Object.entries(this.fields);
    entries.forEach(([key, val], idx) => {
      query.sql += `'${escLiteral(key)}', `;
      appendOperand(query, val, ctx, { preferJsonb: true });
      if (idx < entries.length - 1) query.sql += ", ";
    });
    query.sql += ")";
  }
}

/**
 * Creates a SQL expression `json_build_object(...)`.
 *
 * @param fields - Object mapping of property keys to columns, expressions, or literals.
 *
 * @example
 * jsonBuildObject({
 *   id: users.id,
 *   name: users.name,
 * })
 */
export function jsonBuildObject<TFields extends Record<string, JsonOperand>>(
  fields: TFields,
): JsonBuildObjectFn<TFields> {
  return new JsonBuildObjectFn(fields);
}

/**
 * Creates a SQL expression `jsonb_build_object(...)`.
 *
 * @param fields - Object mapping of property keys to columns, expressions, or literals.
 *
 * @example
 * jsonbBuildObject({
 *   id: users.id,
 *   name: users.name,
 * })
 */
export function jsonbBuildObject<TFields extends Record<string, JsonOperand>>(
  fields: TFields,
): JsonbBuildObjectFn<TFields> {
  return new JsonbBuildObjectFn(fields);
}

// ============================================================================
// json_agg & jsonb_agg
// ============================================================================

/**
 * SQL aggregate expression: `json_agg(expr [ORDER BY ...]) [FILTER (WHERE ...)]`
 * Aggregates rows into a JSON array.
 */
export class JsonAggFn<
  TExpr extends JsonOperand,
  THasArg extends boolean = HasArg<TExpr>,
> extends AggregateSqlFn<
  ExprColumns<TExpr>,
  THasArg,
  "json",
  InferValueType<TExpr>[] | null
> {
  protected isDistinct = false;

  constructor(readonly expr: TExpr) {
    super();
  }

  /**
   * Aggregates only distinct values: `json_agg(DISTINCT expr)`
   */
  distinct(): this {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.isDistinct = true;
    return clone;
  }

  toDriverValue(value: InferValueType<TExpr>[] | null): unknown {
    return value;
  }

  toSQLValue(value: InferValueType<TExpr>[] | null): string {
    return value === null
      ? "NULL"
      : `'${JSON.stringify(value).replace(/'/g, "''")}'::json`;
  }

  fromDriverValue(value: unknown): InferValueType<TExpr>[] | null {
    return SqlFn._jsonFromDriver(value) as InferValueType<TExpr>[] | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "json_agg(";
    if (this.isDistinct) {
      query.sql += "DISTINCT ";
    }
    appendOperand(query, this.expr, ctx);
    this.appendOrderBy(query, ctx);
    query.sql += ")";
    this.appendFilter(query, ctx);
  }
}

/**
 * SQL aggregate expression: `jsonb_agg(expr [ORDER BY ...]) [FILTER (WHERE ...)]`
 * Aggregates rows into a JSONB array.
 */
export class JsonbAggFn<
  TExpr extends JsonOperand,
  THasArg extends boolean = HasArg<TExpr>,
> extends AggregateSqlFn<
  ExprColumns<TExpr>,
  THasArg,
  "jsonb",
  InferValueType<TExpr>[] | null
> {
  protected isDistinct = false;

  constructor(readonly expr: TExpr) {
    super();
  }

  /**
   * Aggregates only distinct values: `jsonb_agg(DISTINCT expr)`
   */
  distinct(): this {
    const clone = Object.create(Object.getPrototypeOf(this));
    Object.assign(clone, this);
    clone.isDistinct = true;
    return clone;
  }

  toDriverValue(value: InferValueType<TExpr>[] | null): unknown {
    return value;
  }

  toSQLValue(value: InferValueType<TExpr>[] | null): string {
    return value === null
      ? "NULL"
      : `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }

  fromDriverValue(value: unknown): InferValueType<TExpr>[] | null {
    return SqlFn._jsonFromDriver(value) as InferValueType<TExpr>[] | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "jsonb_agg(";
    if (this.isDistinct) {
      query.sql += "DISTINCT ";
    }
    appendOperand(query, this.expr, ctx, { preferJsonb: true });
    this.appendOrderBy(query, ctx);
    query.sql += ")";
    this.appendFilter(query, ctx);
  }
}

/**
 * Creates a SQL aggregate expression `json_agg(expr)`.
 * Chain with `.orderBy(...)` and `.filter(...)` for PostgreSQL order and filter clauses.
 *
 * @example
 * jsonAgg(comments.content).orderBy(asc(comments.createdAt)).filter(isNotNull(comments.id))
 * coalesce(jsonAgg(jsonBuildObject({ id: comments.id, text: comments.text })), [])
 */
export function jsonAgg<TExpr extends JsonOperand>(
  expr: TExpr,
): JsonAggFn<TExpr> {
  return new JsonAggFn(expr);
}

/**
 * Creates a SQL aggregate expression `jsonb_agg(expr)`.
 * Chain with `.orderBy(...)` and `.filter(...)` for PostgreSQL order and filter clauses.
 *
 * @example
 * jsonbAgg(comments.content).orderBy(asc(comments.createdAt)).filter(isNotNull(comments.id))
 * coalesce(jsonbAgg(jsonbBuildObject({ id: comments.id, text: comments.text })), [])
 */
export function jsonbAgg<TExpr extends JsonOperand>(
  expr: TExpr,
): JsonbAggFn<TExpr> {
  return new JsonbAggFn(expr);
}

// ============================================================================
// to_json & to_jsonb
// ============================================================================

type ToJsonTarget =
  | AnyTableWithColumns
  | Record<string, AnyColumn>
  | JsonOperand;

type InferToJsonReturn<TTarget> = TTarget extends AnyTableWithColumns
  ? TTarget["$"]["inferSelect"]
  : TTarget extends Record<string, AnyColumn>
    ? { [K in keyof TTarget]: InferValueType<TTarget[K]> }
    : InferValueType<TTarget>;

/**
 * SQL scalar expression: `to_json(target)`
 * Converts an entire table row, record, column, or expression to a JSON value.
 */
export class ToJsonFn<
  TTarget extends ToJsonTarget,
  THasArg extends boolean = HasArg<TTarget>,
> extends SqlFn<
  ExprColumns<TTarget>,
  THasArg,
  "scalar",
  "json",
  InferToJsonReturn<TTarget>
> {
  constructor(readonly target: TTarget) {
    super();
  }

  toDriverValue(value: InferToJsonReturn<TTarget> | null): unknown {
    return value;
  }

  toSQLValue(value: InferToJsonReturn<TTarget> | null): string {
    return value === null
      ? "NULL"
      : `'${JSON.stringify(value).replace(/'/g, "''")}'::json`;
  }

  fromDriverValue(value: unknown): InferToJsonReturn<TTarget> | null {
    return SqlFn._jsonFromDriver(value) as InferToJsonReturn<TTarget> | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "to_json(";
    if (is(this.target, Table)) {
      query.sql += `"${escIdentifier(this.target._.nameSql)}"`;
    } else if (
      typeof this.target === "object" &&
      this.target !== null &&
      !isCol(this.target) &&
      !(this.target instanceof Sql)
    ) {
      const firstCol = Object.values(this.target)[0];
      const tableName =
        firstCol && isTCol(firstCol) ? firstCol.table?._.nameSql : undefined;
      if (tableName) {
        query.sql += `"${escIdentifier(tableName)}"`;
      } else {
        appendOperand(query, this.target, ctx);
      }
    } else {
      appendOperand(query, this.target, ctx);
    }
    query.sql += ")";
  }
}

/**
 * SQL scalar expression: `to_jsonb(target)`
 * Converts an entire table row, record, column, or expression to a JSONB value.
 */
export class ToJsonbFn<
  TTarget extends ToJsonTarget,
  THasArg extends boolean = HasArg<TTarget>,
> extends SqlFn<
  ExprColumns<TTarget>,
  THasArg,
  "scalar",
  "jsonb",
  InferToJsonReturn<TTarget>
> {
  constructor(readonly target: TTarget) {
    super();
  }

  toDriverValue(value: InferToJsonReturn<TTarget> | null): unknown {
    return value;
  }

  toSQLValue(value: InferToJsonReturn<TTarget> | null): string {
    return value === null
      ? "NULL"
      : `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }

  fromDriverValue(value: unknown): InferToJsonReturn<TTarget> | null {
    return SqlFn._jsonFromDriver(value) as InferToJsonReturn<TTarget> | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "to_jsonb(";
    if (is(this.target, Table)) {
      query.sql += `"${escIdentifier(this.target._.nameSql)}"`;
    } else if (
      typeof this.target === "object" &&
      this.target !== null &&
      !isCol(this.target) &&
      !(this.target instanceof Sql)
    ) {
      const firstCol = Object.values(this.target)[0];
      const tableName =
        firstCol && isTCol(firstCol) ? firstCol.table?._.nameSql : undefined;
      if (tableName) {
        query.sql += `"${escIdentifier(tableName)}"`;
      } else {
        appendOperand(query, this.target, ctx, { preferJsonb: true });
      }
    } else {
      appendOperand(query, this.target, ctx, { preferJsonb: true });
    }
    query.sql += ")";
  }
}

/**
 * Creates a SQL expression `to_json(target)` converting a table or value into JSON.
 *
 * @example
 * toJson(users)
 * toJson(Users)
 */
export function toJson<TTarget extends ToJsonTarget>(
  target: TTarget,
): ToJsonFn<TTarget> {
  return new ToJsonFn(target);
}

/**
 * Creates a SQL expression `to_jsonb(target)` converting a table or value into JSONB.
 *
 * @example
 * toJsonb(users)
 * toJsonb(Users)
 */
export function toJsonb<TTarget extends ToJsonTarget>(
  target: TTarget,
): ToJsonbFn<TTarget> {
  return new ToJsonbFn(target);
}

// ============================================================================
// json_build_array & jsonb_build_array
// ============================================================================

/**
 * SQL scalar expression: `json_build_array(...)`
 */
export class JsonBuildArrayFn<
  TItems extends readonly JsonOperand[],
  THasArg extends boolean = HasArgInTuple<TItems>,
> extends SqlFn<
  ExprColumns<TItems[number]>,
  THasArg,
  "scalar",
  "json",
  { [K in keyof TItems]: InferValueType<TItems[K]> }
> {
  constructor(readonly items: TItems) {
    super();
  }

  toDriverValue(
    value: { [K in keyof TItems]: InferValueType<TItems[K]> } | null,
  ): unknown {
    return value;
  }

  toSQLValue(
    value: { [K in keyof TItems]: InferValueType<TItems[K]> } | null,
  ): string {
    return value === null
      ? "NULL"
      : `'${JSON.stringify(value).replace(/'/g, "''")}'::json`;
  }

  fromDriverValue(
    value: unknown,
  ): { [K in keyof TItems]: InferValueType<TItems[K]> } | null {
    return SqlFn._jsonFromDriver(value) as
      | {
          [K in keyof TItems]: InferValueType<TItems[K]>;
        }
      | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "json_build_array(";
    this.items.forEach((item, idx) => {
      appendOperand(query, item, ctx);
      if (idx < this.items.length - 1) query.sql += ", ";
    });
    query.sql += ")";
  }
}

/**
 * SQL scalar expression: `jsonb_build_array(...)`
 */
export class JsonbBuildArrayFn<
  TItems extends readonly JsonOperand[],
  THasArg extends boolean = HasArgInTuple<TItems>,
> extends SqlFn<
  ExprColumns<TItems[number]>,
  THasArg,
  "scalar",
  "jsonb",
  { [K in keyof TItems]: InferValueType<TItems[K]> }
> {
  constructor(readonly items: TItems) {
    super();
  }

  toDriverValue(
    value: { [K in keyof TItems]: InferValueType<TItems[K]> } | null,
  ): unknown {
    return value;
  }

  toSQLValue(
    value: { [K in keyof TItems]: InferValueType<TItems[K]> } | null,
  ): string {
    return value === null
      ? "NULL"
      : `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }

  fromDriverValue(
    value: unknown,
  ): { [K in keyof TItems]: InferValueType<TItems[K]> } | null {
    return SqlFn._jsonFromDriver(value) as
      | {
          [K in keyof TItems]: InferValueType<TItems[K]>;
        }
      | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "jsonb_build_array(";
    this.items.forEach((item, idx) => {
      appendOperand(query, item, ctx, { preferJsonb: true });
      if (idx < this.items.length - 1) query.sql += ", ";
    });
    query.sql += ")";
  }
}

/**
 * Creates a SQL expression `json_build_array(...)`.
 *
 * @example
 * jsonBuildArray(users.id, users.name)
 */
export function jsonBuildArray<TItems extends readonly JsonOperand[]>(
  ...items: TItems
): JsonBuildArrayFn<TItems> {
  return new JsonBuildArrayFn(items);
}

/**
 * Creates a SQL expression `jsonb_build_array(...)`.
 *
 * @example
 * jsonbBuildArray(users.id, users.name)
 */
export function jsonbBuildArray<TItems extends readonly JsonOperand[]>(
  ...items: TItems
): JsonbBuildArrayFn<TItems> {
  return new JsonbBuildArrayFn(items);
}

// ============================================================================
// json_strip_nulls & jsonb_strip_nulls
// ============================================================================

/**
 * SQL scalar expression: `json_strip_nulls(expr)`
 */
export class JsonStripNullsFn<
  TExpr extends JsonOperand,
  THasArg extends boolean = HasArg<TExpr>,
> extends SqlFn<
  ExprColumns<TExpr>,
  THasArg,
  "scalar",
  "json",
  InferValueType<TExpr>
> {
  constructor(readonly expr: TExpr) {
    super();
  }

  toDriverValue(value: unknown): unknown {
    return value;
  }

  toSQLValue(value: unknown): string {
    return value === null
      ? "NULL"
      : `'${JSON.stringify(value).replace(/'/g, "''")}'::json`;
  }

  fromDriverValue(value: unknown): InferValueType<TExpr> | null {
    return SqlFn._jsonFromDriver(value) as InferValueType<TExpr> | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "json_strip_nulls(";
    appendOperand(query, this.expr, ctx);
    query.sql += ")";
  }
}

/**
 * SQL scalar expression: `jsonb_strip_nulls(expr)`
 */
export class JsonbStripNullsFn<
  TExpr extends JsonOperand,
  THasArg extends boolean = HasArg<TExpr>,
> extends SqlFn<
  ExprColumns<TExpr>,
  THasArg,
  "scalar",
  "jsonb",
  InferValueType<TExpr>
> {
  constructor(readonly expr: TExpr) {
    super();
  }

  toDriverValue(value: unknown): unknown {
    return value;
  }

  toSQLValue(value: unknown): string {
    return value === null
      ? "NULL"
      : `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  }

  fromDriverValue(value: unknown): InferValueType<TExpr> | null {
    return SqlFn._jsonFromDriver(value) as InferValueType<TExpr> | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "jsonb_strip_nulls(";
    appendOperand(query, this.expr, ctx, { preferJsonb: true });
    query.sql += ")";
  }
}

/**
 * Creates a SQL expression `json_strip_nulls(expr)`.
 */
export function jsonStripNulls<TExpr extends JsonOperand>(
  expr: TExpr,
): JsonStripNullsFn<TExpr> {
  return new JsonStripNullsFn(expr);
}

/**
 * Creates a SQL expression `jsonb_strip_nulls(expr)`.
 */
export function jsonbStripNulls<TExpr extends JsonOperand>(
  expr: TExpr,
): JsonbStripNullsFn<TExpr> {
  return new JsonbStripNullsFn(expr);
}
