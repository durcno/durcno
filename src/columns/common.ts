import * as z from "zod";
import { SqlFn, type StdSqlFn } from "../functions";
import { Arg } from "../query-builders/pre";
import type { Query } from "../query-builders/query";
import { Sql } from "../sql";
import { entityType } from "../symbols";
import type { StdTable, StdTableColumn, TableColumn } from "../table";
import type { Key } from "../types";
import { camelToSnake } from "../utils";

export const notNull = true as const;
export const unique = true as const;
export const primaryKey = true as const;
export const identity = "IDENTITY" as const;

// Helper type to build a tuple of fixed length
type Tuple<T, L extends number, Acc extends T[] = []> = Acc["length"] extends L
  ? Acc
  : Tuple<T, L, [...Acc, T]>;

// Process dimensions from left to right (first = innermost)
type MultiDimValueArray<
  T,
  D extends readonly (number | null)[],
> = D extends readonly [infer First, ...infer Rest]
  ? First extends number
    ? Rest extends readonly (number | null)[]
      ? MultiDimValueArray<Tuple<T, First>, Rest>
      : never
    : First extends null
      ? Rest extends readonly (number | null)[]
        ? MultiDimValueArray<T[], Rest>
        : never
      : never
  : T;

// Helper type to extract array value type from TConfig
type GetValueArray<T, TConfig> = TConfig extends { dimension: infer D }
  ? D extends readonly (number | null)[]
    ? MultiDimValueArray<T, D>
    : T
  : T;

// Process dimensions from left to right (first = innermost)
type MultiDimZodTypeArray<
  T extends z.ZodType,
  D extends readonly (number | null)[],
> = D extends readonly [infer First, ...infer Rest]
  ? First extends number
    ? Rest extends readonly (number | null)[]
      ? MultiDimZodTypeArray<z.ZodTuple<Tuple<T, First>, null>, Rest>
      : never
    : First extends null
      ? Rest extends readonly (number | null)[]
        ? MultiDimZodTypeArray<z.ZodArray<T>, Rest>
        : never
      : never
  : T;

// Helper type to extract array Zod type from TConfig
type GetZodTypeArray<T extends z.ZodType, TConfig> = TConfig extends {
  dimension: infer D;
}
  ? D extends readonly (number | null)[]
    ? MultiDimZodTypeArray<T, D>
    : T
  : T;

interface TableLike {
  _: {
    schema: string;
    name: string;
  };
}

export const OnDeleteActions = [
  "CASCADE",
  "SET NULL",
  "SET DEFAULT",
  "RESTRICT",
  "NO ACTION",
] as const;

export type OnDeleteAction = (typeof OnDeleteActions)[number];

export type ColumnConfig = {
  /**
   * SQL equivalent: `PRIMARY KEY`
   */
  primaryKey?: true;
  /**
   * SQL equivalent: `UNIQUE`
   */
  unique?: true;
  /**
   * SQL equivalent: `NOT NULL`
   */
  notNull?: true;
  /**
   * The dimension of the array column.
   */
  dimension?: Readonly<[number | null, ...(number | null)[]]>;
};

/**
 * Type that augments C with a `hasDefault` property set to true.
 * Used as the return type of `default()` method.
 */
type HasDefault<C> = C & { hasDefault: true };

export type GeneratedAlways<C> = C & { isGeneratedAlways: true };
export type GeneratedByDefault<C> = C & {
  isGeneratedByDefault: true;
};

/**
 * Type that augments C with a `hasInsertFn` property set to true.
 * Used as the return type of `$insertFn()` method.
 */
type HasInsertFn<C> = C & { hasInsertFn: true };

/**
 * Type that augments C with a `hasUpdateFn` property set to true.
 * Used as the return type of `$updateFn()` method.
 */
type HasUpdateFn<C> = C & { hasUpdateFn: true };

/**
 * Describes a foreign key reference target for `references()`.
 * Supports either a direct column resolver function or an object with
 * a resolver and optional `onDelete` action.
 */
type BuildRef<ValType> =
  | (() => TableColumn<string, string, Key, Column<any, ValType, any>>)
  | {
      column: () => TableColumn<string, string, Key, Column<any, ValType, any>>;
      onDelete?: OnDeleteAction;
    };

/**
 * Type that augments C with a `hasReferences` property set to true.
 * Used for columns that have foreign key references.
 */
type HasReferences<C> = C & { hasReferences: true };

/**
 * Type that augments C with a `ValTypeOverriden` property set to true and a `ValTypeOverride` property set to U.
 */
export type SetValueType<C, U> = C & {
  $: {
    HasValTypeOverridde: true;
    ValTypeOverride: U;
  };
};

export abstract class Column<
  TConfig extends ColumnConfig,
  TColVal,
  TPgType extends string = string,
> {
  static readonly [entityType] = "Column";
  readonly config: TConfig;
  readonly $!: {
    /** Phantom discriminant id for this entity kind. */
    kind: "column";
    /** The PostgreSQL type category for this column. */
    PgType: TPgType;
    /** The TypeScript type for this column's value. */
    TsType: TColVal;
    TsTypeScalar: TColVal;
    ValTypeBase: GetValueArray<TColVal, TConfig>;
    // biome-ignore lint/complexity/noBannedTypes: <>
    HasValTypeOverridde: {};
    // biome-ignore lint/complexity/noBannedTypes: <>
    ValTypeOverride: {};
  };
  readonly ValType!: this["$"]["HasValTypeOverridde"] extends true
    ? this["$"]["ValTypeOverride"]
    : this["$"]["ValTypeBase"];
  readonly ValTypeInsert!: this extends {
    isGeneratedAlways: true;
  }
    ? never
    : this extends { isGeneratedByDefault: true }
      ? this["ValType"] | undefined
      : this extends {
            hasDefault: true;
          }
        ? this["ValType"] | Sql | null | undefined
        : this extends { hasInsertFn: true }
          ? this["ValType"] | Sql | null | undefined
          : TConfig extends {
                notNull: true;
              }
            ? this["ValType"] | Sql
            : this["ValType"] | Sql | null | undefined;
  readonly ValTypeUpdate!: TConfig extends { primaryKey: true }
    ? never
    : TConfig extends { notNull: true }
      ? this["ValType"]
      : this["ValType"] | null;
  readonly ValTypeSelect!: TConfig extends
    | {
        isGeneratedAlways: true;
      }
    | {
        isGeneratedByDefault: true;
      }
    ? this["ValType"]
    : TConfig extends {
          primaryKey: true;
        }
      ? this["ValType"]
      : TConfig extends {
            notNull: true;
          }
        ? this["ValType"]
        : this["ValType"] | null;
  #default: this["ValType"] | Sql | undefined;
  #insertFn: (() => this["ValType"]) | undefined;
  #updateFn: (() => this["ValType"]) | undefined;
  readonly #primaryKey: boolean;
  readonly #unique: boolean;
  readonly #notNull: boolean;
  #generated: "ALWAYS" | "BY DEFAULT" | undefined;
  #generatedAs: string | Sql | StdSqlFn | undefined;
  #references:
    | { column: () => StdTableColumn; onDelete: OnDeleteAction }
    | undefined;

  // Stores the key/name of the column
  #name: string | undefined;
  // Stores the snake_case name of the column for SQL usage
  #nameSnake: string | undefined;
  // Stores the table reference
  #table: undefined;

  constructor(config: TConfig) {
    this.config = config;
    this.#primaryKey = "primaryKey" in config ? !!config.primaryKey : false;
    this.#unique = "unique" in config ? !!config.unique : false;
    this.#notNull = "notNull" in config ? !!config.notNull : false;
  }

  _ = {
    // Setter to set the column key/name when the column is added to a table
    setName: (name: string) => {
      this.#name = name;
      this.#nameSnake = camelToSnake(name);
    },
    // Setter to set the table reference when the column is added to a table
    setTable: (table: StdTable) => {
      this.#table = table as unknown as undefined;
    },
  };

  // Getter to access the column key/name
  get name() {
    return this.#name;
  }

  // Getter to access the snake_case column key/name for SQL usage
  get nameSnake() {
    return this.#nameSnake;
  }

  // Getter to access the table reference
  get table(): TableLike | undefined {
    return this.#table;
  }

  get isPrimaryKey() {
    return this.#primaryKey as TConfig extends { primaryKey: true }
      ? true
      : false;
  }

  get isUnique() {
    return this.#unique as TConfig extends { unique: true } ? true : false;
  }

  get isNotNull() {
    return this.#notNull as TConfig extends { notNull: true } ? true : false;
  }

  abstract get sqlTypeScalar(): string;
  get sqlType() {
    const base = this.sqlTypeScalar;
    if (!this.config.dimension) return base;

    // For each configured dimension, append either `[N]` (fixed size) or `[]` (unspecified)
    const suffix = this.config.dimension
      .map((d) => (d === null ? "[]" : `[${d}]`))
      .join("");
    return `${base}${suffix}`;
  }

  /** Returns the PostgreSQL cast type for this column's scalar value, or `null` if no cast is needed. */
  abstract get sqlCastScalar(): string | null;

  /** Returns the full PostgreSQL cast type including array dimensions, or `null` if no cast is needed. */
  get sqlCast(): string | null {
    const base = this.sqlCastScalar;
    if (base === null) return null;
    if (!this.config.dimension) return base;

    const suffix = this.config.dimension
      .map((d) => (d === null ? "[]" : `[${d}]`))
      .join("");
    return `${base}${suffix}`;
  }

  abstract get zodTypeScaler(): z.ZodType;
  get zodType() {
    let schema: z.ZodType = this.zodTypeScaler;
    if (!this.config.dimension) {
      return schema as GetZodTypeArray<this["zodTypeScaler"], this["config"]>;
    }

    // dimensions are processed left-to-right where first = innermost
    for (const dim of this.config.dimension) {
      if (typeof dim === "number") {
        schema = z.tuple(Array(dim).map(() => schema) as [z.ZodAny]);
      } else {
        schema = z.array(schema);
      }
    }

    return schema as GetZodTypeArray<this["zodTypeScaler"], this["config"]>;
  }

  /**
   * Returns the fully-qualified, double-quoted column identifier separated by a dot.
   * @returns string `"table"."column"`
   */
  get fullName(): string {
    return `"${this.table?._.name}"."${this.nameSnake}"`;
  }

  toQuery(query: Query) {
    query.sql += this.fullName;
  }

  // Abstract methods for scalar (single-value) conversions - to be implemented by each column type
  abstract toDriverScalar(value: TColVal | Sql | null): string | number | null;
  abstract toSQLScalar(value: TColVal | Sql | null): string;
  abstract fromDriverScalar(value: unknown): TColVal | null;

  /**
   * Converts a JavaScript value to the PostgreSQL driver format.
   * Handles array dimensions if configured, otherwise delegates to scalar implementation.
   */
  toDriver(value: this["ValType"] | Sql | null): string | number | null {
    if (value === null) return null;
    if (value instanceof Sql) return value.string;

    if (!this.config.dimension) {
      // No dimensions - delegate to scalar implementation
      return this.toDriverScalar(value as TColVal | Sql | null);
    }

    // Has dimensions - handle as array
    const arr = value as unknown[];
    const elements = arr.map((item) => this.#toDriverArrayElement(item, 0));
    return elements as unknown as string;
  }

  /**
   * Helper to recursively process multi-dimensional arrays for toDriver.
   */
  #toDriverArrayElement(value: unknown, dimIndex: number): unknown {
    const dimensions = this.config.dimension as unknown as (number | null)[];
    if (dimIndex >= dimensions.length - 1) {
      // Innermost dimension - use scalar method
      return this.toDriverScalar(value as TColVal | Sql | null);
    }
    // Not at innermost - recurse
    const arr = value as unknown[];
    return arr.map((item) => this.#toDriverArrayElement(item, dimIndex + 1));
  }

  /**
   * Converts a JavaScript value to SQL string literal.
   * Handles array dimensions with ARRAY[...] syntax if configured.
   */
  toSQL(
    value: this["ValType"] | Sql | null,
    options?: { cast?: boolean },
  ): string {
    if (value === null) return "NULL";
    if (value instanceof Sql) return value.string;

    if (!this.config.dimension) {
      if (!options?.cast || !this.sqlCastScalar) return this.toSQLScalar(value);
      return `${this.toSQLScalar(value)}::${this.sqlCastScalar}`;
    }

    // Handle array with ARRAY[...] syntax
    return this.#toSQLArray(value as unknown[], 0, options);
  }

  /**
   * Helper to recursively process multi-dimensional arrays for toSQL.
   */
  #toSQLArray(
    arr: unknown[],
    dimIndex: number,
    options?: { cast?: boolean },
  ): string {
    const dimensions = this.config.dimension as unknown as (number | null)[];
    if (arr.length === 0) {
      return "'{}'";
    }

    if (dimIndex >= dimensions.length - 1) {
      // Innermost dimension - elements are scalars
      const elements = arr.map((item) => {
        if (!options?.cast || !this.sqlCastScalar)
          return this.toSQLScalar(item as TColVal | Sql);
        return `${this.toSQLScalar(item as TColVal | Sql)}::${this.sqlCastScalar}`;
      });
      return `ARRAY[${elements.join(", ")}]`;
    }

    // Not at innermost - elements are arrays
    const elements = arr.map((item) =>
      this.#toSQLArray(item as unknown[], dimIndex + 1, options),
    );
    return `ARRAY[${elements.join(", ")}]`;
  }

  /**
   * Converts a PostgreSQL result back to JavaScript value.
   * Handles array dimensions if configured, otherwise delegates to scalar implementation.
   */
  fromDriver(value: unknown): this["ValType"] | null {
    if (value === null) return null;

    if (!this.config.dimension) {
      return this.fromDriverScalar(value) as this["ValType"] | null;
    }

    // Handle array from driver
    // PostgreSQL may return arrays as strings for certain types (like enum arrays)
    let arr: unknown[];
    if (typeof value === "string") {
      arr = this.#parsePostgresArrayString(value);
    } else {
      arr = value as unknown[];
    }

    return this.#fromDriverArray(arr, 0) as this["ValType"] | null;
  }

  /**
   * Parses a PostgreSQL array string format like {val1,val2,val3} into a JavaScript array.
   * Handles nested arrays and quoted strings.
   */
  #parsePostgresArrayString(str: string): unknown[] {
    // Handle empty array
    if (str === "{}") return [];

    // Remove outer braces
    const inner = str.slice(1, -1);

    // Parse the elements
    const result: unknown[] = [];
    let depth = 0;
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < inner.length; i++) {
      const char = inner[i];

      if (char === '"' && (i === 0 || inner[i - 1] !== "\\")) {
        inQuotes = !inQuotes;
        current += char;
      } else if (!inQuotes && char === "{") {
        depth++;
        current += char;
      } else if (!inQuotes && char === "}") {
        depth--;
        current += char;
      } else if (!inQuotes && char === "," && depth === 0) {
        result.push(this.#parsePostgresArrayElement(current));
        current = "";
      } else {
        current += char;
      }
    }

    if (current) {
      result.push(this.#parsePostgresArrayElement(current));
    }

    return result;
  }

  /**
   * Parses a single element from a PostgreSQL array string.
   */
  #parsePostgresArrayElement(element: string): unknown {
    // If it's a nested array
    if (element.startsWith("{") && element.endsWith("}")) {
      return this.#parsePostgresArrayString(element);
    }

    // If it's a quoted string, remove quotes and unescape
    if (element.startsWith('"') && element.endsWith('"')) {
      return element.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }

    // Handle NULL
    if (element === "NULL") {
      return null;
    }

    // Return as-is (for unquoted strings like enum values)
    return element;
  }

  /**
   * Helper to recursively process multi-dimensional arrays for fromDriver.
   */
  #fromDriverArray(arr: unknown[], dimIndex: number): unknown[] {
    const dimensions = this.config.dimension as unknown as (number | null)[];
    if (dimIndex >= dimensions.length - 1) {
      // Innermost dimension - convert scalars
      return arr.map((item) => this.fromDriverScalar(item));
    }

    // Not at innermost - recurse
    return arr.map((item) =>
      this.#fromDriverArray(item as unknown[], dimIndex + 1),
    );
  }

  /**
   * Sets a default value for this column.
   * SQL equivalent: `DEFAULT <value>`
   * @param value - The default value or SQL expression
   * @returns this column instance
   */
  default(value: this["ValType"] | Sql): HasDefault<this> {
    this.#default = value;
    return this as HasDefault<this>;
  }
  get hasDefault() {
    return this.#default !== undefined;
  }
  get getDefaultSqlStr(): string | undefined {
    if (this.#default === undefined) return undefined;
    return this.toSQL(this.#default);
  }

  /**
   * Marks this column as always generated (identity or generated always as expression).
   * SQL equivalent: `GENERATED ALWAYS`
   * @returns this column instance typed as `GeneratedAlways`
   */
  generatedAlways() {
    this.#generated = "ALWAYS";
    return this as GeneratedAlways<this>;
  }
  get isGeneratedAlways() {
    return this.#generated === "ALWAYS";
  }
  /**
   * Marks this column as generated by default (identity or generated by default as expression).
   * SQL equivalent: `GENERATED BY DEFAULT`
   * @returns this column instance typed as `GeneratedByDefault`
   */
  generatedByDefault() {
    this.#generated = "BY DEFAULT";
    return this as GeneratedByDefault<this>;
  }
  get isGeneratedByDefault() {
    return this.#generated === "BY DEFAULT";
  }
  get getGenerated() {
    return this.#generated;
  }

  /**
   * Sets the SQL expression used for a generated column.
   * SQL equivalent: `GENERATED (ALWAYS|BY DEFAULT) AS (<expression>)`
   * @param as - A SQL string or `Sql` expression that defines the generated value
   * @returns this column instance
   */
  as(as: string | Sql) {
    this.#generatedAs = as;
    return this;
  }
  get getGeneratedAs() {
    if (this.#generatedAs instanceof Sql) {
      return this.#generatedAs.string;
    } else if (this.#generatedAs instanceof SqlFn) {
      return this.#generatedAs.toSQL();
    }
    return this.#generatedAs;
  }

  /**
   * Sets a foreign key reference for this column.
   * SQL equivalent: `REFERENCES <table>(<column>) [ON DELETE <action>]`
   * @param ref - A function returning the referenced column, or an object with column and onDelete
   * @returns this column instance
   */
  references(ref: BuildRef<this["ValType"]>) {
    if (typeof ref === "function") {
      this.#references = {
        column: ref as () => StdTableColumn,
        onDelete: "CASCADE",
      };
    } else {
      this.#references = {
        column: ref.column as () => StdTableColumn,
        onDelete: ref.onDelete ?? "CASCADE",
      };
    }
    return this as HasReferences<this>;
  }
  get hasReferences(): boolean {
    return this.#references !== undefined;
  }
  get getReferencesCol(): StdTableColumn | null {
    return this.#references ? this.#references.column() : null;
  }
  get getReferencesOnDelete(): OnDeleteAction | null {
    return this.#references ? this.#references.onDelete : null;
  }

  /**
   * Sets a function to be called during INSERT queries to generate a value.
   * @param fn - A function that returns the value to insert
   * @returns HasInsertFn<this>
   */
  $insertFn(fn: () => this["ValType"]) {
    this.#insertFn = fn;
    return this as HasInsertFn<this>;
  }
  get hasInsertFn() {
    return this.#insertFn !== undefined;
  }
  get getInsertFnVal(): this["ValType"] | null {
    return this.#insertFn ? this.#insertFn() : null;
  }

  /**
   * Sets a function to be called during UPDATE queries to generate a value.
   * @param fn - A function that returns the value to use in updates
   * @returns HasUpdateFn<this>
   */
  $updateFn(fn: () => this["ValType"]) {
    this.#updateFn = fn;
    return this as HasUpdateFn<this>;
  }
  get hasUpdateFn() {
    return this.#updateFn !== undefined;
  }
  get getUpdateFnVal(): this["ValType"] | null {
    return this.#updateFn ? this.#updateFn() : null;
  }

  /**
   * Specifies the TypeScript type for this column's value.
   * This is a compile-time only operation and does not affect runtime behavior.
   * @returns this column with the specified value type
   */
  $type<T>(): SetValueType<this, T> {
    // This is a type-level operation only - the column instance remains the same
    return this as unknown as SetValueType<this, T>;
  }

  /** Creates an `Arg` instance for this column, to be used in prepared queries.
   * @returns an `Arg` instance with the type of this column
   */
  arg() {
    return new Arg(this.toDriver.bind(this), this.sqlCast) as Arg<
      this["ValType"]
    >;
  }
}

// biome-ignore lint/suspicious/noExplicitAny: A Column value can be anything
export type StdColumn = Column<ColumnConfig, any, string>;
