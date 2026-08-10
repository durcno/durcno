import type { Snapshot } from "../snapshot";
import { DDLStatement } from "./statement";

/**
 * Create a new extension.
 *
 * @param name - The extension name.
 * @returns A {@link CreateExtensionStatement}.
 */
export function createExtension(name: string): CreateExtensionStatement {
  return new CreateExtensionStatement(name);
}

/**
 * Create a new extension if it does not already exist.
 *
 * @param name - The extension name.
 * @returns A {@link CreateExtensionStatement}.
 */
export function createExtensionIfNotExists(
  name: string,
): CreateExtensionStatement {
  return new CreateExtensionStatement(name).ifNotExists();
}

/**
 * Drop an extension.
 *
 * @param name - The extension name.
 * @returns A {@link DropExtensionStatement}.
 */
export function dropExtension(name: string): DropExtensionStatement {
  return new DropExtensionStatement(name);
}

/**
 * Drop an extension if it exists.
 *
 * @param name - The extension name.
 * @returns A {@link DropExtensionStatement}.
 */
export function dropExtensionIfExists(name: string): DropExtensionStatement {
  return new DropExtensionStatement(name).ifExists();
}

/**
 * DDL statement that creates a new PostgreSQL extension.
 *
 * Generates: `CREATE EXTENSION [IF NOT EXISTS] <name> [WITH] [SCHEMA <schema>] [VERSION <version>] [CASCADE];`
 *
 * @remarks
 * Extensions are not tracked in the migration snapshot.
 *
 * @example
 * ```typescript
 * ddl.createExtensionIfNotExists('vector').withSchema('public');
 * // CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";
 * ```
 */
export class CreateExtensionStatement extends DDLStatement {
  readonly type = "createExtension" as const;

  private _ifNotExists = false;
  private _schema?: string;
  private _version?: string;
  private _cascade = false;

  /**
   * @param name - The name of the extension to create.
   */
  constructor(private readonly name: string) {
    super();
  }

  /**
   * Adds the `IF NOT EXISTS` clause.
   */
  ifNotExists(): this {
    this._ifNotExists = true;
    return this;
  }

  /**
   * Adds the `SCHEMA` clause.
   */
  withSchema(schema: string): this {
    this._schema = schema;
    return this;
  }

  /**
   * Adds the `VERSION` clause.
   */
  version(version: string): this {
    this._version = version;
    return this;
  }

  /**
   * Adds the `CASCADE` clause.
   */
  cascade(): this {
    this._cascade = true;
    return this;
  }

  toSQL(): string {
    let sql = `CREATE EXTENSION`;
    if (this._ifNotExists) {
      sql += " IF NOT EXISTS";
    }
    sql += ` "${this.name}"`;

    const withClauses: string[] = [];
    if (this._schema) {
      withClauses.push(`SCHEMA "${this._schema}"`);
    }
    if (this._version) {
      withClauses.push(`VERSION '${this._version}'`);
    }
    if (this._cascade) {
      withClauses.push("CASCADE");
    }

    if (withClauses.length > 0) {
      sql += ` WITH ${withClauses.join(" ")}`;
    }

    return `${sql};`;
  }

  /** Extensions are not tracked in snapshot, so this is a no-op. */
  applyToSnapshot(_snapshot: Snapshot): void {
    // No-op: extensions are not tracked in snapshot
  }
}

/**
 * DDL statement that drops an existing PostgreSQL extension.
 *
 * Generates: `DROP EXTENSION [IF EXISTS] <name> [CASCADE | RESTRICT];`
 *
 * @remarks
 * Extensions are not tracked in the migration snapshot.
 *
 * @example
 * ```typescript
 * ddl.dropExtensionIfExists('vector').cascade();
 * // DROP EXTENSION IF EXISTS "vector" CASCADE;
 * ```
 */
export class DropExtensionStatement extends DDLStatement {
  readonly type = "dropExtension" as const;

  private _ifExists = false;
  private _cascade = false;
  private _restrict = false;

  /**
   * @param name - The name of the extension to drop.
   */
  constructor(private readonly name: string) {
    super();
  }

  /**
   * Adds the `IF EXISTS` clause.
   */
  ifExists(): this {
    this._ifExists = true;
    return this;
  }

  /**
   * Adds the `CASCADE` clause.
   */
  cascade(): this {
    this._cascade = true;
    this._restrict = false;
    return this;
  }

  /**
   * Adds the `RESTRICT` clause.
   */
  restrict(): this {
    this._restrict = true;
    this._cascade = false;
    return this;
  }

  toSQL(): string {
    let sql = `DROP EXTENSION`;
    if (this._ifExists) {
      sql += " IF EXISTS";
    }
    sql += ` "${this.name}"`;

    if (this._cascade) {
      sql += " CASCADE";
    } else if (this._restrict) {
      sql += " RESTRICT";
    }

    return `${sql};`;
  }

  /** Extensions are not tracked in snapshot, so this is a no-op. */
  applyToSnapshot(_snapshot: Snapshot): void {
    // No-op: extensions are not tracked in snapshot
  }
}
