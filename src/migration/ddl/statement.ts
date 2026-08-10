import type { Snapshot } from "../snapshot";

/**
 * All possible DDL statement types supported by the migration system.
 *
 * Each type corresponds to a concrete {@link DDLStatement} subclass.
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
  | "createSequence"
  | "dropSequence"
  | "createIndex"
  | "dropIndex"
  | "createExtension"
  | "dropExtension"
  | "custom";

/**
 * Abstract base class for all DDL (Data Definition Language) statements.
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
   */
  abstract applyToSnapshot(snapshot: Snapshot): void;
}

/**
 * A wrapper for user-defined custom SQL statements.
 */
export class CustomStatement extends DDLStatement {
  readonly type = "custom" as const;

  constructor(private readonly sql: string) {
    super();
  }

  toSQL(): string {
    return this.sql;
  }

  /**
   * Custom statements cannot be parsed, so this is a no-op.
   */
  applyToSnapshot(_snapshot: Snapshot): void {
    // No-op: custom SQL cannot be automatically applied to snapshot
  }
}

/**
 * Create a custom SQL statement.
 */
export function custom(sql: string): CustomStatement {
  return new CustomStatement(sql);
}
