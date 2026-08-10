export {
  CustomStatement,
  custom,
  DDLStatement,
  type DDLStatementType,
} from "./statement";

import { custom } from "./statement";

export * from "./extension";
export * from "./indexes";
export * from "./schema";
export * from "./sequence";
export * from "./table";
export * from "./types";

import {
  createExtension,
  createExtensionIfNotExists,
  dropExtension,
  dropExtensionIfExists,
} from "./extension";
import { createIndex, dropIndex } from "./indexes";
import {
  createSchema,
  createSchemaIfNotExists,
  dropSchema,
  dropSchemaIfExists,
} from "./schema";
import { createSequence, dropSequence } from "./sequence";
import { alterTable, createTable, dropTable, renameTable } from "./table";
import { alterType, createType, dropType } from "./types";

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
 *   ddl.createType('public', 'user_type', { asEnum: ['admin', 'user'] }),
 *   ddl.createTable('public', 'users')
 *     .column('id', 'serial', { primaryKey: true })
 *     .column('name', 'varchar(255)', { notNull: true }),
 * ];
 * ```
 */
export const ddl = {
  createSchema,
  createSchemaIfNotExists,
  dropSchema,
  dropSchemaIfExists,
  createType,
  dropType,
  alterType,
  createSequence,
  dropSequence,
  createTable,
  dropTable,
  renameTable,
  alterTable,
  createIndex,
  dropIndex,
  createExtension,
  createExtensionIfNotExists,
  dropExtension,
  dropExtensionIfExists,
  custom,
};
