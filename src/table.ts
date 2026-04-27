import type { Column } from "./columns/common";
import type { Check, CheckBuilder, CheckExpr } from "./constraints/check";
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
import type { CamelToSnake, Key } from "./types";

// biome-ignore lint/suspicious/noExplicitAny: AnyColumn is a wildcard type for any column
export type AnyColumn = Column<any, any>;

type InferTColArgs<TColumns extends Record<string, unknown>> = {
  [ColName in keyof TColumns]: TColumns[ColName] extends TableColumn<
    infer TTSchema,
    infer TTName,
    infer TCName,
    infer TColumn
  >
    ? [TTSchema, TTName, TCName, TColumn]
    : never;
};

export type TColsToLeftRight<TColumns extends Record<string, AnyTableColumn>> =
  {
    [ColName in keyof TColumns]: TColumns[ColName] extends TableColumn<
      infer UTSchema,
      infer UTName,
      infer UCName,
      infer UColumn
    >
      ? {
          left: [UTSchema, UTName, UCName, UColumn];
          right: InferTColArgs<Omit<TColumns, UCName>>;
        }
      : never;
  };

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
    check: (name: string, expr: CheckExpr) => Check,
    c: CheckBuilder,
  ) => Check[];
};

type TableConfig<
  TSchema extends string,
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> = {
  readonly name: TName;
  readonly schema: TSchema;
  readonly fullName: `"${TSchema}"."${TName}"`;
  readonly cols: TColumns;
  readonly columns: {
    [ColName in keyof TColumns]: TableColumn<
      TSchema,
      TName,
      ColName,
      TColumns[ColName]
    >;
  };
  readonly extra: TableExtra<TSchema, TName, TColumns>;
};

export type TableColumn<
  TTSchema extends string,
  TTName extends string,
  TName extends Key,
  TColumn extends AnyColumn,
> = TColumn & {
  table: StdTable;
  name: TName;
  nameSnake: CamelToSnake<Extract<TName, string>>;
  tableName: TTName;
  schemaName: TTSchema;
};

export type StdTableColumn = TableColumn<string, string, Key, AnyColumn>;

// biome-ignore lint/suspicious/noExplicitAny: <>
export type AnyTableColumn = TableColumn<any, any, any, any>;

export type TableColumnArgs = [string, string, Key, AnyColumn];

function bindNameNTable(table: StdTable, columns: Record<string, AnyColumn>) {
  for (const [ColName, col] of Object.entries(columns)) {
    col._.setName(ColName);
    col._.setTable(table);
  }
  return columns;
}

export type BuildScmTblColumns<
  TSchema extends string,
  TName extends string,
  TColumns extends Record<string, AnyColumn>,
> = {
  [ColName in keyof TColumns &
    string as `${TSchema}_${TName}_${ColName}`]: TableColumn<
    TSchema,
    TName,
    ColName,
    TColumns[ColName]
  >;
};

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
    _: {
      scmTblColumns: BuildScmTblColumns<TSchema, TName, TColumns>;
    };
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
      name,
      fullName: `"${schema}"."${name}"`,
      cols: columns,
      columns: columns as {
        [ColName in keyof TColumns]: TableColumn<
          TSchema,
          TName,
          ColName,
          TColumns[ColName]
        >;
      },
      extra,
    };
  }
}

export type StdTable = Table<string, string, Record<string, AnyColumn>>;

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
  TCol extends TableColumn<any, any, any, AnyColumn>,
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
  TCol extends TableColumn<any, any, any, AnyColumn>,
>(col: TCol, table: TableWithColumns<TTSchema, TTName, TTColumns>) {
  return new Fk(col, table);
}

export type AnyRelation =
  // biome-ignore lint/suspicious/noExplicitAny: uses any for extends
  | Many<any, any, any, any>
  // biome-ignore lint/suspicious/noExplicitAny: uses any for extends
  | One<any, any, any, any>
  // biome-ignore lint/suspicious/noExplicitAny: uses any for extends
  | Fk<any, any, any, any>;

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
