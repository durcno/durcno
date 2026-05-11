/**
 * Migration API
 *
 * Type-safe DDL statement builders for PostgreSQL migrations.
 * Use the {@link ddl} object as the main entry point to create schema,
 * enum, table, sequence, and index statements.
 *
 * @module durcno/migration
 *
 * @example
 * ```typescript
 * import {
 *   ddl,
 *   type DDLStatement,
 *   type MigrationOptions,
 * } from 'durcno/migration';
 *
 * export const options: MigrationOptions = {
 *   transaction: true,
 * };
 *
 * export const statements: DDLStatement[] = [
 *   ddl.createEnum('public', 'user_type', ['admin', 'user']),
 *   ddl.createTable('public', 'users')
 *     .column('id', 'serial', { primaryKey: true })
 *     .column('name', 'varchar(255)', { notNull: true }),
 *   ddl.custom('INSERT INTO users (name) VALUES (\'admin\')'),
 * ];
 * ```
 */

export { sql } from "../sql";
export { MIGRATION_NAME_REGEX } from "./consts";
export {
  CustomStatement,
  DDLStatement,
  ddl,
} from "./ddl";
export {
  createEmptySnapshot,
  type Snapshot,
  type SnapshotColumn,
  type SnapshotColumnRef,
  type SnapshotEnum,
  type SnapshotSequence,
  type SnapshotTable,
  type SnapshotTableCheck,
  type SnapshotTableIndex,
  type SnapshotTablePrimaryKey,
  type SnapshotTableUnique,
  snapshot,
} from "./snapshot";

/**
 * Migration options that can be exported from up.ts/down.ts
 */
export interface MigrationOptions {
  /** Whether to wrap statements in BEGIN...COMMIT (default: true) */
  transaction?: boolean;
  /** How to execute statements: 'joined' runs all as a single query, 'sequential' runs one at a time (default: 'joined') */
  execution?: "joined" | "sequential";
}
