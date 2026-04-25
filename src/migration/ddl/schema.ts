import type { Snapshot } from "../snapshot";
import { DDLStatement } from "./statement";

/**
 * DDL statement that creates a new PostgreSQL schema.
 *
 * Generates: `CREATE SCHEMA <name>;`
 *
 * @remarks
 * Schemas are not tracked in the migration snapshot.
 *
 * @example
 * ```typescript
 * ddl.createSchema('analytics');
 * // CREATE SCHEMA analytics;
 * ```
 */
export class CreateSchemaStatement extends DDLStatement {
  readonly type = "createSchema" as const;

  /**
   * @param schema - The name of the schema to create.
   */
  constructor(private readonly schema: string) {
    super();
  }

  toSQL(): string {
    return `CREATE SCHEMA ${this.schema};`;
  }

  /** Schemas are not tracked in snapshot, so this is a no-op. */
  applyToSnapshot(_snapshot: Snapshot): void {
    // No-op: schemas are not tracked in snapshot
  }
}

/**
 * DDL statement that drops an existing PostgreSQL schema.
 *
 * Generates: `DROP SCHEMA <name>;`
 *
 * @remarks
 * Schemas are not tracked in the migration snapshot.
 *
 * @example
 * ```typescript
 * ddl.dropSchema('analytics');
 * // DROP SCHEMA analytics;
 * ```
 */
export class DropSchemaStatement extends DDLStatement {
  readonly type = "dropSchema" as const;

  /**
   * @param schema - The name of the schema to drop.
   */
  constructor(private readonly schema: string) {
    super();
  }

  toSQL(): string {
    return `DROP SCHEMA ${this.schema};`;
  }

  /** Schemas are not tracked in snapshot, so this is a no-op. */
  applyToSnapshot(_snapshot: Snapshot): void {
    // No-op: schemas are not tracked in snapshot
  }
}
