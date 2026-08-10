import type { Snapshot } from "../snapshot";
import { DDLStatement } from "./statement";

/**
 * Create a new schema.
 *
 * @param name - The schema name.
 * @returns A {@link CreateSchemaStatement}.
 */
export function createSchema(name: string): CreateSchemaStatement {
  return new CreateSchemaStatement(name);
}

/**
 * Create a new schema if it does not already exist.
 *
 * @param name - The schema name.
 * @returns A {@link CreateSchemaStatement}.
 */
export function createSchemaIfNotExists(name: string): CreateSchemaStatement {
  return new CreateSchemaStatement(name).ifNotExists();
}

/**
 * DDL statement that creates a new PostgreSQL schema.
 *
 * Generates: `CREATE SCHEMA [IF NOT EXISTS] <name>;`
 *
 * @remarks
 * Schemas are not tracked in the migration snapshot.
 *
 * @example
 * ```typescript
 * ddl.createSchemaIfNotExists('analytics');
 * // CREATE SCHEMA IF NOT EXISTS analytics;
 * ```
 */
export class CreateSchemaStatement extends DDLStatement {
  readonly type = "createSchema" as const;

  private _ifNotExists = false;

  /**
   * @param schema - The name of the schema to create.
   */
  constructor(private readonly schema: string) {
    super();
  }

  /**
   * Adds the `IF NOT EXISTS` clause.
   */
  ifNotExists(): this {
    this._ifNotExists = true;
    return this;
  }

  toSQL(): string {
    if (this._ifNotExists) {
      return `CREATE SCHEMA IF NOT EXISTS ${this.schema};`;
    }
    return `CREATE SCHEMA ${this.schema};`;
  }

  /** Schemas are not tracked in snapshot, so this is a no-op. */
  applyToSnapshot(_snapshot: Snapshot): void {
    // No-op: schemas are not tracked in snapshot
  }
}

/**
 * Drop a schema.
 *
 * @param name - The schema name.
 * @returns A {@link DropSchemaStatement}.
 */
export function dropSchema(name: string): DropSchemaStatement {
  return new DropSchemaStatement(name);
}

/**
 * Drop a schema if it exists.
 *
 * @param name - The schema name.
 * @returns A {@link DropSchemaStatement}.
 */
export function dropSchemaIfExists(name: string): DropSchemaStatement {
  return new DropSchemaStatement(name).ifExists();
}

/**
 * DDL statement that drops an existing PostgreSQL schema.
 *
 * Generates: `DROP SCHEMA [IF EXISTS] <name>;`
 *
 * @remarks
 * Schemas are not tracked in the migration snapshot.
 *
 * @example
 * ```typescript
 * ddl.dropSchemaIfExists('analytics');
 * // DROP SCHEMA IF EXISTS analytics;
 * ```
 */
export class DropSchemaStatement extends DDLStatement {
  readonly type = "dropSchema" as const;

  private _ifExists = false;

  /**
   * @param schema - The name of the schema to drop.
   */
  constructor(private readonly schema: string) {
    super();
  }

  /**
   * Adds the `IF EXISTS` clause.
   */
  ifExists(): this {
    this._ifExists = true;
    return this;
  }

  toSQL(): string {
    if (this._ifExists) {
      return `DROP SCHEMA IF EXISTS ${this.schema};`;
    }
    return `DROP SCHEMA ${this.schema};`;
  }

  /** Schemas are not tracked in snapshot, so this is a no-op. */
  applyToSnapshot(_snapshot: Snapshot): void {
    // No-op: schemas are not tracked in snapshot
  }
}
