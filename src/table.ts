import type { Column } from "./columns/common";
import type { Check, CheckExpression } from "./constraints/check";
import type { ForeignKey, ForeignKeyFn } from "./constraints/foreign-key";
import type {
  PrimaryKeyConstraint,
  PrimaryKeyConstraintFn,
} from "./constraints/primary-key";
import type {
  UniqueConstraint,
  UniqueConstraintFn,
} from "./constraints/unique";
import type { Index } from "./indexes";
import { entityType } from "./symbols";
import type { CamelToSnake, Key, SnakeCase, Valueof } from "./types";
import { camelToSnake } from "./utils";

// biome-ignore lint/suspicious/noExplicitAny: AnyColumn is a wildcard type for any column
export type AnyColumn = Column<any, any, any>;

type TableExtra<
  TSchema extends string,
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> = {
  indexes?: (
    ...args: [TableWithColumns<TSchema, TName, TColumns>]
  ) => Index<TColumns[keyof TColumns]>[];
  primaryKeyConstraint?: (
    table: TableWithColumns<TSchema, TName, TColumns>,
    primaryKey: PrimaryKeyConstraintFn,
  ) => PrimaryKeyConstraint;
  uniqueConstraints?: (
    table: TableWithColumns<TSchema, TName, TColumns>,
    unique: UniqueConstraintFn,
  ) => UniqueConstraint[];
  checkConstraints?: (
    table: TableWithColumns<TSchema, TName, TColumns>,
    check: (
      name: string,
      expr: CheckExpression<
        Valueof<TableWithColumns<TSchema, TName, TColumns>["_"]["columns"]>
      >,
    ) => Check,
  ) => Check[];
  foreignKeys?: (
    table: TableWithColumns<TSchema, TName, TColumns>,
    fk: ForeignKeyFn,
  ) => ForeignKey[];
};

type TableConfig<
  TSchema extends string,
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> = {
  /** The raw table name as provided by the user (may be camelCase). */
  readonly name: TName;
  /** The snake_case version of {@link TableConfig.name} used in generated SQL. */
  readonly nameSql: SnakeCase<CamelToSnake<TName>>;
  /** The raw schema identifier as provided by the user (may be camelCase). */
  readonly schema: TSchema;
  /** The snake_case version of {@link TableConfig.schema} used in generated SQL. */
  readonly schemaSql: SnakeCase<CamelToSnake<TSchema>>;
  /** Fully-qualified table name as a double-quoted SQL identifier: `"schema"."table"`. */
  readonly fullName: `"${CamelToSnake<TSchema>}"."${CamelToSnake<TName>}"`;
  readonly columns: {
    [ColName in keyof TColumns]: TableColumn<
      TSchema,
      TName,
      ColName,
      TColumns[ColName]
    >;
  };
  /** Pre-built index keyed by snake_case SQL column name for fast lookups. */
  readonly columnsBySql: {
    readonly [K: string]: TableColumn<TSchema, TName, string, AnyColumn>;
  };
  readonly extra: TableExtra<TSchema, TName, TColumns>;
};

export type TableColumn<
  TTSchema extends string,
  TTName extends string,
  TName extends Key,
  TColumn extends AnyColumn,
> = TColumn & {
  /** Phantom type markers carrying the schema and table name for inference. */
  $: {
    schema: TTSchema;
    table: TTName;
  };
  name: TName;
  /** The snake_case column name used in generated SQL. */
  nameSql: SnakeCase<CamelToSnake<Extract<TName, string>>>;
  table: StdTable;
};

export type StdTableColumn<TCol extends AnyColumn = AnyColumn> = TableColumn<
  string,
  string,
  Key,
  TCol
>;

export type TableAnyColumn<TCol extends AnyColumn = AnyColumn> = TableColumn<
  any,
  any,
  any,
  TCol
>;

export type AnyScalarColumn = AnyColumn & {
  config: { dimension?: undefined };
};

function bindNameNTable(table: StdTable, columns: Record<string, AnyColumn>) {
  for (const [ColName, col] of Object.entries(columns)) {
    col._.setName(ColName);
    col._.setTable(table);
  }
  return columns;
}

export class Table<
  TSchema extends string,
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> {
  static readonly [entityType] = "Table";
  readonly $!: {
    inferSelect: {
      [ColName in keyof TColumns]: TColumns[ColName]["ValTypeSelect"];
    };
    columns: TColumns;
  };
  _: TableConfig<TSchema, TName, TColumns>;

  constructor(
    schema: TSchema,
    name: TName,
    columns: TColumns,
    extra: TableExtra<TSchema, TName, TColumns>,
  ) {
    bindNameNTable(this as unknown as StdTable, columns);
    this._ = {
      schema,
      schemaSql: camelToSnake(schema),
      name,
      nameSql: camelToSnake(name),
      fullName: `"${camelToSnake(schema)}"."${camelToSnake(name)}"`,
      columns: columns as TableConfig<TSchema, TName, TColumns>["columns"],
      columnsBySql: Object.fromEntries(
        Object.values(columns).map((col) => [col.nameSql, col]),
      ) as TableConfig<TSchema, TName, TColumns>["columnsBySql"],
      extra,
    };
  }
}

export type StdTable = Table<string, string, Record<string, AnyColumn>>;

// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnyTable = Table<any, any, any>;

export type TableWithColumns<
  TTSchema extends string,
  TTName extends string,
  TColumns extends Record<string, AnyColumn>,
> = Table<TTSchema, TTName, TColumns> &
  Table<TTSchema, TTName, TColumns>["_"]["columns"];

export type StdTableWithColumns = TableWithColumns<
  string,
  string,
  Record<string, AnyColumn>
>;

// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnyTableWithColumns = TableWithColumns<any, any, any>;

export type AnyTableWC = TableWithColumns<
  string,
  string,
  Record<any, AnyColumn>
>;

export type TableWCorNever<T> =
  T extends TableWithColumns<infer TTSchema, infer TTName, infer TColumns>
    ? TColumns extends Record<string, AnyColumn>
      ? TableWithColumns<TTSchema, TTName, TColumns>
      : never
    : never;

export type IsTableWC<T> =
  // biome-ignore lint/suspicious/noExplicitAny: <>
  T extends TableWithColumns<any, any, any> ? true : false;

/**
 * Creates a typed table definition with column accessors.
 *
 * @example
 * ```ts
 * import { table, pk, varchar } from "durcno";
 *
 * export const Users = table("public", "users", {
 *   id: pk(),
 *   email: varchar({ length: 255 }),
 * });
 * ```
 */
export function table<
  TSchema extends string,
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
>(
  schema: TSchema,
  name: TName,
  columns: TColumns,
  extra?: TableExtra<TSchema, TName, TColumns>,
) {
  const table = new Table(schema, name, columns, extra ?? {});
  for (const colName in table._.columns) {
    Object.defineProperty(table, colName, {
      get() {
        return table._.columns[colName];
      },
    });
  }
  return table as TableWithColumns<TSchema, TName, TColumns>;
}

export class One<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TCol extends TableWithColumns<TTSchema, TTName, TTColumns>[keyof TTColumns],
> {
  readonly t: "One" = "One";
  readonly table: TableWithColumns<TTSchema, TTName, TTColumns>;
  readonly col: TCol;

  constructor(table: TableWithColumns<TTSchema, TTName, TTColumns>, col: TCol) {
    this.table = table;
    this.col = col;
  }
}

/**
 * Defines a one-to-one relation where the foreign key is on the **related** table.
 *
 * @param table - The related table that holds the foreign key column
 * @param col - The foreign key column on the related table
 *
 * @example
 * ```ts
 * export const UsersRelations = relations(Users, () => ({
 *   profile: one(UserProfiles, UserProfiles.userId),
 * }));
 * ```
 */
export function one<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TCol extends TableWithColumns<TTSchema, TTName, TTColumns>[keyof TTColumns],
>(table: TableWithColumns<TTSchema, TTName, TTColumns>, col: TCol) {
  return new One(table, col);
}

export class Many<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TCol extends TableWithColumns<TTSchema, TTName, TTColumns>[keyof TTColumns],
> {
  readonly t: "Many" = "Many";
  readonly table: TableWithColumns<TTSchema, TTName, TTColumns>;
  readonly col: TCol;

  constructor(table: TableWithColumns<TTSchema, TTName, TTColumns>, col: TCol) {
    this.table = table;
    this.col = col;
  }
}

/**
 * Defines a one-to-many relation where the foreign key is on the **target** table.
 *
 * @param table - The target table that contains the foreign key
 * @param col - The foreign key column on the target table referencing this table
 *
 * @example
 * ```ts
 * export const UsersRelations = relations(Users, () => ({
 *   posts: many(Posts, Posts.userId),
 * }));
 * ```
 */
export function many<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TCol extends TableWithColumns<TTSchema, TTName, TTColumns>[keyof TTColumns],
>(table: TableWithColumns<TTSchema, TTName, TTColumns>, col: TCol) {
  return new Many(table, col);
}

export class Fk<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TCol extends TableAnyColumn,
> {
  readonly t: "Fk" = "Fk";
  readonly col: TCol;
  readonly table: TableWithColumns<TTSchema, TTName, TTColumns>;

  constructor(col: TCol, table: TableWithColumns<TTSchema, TTName, TTColumns>) {
    this.col = col;
    this.table = table;
  }
}

/**
 * Defines a many-to-one relation where the foreign key is on the **current** table.
 *
 * @param col - The foreign key column on the current table
 * @param table - The referenced table that the foreign key points to
 *
 * @example
 * ```ts
 * export const PostsRelations = relations(Posts, () => ({
 *   author: fk(Posts.userId, Users),
 * }));
 * ```
 */
export function fk<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TCol extends TableAnyColumn,
>(col: TCol, table: TableWithColumns<TTSchema, TTName, TTColumns>) {
  return new Fk(col, table);
}

export type AnyRelation =
  // biome-ignore lint/suspicious/noExplicitAny: uses any for extends
  | Many<any, any, any, TableAnyColumn>
  // biome-ignore lint/suspicious/noExplicitAny: uses any for extends
  | One<any, any, any, TableAnyColumn>
  // biome-ignore lint/suspicious/noExplicitAny: uses any for extends
  | Fk<any, any, any, TableAnyColumn>;

export class Relations<
  TTSchema extends string,
  TTName extends string,
  TTColumns extends Record<string, AnyColumn>,
  TRelations extends Record<string, AnyRelation>,
> {
  static readonly [entityType] = "Relation";
  readonly table: TableWithColumns<TTSchema, TTName, TTColumns>;
  readonly map: TRelations;

  constructor(
    table: TableWithColumns<TTSchema, TTName, TTColumns>,
    relations: TRelations,
  ) {
    this.table = table;
    this.map = relations;
  }
}

export type StdRelations = Relations<
  string,
  string,
  Record<string, AnyColumn>,
  Record<
    string,
    | Many<string, string, Record<string, AnyColumn>, StdTableColumn>
    | One<string, string, Record<string, AnyColumn>, StdTableColumn>
    | Fk<string, string, Record<string, AnyColumn>, StdTableColumn>
  >
>;

export type AnyRelations = Relations<
  any,
  any,
  Record<any, any>,
  Record<any, any>
>;

export function relations<
  TTSchema extends string,
  TTName extends string,
  TColumns extends Record<string, AnyColumn>,
  TRelations extends Record<string, AnyRelation>,
>(
  table: TableWithColumns<TTSchema, TTName, TColumns>,
  relations: () => TRelations,
) {
  return () => new Relations(table, relations());
}
