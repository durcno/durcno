import { is, isCol } from "../entity";
import { type AnyArg, Arg } from "../query-builders/prepare";
import type { Query, QueryContext } from "../query-builders/query";
import { escIdentifier, escLiteral, type Sql } from "../sql";
import { type AnyColumn, type AnyTableWithColumns, Table } from "../table";
import { AggregateSqlFn } from "./aggregate";
import {
  type AnySqlFn,
  type AppendOperandOptions,
  appendOperand,
  type ExprColumns,
  type HasAggregateOf,
  type HasArg,
  type InferValueType,
  isPlainRecord,
  jsonToSQLValue,
  type NonAggregateSqlFn,
  parseJsonDriverValue,
  restoreOperandValue,
  SqlFn,
  setOwn,
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

/** Operand a JSON aggregate accepts; excludes anything containing an aggregate. */
export type JsonAggOperand =
  | AnyColumn
  | NonAggregateSqlFn
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

/**
 * Whether a decoded JSON payload carries a key of its own.
 *
 * `in` would also find `Object.prototype` members, so a key the payload does
 * not carry could still look present.
 */
function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(obj, key);
}

/** Whether a decoded JSON value is an object the restore helpers can read. */
function isJsonObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Restores every entry of a decoded JSON object with the converter of its
 * source expression. Entries the payload does not carry are left untouched.
 */
function restoreJsonObject(
  obj: Record<string, unknown>,
  sources: Record<string, JsonOperand>,
): Record<string, unknown> {
  for (const key in sources) {
    if (!hasOwn(obj, key)) continue;
    setOwn(obj, key, restoreOperandValue(sources[key], obj[key]));
  }
  return obj;
}

/**
 * Restores every element of a decoded JSON array.
 *
 * One `source` restores every element with it; `sources` restores each element
 * with its own expression.
 */
function restoreJsonArray(
  arr: unknown[],
  source?: JsonOperand,
  sources?: readonly JsonOperand[],
): unknown[] {
  if (sources !== undefined) {
    for (let i = 0; i < arr.length; i++) {
      const item = sources[i];
      if (item === undefined) continue;
      arr[i] = restoreOperandValue(item, arr[i]);
    }
    return arr;
  }
  for (let i = 0; i < arr.length; i++) {
    arr[i] = restoreOperandValue(source, arr[i]);
  }
  return arr;
}

/**
 * Reads a decoded JSON row through the columns that produced it.
 *
 * PostgreSQL names the keys of a row after its columns, so a value is read by
 * the SQL name of its column and written under the column name.
 */
function restoreTableRow(
  obj: Record<string, unknown>,
  columns: Record<string, AnyColumn>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const colName in columns) {
    const column = columns[colName];
    const sqlName = column.nameSql ?? colName;
    if (!hasOwn(obj, sqlName)) continue;
    setOwn(row, colName, restoreOperandValue(column, obj[sqlName]));
  }
  return row;
}

/**
 * Reads a decoded JSON object through a record of expressions.
 *
 * A record names the entries it wants, so a value is read by the key the
 * record was built with and restored through the expression that produced it.
 */
function restoreRecord(
  obj: Record<string, unknown>,
  record: Record<string, unknown>,
): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key in record) {
    if (!hasOwn(obj, key)) continue;
    setOwn(picked, key, restoreOperandValue(record[key], obj[key]));
  }
  return picked;
}

/**
 * Reads a decoded JSON value back through the expression that produced it.
 *
 * A table row is read through its columns, a record through the entries it
 * names, and any other expression through itself.
 */
function restoreToJsonValue(target: unknown, parsed: unknown): unknown {
  if (is(target, Table)) {
    if (!isJsonObject(parsed)) return parsed;
    return restoreTableRow(parsed, target._.columns);
  }
  if (isPlainRecord(target)) {
    if (!isJsonObject(parsed)) return parsed;
    return restoreRecord(parsed, target);
  }
  return restoreOperandValue(target, parsed);
}

/**
 * Parses a JSON object driver value and restores its entries through `fields`.
 */
function restoreJsonObjectValue<TFields extends Record<string, JsonOperand>>(
  value: unknown,
  fields: TFields,
): { [K in keyof TFields]: InferValueType<TFields[K]> } | null {
  const parsed = parseJsonDriverValue(value);
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return parsed as
      | {
          [K in keyof TFields]: InferValueType<TFields[K]>;
        }
      | null;
  }
  return restoreJsonObject(parsed as Record<string, unknown>, fields) as {
    [K in keyof TFields]: InferValueType<TFields[K]>;
  };
}

/**
 * Restores a stripped JSON document through the expression that built it.
 */
function restoreStrippedJsonValue<TExpr extends JsonOperand>(
  value: unknown,
  expr: TExpr,
): InferValueType<TExpr> | null {
  return restoreOperandValue(expr, value) as InferValueType<TExpr> | null;
}

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
  "scalar",
  "json",
  { [K in keyof TFields]: InferValueType<TFields[K]> },
  THasArg,
  HasAggregateOf<TFields[keyof TFields]>
> {
  constructor(readonly fields: TFields) {
    super(SqlFn._hasAggregate(fields));
  }

  /** Returns all table columns directly referenced by fields of this JSON object. */
  get referencedColumns(): AnyColumn[] {
    const cols: AnyColumn[] = [];
    for (const key in this.fields) {
      const val = this.fields[key];
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
    return value === null ? "NULL" : jsonToSQLValue(value, "json");
  }

  fromDriverValue(
    value: unknown,
  ): { [K in keyof TFields]: InferValueType<TFields[K]> } | null {
    return restoreJsonObjectValue(value, this.fields);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "json_build_object(";
    const fields = this.fields;
    const keys = Object.keys(fields);
    const options = { preferJson: true, argCastFallback: "text" };
    for (let i = 0; i < keys.length; i++) {
      if (i !== 0) query.sql += ", ";
      query.sql += `'${escLiteral(keys[i])}', `;
      appendOperand(query, fields[keys[i]], ctx, options);
    }
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
  "scalar",
  "jsonb",
  { [K in keyof TFields]: InferValueType<TFields[K]> },
  THasArg,
  HasAggregateOf<TFields[keyof TFields]>
> {
  constructor(readonly fields: TFields) {
    super(SqlFn._hasAggregate(fields));
  }

  /** Returns all table columns directly referenced by fields of this JSON object. */
  get referencedColumns(): AnyColumn[] {
    const cols: AnyColumn[] = [];
    for (const key in this.fields) {
      const val = this.fields[key];
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
    return value === null ? "NULL" : jsonToSQLValue(value, "jsonb");
  }

  fromDriverValue(
    value: unknown,
  ): { [K in keyof TFields]: InferValueType<TFields[K]> } | null {
    return restoreJsonObjectValue(value, this.fields);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "jsonb_build_object(";
    const fields = this.fields;
    const keys = Object.keys(fields);
    const options = { preferJsonb: true, argCastFallback: "text" };
    for (let i = 0; i < keys.length; i++) {
      if (i !== 0) query.sql += ", ";
      query.sql += `'${escLiteral(keys[i])}', `;
      appendOperand(query, fields[keys[i]], ctx, options);
    }
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
 * Aggregates rows into a JSON array. Construct through `jsonAgg()`.
 */
export class JsonAggFn<
  TExpr extends JsonOperand,
  THasArg extends boolean = HasArg<TExpr>,
> extends AggregateSqlFn<
  ExprColumns<TExpr>,
  "json",
  InferValueType<TExpr>[] | null,
  THasArg
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
    return value === null ? "NULL" : jsonToSQLValue(value, "json");
  }

  fromDriverValue(value: unknown): InferValueType<TExpr>[] | null {
    const parsed = SqlFn._jsonFromDriver(value);
    if (!Array.isArray(parsed)) {
      return parsed as InferValueType<TExpr>[] | null;
    }
    return restoreJsonArray(parsed, this.expr) as
      | InferValueType<TExpr>[]
      | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "json_agg(";
    if (this.isDistinct) {
      query.sql += "DISTINCT ";
    }
    appendOperand(query, this.expr, ctx, {
      preferJson: true,
      argCastFallback: "text",
    });
    this.appendOrderBy(query, ctx);
    query.sql += ")";
    this.appendFilter(query, ctx);
  }
}

/**
 * SQL aggregate expression: `jsonb_agg(expr [ORDER BY ...]) [FILTER (WHERE ...)]`
 * Aggregates rows into a JSONB array. Construct through `jsonbAgg()`.
 */
export class JsonbAggFn<
  TExpr extends JsonOperand,
  THasArg extends boolean = HasArg<TExpr>,
> extends AggregateSqlFn<
  ExprColumns<TExpr>,
  "jsonb",
  InferValueType<TExpr>[] | null,
  THasArg
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
    return value === null ? "NULL" : jsonToSQLValue(value, "jsonb");
  }

  fromDriverValue(value: unknown): InferValueType<TExpr>[] | null {
    const parsed = SqlFn._jsonFromDriver(value);
    if (!Array.isArray(parsed)) {
      return parsed as InferValueType<TExpr>[] | null;
    }
    return restoreJsonArray(parsed, this.expr) as
      | InferValueType<TExpr>[]
      | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "jsonb_agg(";
    if (this.isDistinct) {
      query.sql += "DISTINCT ";
    }
    appendOperand(query, this.expr, ctx, {
      preferJsonb: true,
      argCastFallback: "text",
    });
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
export function jsonAgg<TExpr extends JsonAggOperand>(
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
export function jsonbAgg<TExpr extends JsonAggOperand>(
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

type InferToJsonRecord<TRecord> = {
  [K in keyof TRecord]: InferValueType<TRecord[K]>;
};

type InferToJsonReturn<TTarget> = TTarget extends AnyTableWithColumns
  ? TTarget["$"]["inferSelect"]
  : TTarget extends Record<string, AnyColumn>
    ? InferToJsonRecord<TTarget>
    : TTarget extends AnyColumn | AnySqlFn | Sql | AnyArg | Date
      ? InferValueType<TTarget>
      : TTarget extends readonly unknown[]
        ? { [K in keyof TTarget]: InferValueType<TTarget[K]> }
        : TTarget extends Record<string, unknown>
          ? InferToJsonRecord<TTarget>
          : InferValueType<TTarget>;

/**
 * Appends the `json_build_object(...)` arguments of a record target.
 *
 * A record names the entries it wants, so each entry becomes a key and its
 * value.
 */
function appendRecordBuildObject(
  query: Query,
  builder: "json_build_object" | "jsonb_build_object",
  record: Record<string, unknown>,
  ctx?: QueryContext,
  options?: AppendOperandOptions,
): void {
  query.sql += `${builder}(`;
  let first = true;
  for (const key in record) {
    if (!first) query.sql += ", ";
    first = false;
    query.sql += `'${escLiteral(key)}', `;
    appendOperand(query, record[key], ctx, options);
  }
  query.sql += ")";
}

/**
 * Appends a scalar `to_json` / `to_jsonb` target.
 *
 * A `Date` and an `Arg` need an explicit type: `to_json` is polymorphic, so an
 * untyped literal or placeholder cannot be resolved by PostgreSQL.
 */
function appendToJsonScalar(
  query: Query,
  target: unknown,
  ctx?: QueryContext,
  options?: AppendOperandOptions,
): void {
  if (target === null || target === undefined) {
    // `to_json(NULL)` cannot resolve the polymorphic argument type.
    query.sql += "NULL::text";
    return;
  }
  if (typeof target === "string") {
    query.sql += `'${escLiteral(target)}'::text`;
    return;
  }
  if (target instanceof Date) {
    query.sql += Number.isNaN(target.getTime())
      ? "NULL::text"
      : `'${target.toISOString()}'::text`;
    return;
  }
  if (is(target, Arg)) {
    query.addArg(target, target.cast ?? target.jsonCast ?? "text");
    return;
  }
  appendOperand(query, target, ctx, options);
}

/**
 * SQL scalar expression: `to_json(target)`
 * Converts an entire table row, record, column, or expression to a JSON value.
 */
export class ToJsonFn<
  TTarget extends ToJsonTarget,
  THasArg extends boolean = HasArg<TTarget>,
> extends SqlFn<
  ExprColumns<TTarget>,
  "scalar",
  "json",
  InferToJsonReturn<TTarget>,
  THasArg,
  HasAggregateOf<TTarget>
> {
  constructor(readonly target: TTarget) {
    super(SqlFn._hasAggregate(target));
  }

  toDriverValue(value: InferToJsonReturn<TTarget> | null): unknown {
    return value;
  }

  toSQLValue(value: InferToJsonReturn<TTarget> | null): string {
    return value === null ? "NULL" : jsonToSQLValue(value, "json");
  }

  fromDriverValue(value: unknown): InferToJsonReturn<TTarget> | null {
    return restoreToJsonValue(
      this.target,
      value,
    ) as InferToJsonReturn<TTarget> | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "to_json(";
    if (is(this.target, Table)) {
      query.sql += `"${escIdentifier(this.target._.nameSql)}"`;
    } else if (isPlainRecord(this.target)) {
      appendRecordBuildObject(query, "json_build_object", this.target, ctx, {
        preferJson: true,
        argCastFallback: "text",
      });
    } else {
      appendToJsonScalar(query, this.target, ctx, { preferJson: true });
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
  "scalar",
  "jsonb",
  InferToJsonReturn<TTarget>,
  THasArg,
  HasAggregateOf<TTarget>
> {
  constructor(readonly target: TTarget) {
    super(SqlFn._hasAggregate(target));
  }

  toDriverValue(value: InferToJsonReturn<TTarget> | null): unknown {
    return value;
  }

  toSQLValue(value: InferToJsonReturn<TTarget> | null): string {
    return value === null ? "NULL" : jsonToSQLValue(value, "jsonb");
  }

  fromDriverValue(value: unknown): InferToJsonReturn<TTarget> | null {
    return restoreToJsonValue(
      this.target,
      value,
    ) as InferToJsonReturn<TTarget> | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "to_jsonb(";
    if (is(this.target, Table)) {
      query.sql += `"${escIdentifier(this.target._.nameSql)}"`;
    } else if (isPlainRecord(this.target)) {
      appendRecordBuildObject(query, "jsonb_build_object", this.target, ctx, {
        preferJsonb: true,
        argCastFallback: "text",
      });
    } else {
      appendToJsonScalar(query, this.target, ctx, { preferJsonb: true });
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
  "scalar",
  "json",
  { [K in keyof TItems]: InferValueType<TItems[K]> },
  THasArg,
  HasAggregateOf<TItems[number]>
> {
  constructor(readonly items: TItems) {
    super(SqlFn._hasAggregate(items));
  }

  toDriverValue(
    value: { [K in keyof TItems]: InferValueType<TItems[K]> } | null,
  ): unknown {
    return value;
  }

  toSQLValue(
    value: { [K in keyof TItems]: InferValueType<TItems[K]> } | null,
  ): string {
    return value === null ? "NULL" : jsonToSQLValue(value, "json");
  }

  fromDriverValue(
    value: unknown,
  ): { [K in keyof TItems]: InferValueType<TItems[K]> } | null {
    const parsed = SqlFn._jsonFromDriver(value);
    if (!Array.isArray(parsed)) {
      return parsed as
        | {
            [K in keyof TItems]: InferValueType<TItems[K]>;
          }
        | null;
    }
    return restoreJsonArray(parsed, undefined, this.items) as
      | {
          [K in keyof TItems]: InferValueType<TItems[K]>;
        }
      | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "json_build_array(";
    const items = this.items;
    const options = { preferJson: true, argCastFallback: "text" };
    for (let i = 0; i < items.length; i++) {
      if (i !== 0) query.sql += ", ";
      appendOperand(query, items[i], ctx, options);
    }
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
  "scalar",
  "jsonb",
  { [K in keyof TItems]: InferValueType<TItems[K]> },
  THasArg,
  HasAggregateOf<TItems[number]>
> {
  constructor(readonly items: TItems) {
    super(SqlFn._hasAggregate(items));
  }

  toDriverValue(
    value: { [K in keyof TItems]: InferValueType<TItems[K]> } | null,
  ): unknown {
    return value;
  }

  toSQLValue(
    value: { [K in keyof TItems]: InferValueType<TItems[K]> } | null,
  ): string {
    return value === null ? "NULL" : jsonToSQLValue(value, "jsonb");
  }

  fromDriverValue(
    value: unknown,
  ): { [K in keyof TItems]: InferValueType<TItems[K]> } | null {
    const parsed = SqlFn._jsonFromDriver(value);
    if (!Array.isArray(parsed)) {
      return parsed as
        | {
            [K in keyof TItems]: InferValueType<TItems[K]>;
          }
        | null;
    }
    return restoreJsonArray(parsed, undefined, this.items) as
      | {
          [K in keyof TItems]: InferValueType<TItems[K]>;
        }
      | null;
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "jsonb_build_array(";
    const items = this.items;
    const options = { preferJsonb: true, argCastFallback: "text" };
    for (let i = 0; i < items.length; i++) {
      if (i !== 0) query.sql += ", ";
      appendOperand(query, items[i], ctx, options);
    }
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
  "scalar",
  "json",
  InferValueType<TExpr>,
  THasArg,
  HasAggregateOf<TExpr>
> {
  constructor(readonly expr: TExpr) {
    super(SqlFn._hasAggregate(expr));
  }

  toDriverValue(value: unknown): unknown {
    return value;
  }

  toSQLValue(value: unknown): string {
    return value === null ? "NULL" : jsonToSQLValue(value, "json");
  }

  fromDriverValue(value: unknown): InferValueType<TExpr> | null {
    return restoreStrippedJsonValue(value, this.expr);
  }

  toQuery(query: Query, ctx?: QueryContext): void {
    query.sql += "json_strip_nulls(";
    appendOperand(query, this.expr, ctx, { preferJson: true });
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
  "scalar",
  "jsonb",
  InferValueType<TExpr>,
  THasArg,
  HasAggregateOf<TExpr>
> {
  constructor(readonly expr: TExpr) {
    super(SqlFn._hasAggregate(expr));
  }

  toDriverValue(value: unknown): unknown {
    return value;
  }

  toSQLValue(value: unknown): string {
    return value === null ? "NULL" : jsonToSQLValue(value, "jsonb");
  }

  fromDriverValue(value: unknown): InferValueType<TExpr> | null {
    return restoreStrippedJsonValue(value, this.expr);
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
