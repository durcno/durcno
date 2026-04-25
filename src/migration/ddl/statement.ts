import type { Snapshot } from "../snapshot";

/**
 * All possible DDL statement types supported by the migration system.
 *
 * Each type corresponds to a concrete {@link DDLStatement} subclass:
 *
 * - `"createSchema"` — {@link CreateSchemaStatement}
 * - `"dropSchema"` — {@link DropSchemaStatement}
 * - `"createTable"` — {@link CreateTableBuilder}
 * - `"dropTable"` — {@link DropTableStatement}
 * - `"renameTable"` — {@link RenameTableStatement}
 * - `"alterTable"` — {@link AlterTableBuilder}
 * - `"createType"` — {@link CreateTypeStatement}
 * - `"dropType"` — {@link DropTypeStatement}
 * - `"alterType"` — {@link AlterTypeBuilder}
 * - `"createEnum"` — {@link CreateEnumStatement} (deprecated, use `"createType"`)
 * - `"alterEnum"` — {@link AlterEnumAddValueStatement} (deprecated, use `"alterType"`)
 * - `"dropEnum"` — {@link DropEnumStatement} (deprecated, use `"dropType"`)
 * - `"createSequence"` — {@link CreateSequenceStatement}
 * - `"dropSequence"` — {@link DropSequenceStatement}
 * - `"createIndex"` — {@link CreateIndexBuilder}
 * - `"dropIndex"` — {@link DropIndexStatement}
 * - `"custom"` — {@link CustomStatement}
 */
export type DDLStatementType =
  | "createSchema"
  | "dropSchema"
  | "createTable"
  | "dropTable"
  | "renameTable"
  | "alterTable"
  | "createType"
  | "dropType"
  | "alterType"
  | "createEnum"
  | "alterEnum"
  | "dropEnum"
  | "createSequence"
  | "dropSequence"
  | "createIndex"
  | "dropIndex"
  | "custom";

/**
 * Abstract base class for all DDL (Data Definition Language) statements.
 *
 * Every migration statement extends this class and must implement:
 * - {@link DDLStatement["type"] | type} — a discriminant for the statement kind
 * - {@link DDLStatement["toSQL"] | toSQL()} — generates the raw SQL string
 * - {@link DDLStatement["applyToSnapshot"] | applyToSnapshot()} — mutates a {@link Snapshot} in place
 *
 * @example
 * ```typescript
 * import { ddl, type DDLStatement } from 'durcno/migration';
 *
 * const statements: DDLStatement[] = [
 *   ddl.createTable('public', 'users')
 *     .column('id', 'serial', { primaryKey: true })
 *     .column('name', 'varchar(255)', { notNull: true }),
 * ];
 * ```
 */
export abstract class DDLStatement {
  /** Discriminant identifying the kind of DDL operation. */
  abstract readonly type: DDLStatementType;

  /** Whether this is a custom (user-defined) statement. */
  get isCustom(): boolean {
    return this.type === "custom";
  }

  /** Generate the SQL DDL string for this statement. */
  abstract toSQL(): string;

  /**
   * Apply this DDL statement's changes to a snapshot object.
   * Mutates the snapshot in place.
   *
   * @param snapshot - The database snapshot to mutate.
   */
  abstract applyToSnapshot(snapshot: Snapshot): void;
}

/**
 * A wrapper for user-defined custom SQL statements.
 *
 * Custom statements are preserved during migration regeneration and
 * cannot be automatically reflected in the schema snapshot.
 *
 * @example
 * ```typescript
 * import { ddl } from 'durcno/migration';
 *
 * const seedData = ddl.custom("INSERT INTO users (name) VALUES ('admin')");
 * console.log(seedData.toSQL());
 * // INSERT INTO users (name) VALUES ('admin')
 * ```
 */
export class CustomStatement extends DDLStatement {
  readonly type = "custom" as const;

  /**
   * @param sql - The raw SQL string to execute.
   */
  constructor(private readonly sql: string) {
    super();
  }

  toSQL(): string {
    return this.sql;
  }

  /**
   * Custom statements cannot be parsed, so this is a no-op.
   * Users are responsible for ensuring custom SQL is reflected in the schema.
   */
  applyToSnapshot(_snapshot: Snapshot): void {
    // No-op: custom SQL cannot be automatically applied to snapshot
  }
}
