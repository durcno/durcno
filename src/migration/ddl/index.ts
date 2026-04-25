export * from "./enum";
export * from "./indexes";
export * from "./schema";
export * from "./sequence";
export * from "./statement";
export * from "./table";
export * from "./types";

import {
  AlterEnumAddValueStatement,
  CreateEnumStatement,
  DropEnumStatement,
} from "./enum";
import { CreateIndexBuilder, DropIndexStatement } from "./indexes";
import { CreateSchemaStatement, DropSchemaStatement } from "./schema";
import {
  CreateSequenceStatement,
  DropSequenceStatement,
  type SequenceOptions,
} from "./sequence";
import { CustomStatement } from "./statement";
import {
  AlterTableBuilder,
  CreateTableBuilder,
  DropTableStatement,
  RenameTableStatement,
} from "./table";
import {
  AlterTypeBuilder,
  CreateTypeStatement,
  DropTypeStatement,
} from "./types";

/**
 * The main DDL builder entry point.
 *
 * Provides factory methods for all supported DDL operations.
 * Import from `durcno/migration` and use in migration files.
 *
 * @example
 * ```typescript
 * import { ddl, type DDLStatement } from 'durcno/migration';
 *
 * export const statements: DDLStatement[] = [
 *   ddl.createEnum('public', 'user_type', ['admin', 'user']),
 *   ddl.createTable('public', 'users')
 *     .column('id', 'serial', { primaryKey: true })
 *     .column('name', 'varchar(255)', { notNull: true }),
 * ];
 * ```
 */
export const ddl = {
  /**
   * Create a new schema.
   *
   * @param name - The schema name.
   * @returns A {@link CreateSchemaStatement}.
   */
  createSchema(name: string): CreateSchemaStatement {
    return new CreateSchemaStatement(name);
  },

  /**
   * Drop a schema.
   *
   * @param name - The schema name.
   * @returns A {@link DropSchemaStatement}.
   */
  dropSchema(name: string): DropSchemaStatement {
    return new DropSchemaStatement(name);
  },

  /**
   * Create a new enum type.
   *
   * @deprecated Use {@link ddl.createType} instead.
   *
   * @param schema - The schema the enum belongs to.
   * @param name - The enum type name.
   * @param values - Ordered list of allowed values.
   * @returns A {@link CreateEnumStatement}.
   */
  createEnum(
    schema: string,
    name: string,
    values: string[],
  ): CreateEnumStatement {
    return new CreateEnumStatement(schema, name, values);
  },

  /**
   * Create a new PostgreSQL type.
   *
   * Currently supports enum types only.
   *
   * @param schema - The schema the type belongs to.
   * @param name - The type name.
   * @param definition - The type definition. Currently only `{ asEnum: string[] }` is supported.
   * @returns A {@link CreateTypeStatement}.
   *
   * @example
   * ```typescript
   * ddl.createType('public', 'user_type', { asEnum: ['admin', 'user'] });
   * ```
   */
  createType(
    schema: string,
    name: string,
    definition: { asEnum: string[] },
  ): CreateTypeStatement {
    return new CreateTypeStatement(schema, name, definition);
  },

  /**
   * Add a value to an existing enum.
   *
   * @remarks
   * PostgreSQL does not support removing enum values.
   *
   * @deprecated Use {@link ddl.alterType} instead.
   *
   * @param schema - The schema the enum belongs to.
   * @param name - The enum type name.
   * @param value - The new value to add.
   * @param position - Optional positioning: `{ after: 'val' }` or `{ before: 'val' }`.
   * @returns An {@link AlterEnumAddValueStatement}.
   */
  alterEnumAddValue(
    schema: string,
    name: string,
    value: string,
    position?: { after?: string; before?: string },
  ): AlterEnumAddValueStatement {
    return new AlterEnumAddValueStatement(schema, name, value, position);
  },

  /**
   * Drop an enum type.
   *
   * @deprecated Use {@link ddl.dropType} instead.
   *
   * @param schema - The schema the enum belongs to.
   * @param name - The enum type name.
   * @returns A {@link DropEnumStatement}.
   */
  dropEnum(schema: string, name: string): DropEnumStatement {
    return new DropEnumStatement(schema, name);
  },

  /**
   * Drop an existing PostgreSQL type.
   *
   * @param schema - The schema the type belongs to.
   * @param name - The type name.
   * @returns A {@link DropTypeStatement}.
   *
   * @example
   * ```typescript
   * ddl.dropType('public', 'user_type');
   * ```
   */
  dropType(schema: string, name: string): DropTypeStatement {
    return new DropTypeStatement(schema, name);
  },

  /**
   * Alter an existing type. Returns a chainable {@link AlterTypeBuilder}.
   *
   * Currently supports enum value operations only.
   *
   * @param schema - The schema the type belongs to.
   * @param name - The type name.
   * @returns An {@link AlterTypeBuilder} for chaining `.addValue()`.
   *
   * @example
   * ```typescript
   * ddl.alterType('public', 'user_type')
   *   .addValue('moderator', { after: 'admin' })
   *   .addValue('guest');
   * ```
   */
  alterType(schema: string, name: string): AlterTypeBuilder {
    return new AlterTypeBuilder(schema, name);
  },

  /**
   * Create a new sequence.
   *
   * @param schema - The schema the sequence belongs to.
   * @param name - The sequence name.
   * @param options - Optional sequence configuration.
   * @returns A {@link CreateSequenceStatement}.
   */
  createSequence(
    schema: string,
    name: string,
    options?: SequenceOptions,
  ): CreateSequenceStatement {
    return new CreateSequenceStatement(schema, name, options);
  },

  /**
   * Drop a sequence.
   *
   * @param schema - The schema the sequence belongs to.
   * @param name - The sequence name.
   * @returns A {@link DropSequenceStatement}.
   */
  dropSequence(schema: string, name: string): DropSequenceStatement {
    return new DropSequenceStatement(schema, name);
  },

  /**
   * Create a new table. Returns a chainable {@link CreateTableBuilder}.
   *
   * @param schema - The schema to create the table in.
   * @param name - The table name.
   * @returns A {@link CreateTableBuilder} for chaining `.column()`, `.check()`, etc.
   */
  createTable(schema: string, name: string): CreateTableBuilder {
    return new CreateTableBuilder(schema, name);
  },

  /**
   * Drop a table.
   *
   * @param schema - The schema of the table.
   * @param name - The table name.
   * @returns A {@link DropTableStatement}.
   */
  dropTable(schema: string, name: string): DropTableStatement {
    return new DropTableStatement(schema, name);
  },

  /**
   * Rename a table.
   *
   * @param schema - The schema of the table.
   * @param oldName - The current table name.
   * @param newName - The new table name.
   * @returns A {@link RenameTableStatement}.
   */
  renameTable(
    schema: string,
    oldName: string,
    newName: string,
  ): RenameTableStatement {
    return new RenameTableStatement(schema, oldName, newName);
  },

  /**
   * Alter an existing table. Returns a chainable {@link AlterTableBuilder}.
   *
   * @param schema - The schema of the table.
   * @param name - The table name.
   * @returns An {@link AlterTableBuilder} for chaining `.addColumn()`, `.dropColumn()`, etc.
   */
  alterTable(schema: string, name: string): AlterTableBuilder {
    return new AlterTableBuilder(schema, name);
  },

  /**
   * Create an index. Returns a chainable {@link CreateIndexBuilder}.
   *
   * @param name - The index name.
   * @returns A {@link CreateIndexBuilder} for chaining `.on()`, `.using()`, `.unique()`.
   *
   * @example
   * ```typescript
   * ddl.createIndex('idx_users_email')
   *   .on('public', 'users', ['email'])
   *   .using('btree')
   *   .unique();
   * ```
   */
  createIndex(name: string): CreateIndexBuilder {
    return new CreateIndexBuilder(name);
  },

  /**
   * Drop an index.
   *
   * @param name - The index name.
   * @returns A {@link DropIndexStatement}.
   */
  dropIndex(name: string): DropIndexStatement {
    return new DropIndexStatement(name);
  },

  /**
   * Create a custom SQL statement. Preserved during migration regeneration.
   *
   * @param sql - The raw SQL string.
   * @returns A {@link CustomStatement}.
   */
  custom(sql: string): CustomStatement {
    return new CustomStatement(sql);
  },
};
