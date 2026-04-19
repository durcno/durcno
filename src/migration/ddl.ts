import type { OnDeleteAction } from "../columns/common";
import {
  type SnapshotCheckExpr,
  snapshotExprToSQL,
} from "../constraints/check";
import type { IndexType } from "../indexes";
import type {
  Snapshot,
  SnapshotColumn,
  SnapshotTablePrimaryKey,
  SnapshotTableUnique,
} from "./snapshot";
import { CustomStatement, DDLStatement } from "./statement";

/**
 * Builds a quoted relation name from schema and name.
 * Examples:
 * - schema="public", name="users" -> "public"."users"
 */
function buildRelation(schema: string, name: string): string {
  return `"${schema}"."${name}"`;
}

// ============================================================================
// CREATE SCHEMA
// ============================================================================

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

// ============================================================================
// DROP SCHEMA
// ============================================================================

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

// ============================================================================
// CREATE ENUM
// ============================================================================

/**
 * DDL statement that creates a new PostgreSQL enum type.
 *
 * Generates: `CREATE TYPE "schema"."name" AS ENUM('val1', 'val2', ...);`
 *
 * @example
 * ```typescript
 * ddl.createEnum('public', 'user_type', ['admin', 'user', 'guest']);
 * // CREATE TYPE "public"."user_type" AS ENUM('admin', 'user', 'guest');
 * ```
 */
export class CreateEnumStatement extends DDLStatement {
  readonly type = "createEnum" as const;

  /**
   * @param schema - The schema the enum belongs to.
   * @param name - The name of the enum type to create.
   * @param values - Ordered list of allowed enum values.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
    private readonly values: string[],
  ) {
    super();
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.name);
    const valuesStr = this.values.map((v) => `'${v}'`).join(", ");
    return `CREATE TYPE ${relation} AS ENUM(${valuesStr});`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    snapshot.enums[key] = {
      schema: this.schema,
      name: this.name,
      values: [...this.values],
    };
  }
}

// ============================================================================
// ALTER ENUM (ADD VALUE)
// ============================================================================

/**
 * DDL statement that adds a value to an existing PostgreSQL enum type.
 *
 * Generates: `ALTER TYPE "schema"."name" ADD VALUE IF NOT EXISTS 'value' [AFTER|BEFORE 'ref'];`
 *
 * @remarks
 * PostgreSQL does not support removing values from an enum.
 * Values can only be added, optionally positioned relative to an existing value.
 *
 * @example
 * ```typescript
 * // Append a value
 * ddl.alterEnumAddValue('public', 'user_type', 'moderator');
 *
 * // Insert after a specific value
 * ddl.alterEnumAddValue('public', 'user_type', 'moderator', { after: 'admin' });
 *
 * // Insert before a specific value
 * ddl.alterEnumAddValue('public', 'user_type', 'moderator', { before: 'user' });
 * ```
 */
export class AlterEnumAddValueStatement extends DDLStatement {
  readonly type = "alterEnum" as const;

  /**
   * @param schema - The schema the enum belongs to.
   * @param name - The enum type name.
   * @param value - The new value to add.
   * @param position - Optional positioning: `{ after: 'val' }` or `{ before: 'val' }`.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
    private readonly value: string,
    private readonly position?: { after?: string; before?: string },
  ) {
    super();
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.name);
    let sql = `ALTER TYPE ${relation} ADD VALUE IF NOT EXISTS '${this.value}'`;
    if (this.position?.after) {
      sql += ` AFTER '${this.position.after}'`;
    } else if (this.position?.before) {
      sql += ` BEFORE '${this.position.before}'`;
    }
    return `${sql};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    const enm = snapshot.enums[key];
    if (!enm) return;

    // Find insertion position
    if (this.position?.after) {
      const afterIdx = enm.values.indexOf(this.position.after);
      if (afterIdx !== -1) {
        enm.values.splice(afterIdx + 1, 0, this.value);
        return;
      }
    } else if (this.position?.before) {
      const beforeIdx = enm.values.indexOf(this.position.before);
      if (beforeIdx !== -1) {
        enm.values.splice(beforeIdx, 0, this.value);
        return;
      }
    }
    // Default: append to end
    enm.values.push(this.value);
  }
}

// ============================================================================
// DROP ENUM
// ============================================================================

/**
 * DDL statement that drops an existing PostgreSQL enum type.
 *
 * Generates: `DROP TYPE "schema"."name";`
 *
 * @example
 * ```typescript
 * ddl.dropEnum('public', 'user_type');
 * // DROP TYPE "public"."user_type";
 * ```
 */
export class DropEnumStatement extends DDLStatement {
  readonly type = "dropEnum" as const;

  /**
   * @param schema - The schema the enum belongs to.
   * @param name - The enum type name to drop.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
  ) {
    super();
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.name);
    return `DROP TYPE ${relation};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    delete snapshot.enums[key];
  }
}

// ============================================================================
// CREATE SEQUENCE
// ============================================================================

/**
 * Options for configuring a PostgreSQL sequence.
 *
 * @see {@link CreateSequenceStatement}
 */
export interface SequenceOptions {
  /** The `START WITH` value for the sequence. */
  startWith?: number;
  /** The `INCREMENT BY` value. */
  increment?: number;
  /** The minimum value (`MINVALUE`). */
  minValue?: number;
  /** The maximum value (`MAXVALUE`). */
  maxValue?: number;
  /** Whether the sequence wraps around when it reaches min/max (`CYCLE`). */
  cycle?: boolean;
  /** Number of sequence values to pre-allocate (`CACHE`). */
  cache?: number;
}

/**
 * DDL statement that creates a new PostgreSQL sequence.
 *
 * Generates: `CREATE SEQUENCE "schema"."name" [START WITH n] [INCREMENT BY n] ...;`
 *
 * @example
 * ```typescript
 * ddl.createSequence('public', 'order_seq', {
 *   startWith: 1000,
 *   increment: 1,
 *   cache: 10,
 * });
 * // CREATE SEQUENCE "public"."order_seq" START WITH 1000 INCREMENT BY 1 CACHE 10;
 * ```
 */
export class CreateSequenceStatement extends DDLStatement {
  readonly type = "createSequence" as const;

  /**
   * @param schema - The schema the sequence belongs to.
   * @param name - The sequence name.
   * @param options - Optional sequence configuration.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
    private readonly options: SequenceOptions = {},
  ) {
    super();
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.name);
    let sql = `CREATE SEQUENCE ${relation}`;
    if (this.options.startWith !== undefined)
      sql += ` START WITH ${this.options.startWith}`;
    if (this.options.increment !== undefined)
      sql += ` INCREMENT BY ${this.options.increment}`;
    if (this.options.minValue !== undefined)
      sql += ` MINVALUE ${this.options.minValue}`;
    if (this.options.maxValue !== undefined)
      sql += ` MAXVALUE ${this.options.maxValue}`;
    if (this.options.cycle) sql += " CYCLE";
    if (this.options.cache !== undefined) sql += ` CACHE ${this.options.cache}`;
    return `${sql};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    snapshot.sequences[key] = {
      schema: this.schema,
      name: this.name,
      startWith: this.options.startWith,
      increment: this.options.increment,
      minValue: this.options.minValue,
      maxValue: this.options.maxValue,
      cycle: this.options.cycle,
      cache: this.options.cache,
    };
  }
}

// ============================================================================
// DROP SEQUENCE
// ============================================================================

/**
 * DDL statement that drops an existing PostgreSQL sequence.
 *
 * Generates: `DROP SEQUENCE "schema"."name";`
 *
 * @example
 * ```typescript
 * ddl.dropSequence('public', 'order_seq');
 * // DROP SEQUENCE "public"."order_seq";
 * ```
 */
export class DropSequenceStatement extends DDLStatement {
  readonly type = "dropSequence" as const;

  /**
   * @param schema - The schema the sequence belongs to.
   * @param name - The sequence name to drop.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
  ) {
    super();
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.name);
    return `DROP SEQUENCE ${relation};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    delete snapshot.sequences[key];
  }
}

// ============================================================================
// CREATE TABLE
// ============================================================================

/**
 * Defines a foreign-key reference from a column to another table's column.
 *
 * @see {@link ColumnOptions.references}
 */
export interface ColumnReference {
  /** Schema of the referenced table. */
  schema: string;
  /** Name of the referenced table. */
  table: string;
  /** Name of the referenced column. */
  column: string;
  /** The `ON DELETE` action (`CASCADE`, `SET NULL`, `RESTRICT`, etc.). */
  onDelete: OnDeleteAction;
}

/**
 * Options that can be applied to a column when creating or altering a table.
 *
 * @see {@link CreateTableBuilder.column}
 * @see {@link AlterTableBuilder.addColumn}
 */
export interface ColumnOptions {
  /** Add a `NOT NULL` constraint. */
  notNull?: boolean;
  /** Make this column the table's primary key. */
  primaryKey?: boolean;
  /** Add a `UNIQUE` constraint. */
  unique?: boolean;
  /** A raw SQL expression for the `DEFAULT` clause. */
  default?: string;
  /** The `GENERATED` strategy (`"ALWAYS"` or `"BY DEFAULT"`). */
  generated?: string;
  /** The `AS` expression for generated columns. */
  as?: string;
  /** A foreign-key reference to another table's column. */
  references?: ColumnReference;
}

interface ColumnDef {
  name: string;
  type: string;
  options: ColumnOptions;
}

interface CheckDef {
  name: string;
  expr: SnapshotCheckExpr;
}

interface UniqueConstraintDef {
  name: string;
  columns: string[];
}

interface PrimaryKeyConstraintDef {
  name: string;
  columns: string[];
}

/**
 * Generates a SQL column definition string from column metadata.
 * Used by both CREATE TABLE and ALTER TABLE statements.
 */
function toColumnDef(
  name: string,
  type: string,
  options: ColumnOptions = {},
): string {
  let def = `"${name}" ${type}`;

  if (options.primaryKey) def += " PRIMARY KEY";
  if (options.references) {
    const refTable = `"${options.references.schema}"."${options.references.table}"`;
    def += ` REFERENCES ${refTable}(${options.references.column}) ON DELETE ${options.references.onDelete}`;
  }
  if (options.unique) def += " UNIQUE";
  if (options.notNull) def += " NOT NULL";
  if (options.default !== undefined) def += ` DEFAULT ${options.default}`;
  if (options.generated) {
    def += ` GENERATED ${options.generated} AS ${options.as}`;
  }

  return def;
}

/**
 * Chainable builder that constructs a `CREATE TABLE` DDL statement.
 *
 * Use {@link ddl.createTable} to obtain an instance, then chain
 * `.column()`, `.check()`, `.uniqueConstraint()`, and `.primaryKeyConstraint()`.
 *
 * @example
 * ```typescript
 * ddl.createTable('public', 'users')
 *   .column('id', 'serial', { primaryKey: true })
 *   .column('name', 'varchar(255)', { notNull: true })
 *   .column('email', 'varchar(255)', { notNull: true, unique: true })
 *   .check('name_length', { column: 'name', op: '>', value: 0 })
 *   .uniqueConstraint('users_name_email_unique', ['name', 'email']);
 * ```
 */
export class CreateTableBuilder extends DDLStatement {
  readonly type = "createTable" as const;
  private columns: ColumnDef[] = [];
  private checks: CheckDef[] = [];
  private _uniqueConstraints: UniqueConstraintDef[] = [];
  private _primaryKeyConstraint?: PrimaryKeyConstraintDef;

  /**
   * @param schema - The PostgreSQL schema to create the table in.
   * @param name - The table name.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
  ) {
    super();
  }

  /**
   * Add a column to the table.
   *
   * @param colName - Column name.
   * @param type - SQL type (e.g. `"varchar(255)"`, `"integer"`, `"serial"`).
   * @param options - Column options (constraints, default, references, etc.).
   * @returns `this` for chaining.
   */
  column(colName: string, type: string, options: ColumnOptions = {}): this {
    this.columns.push({ name: colName, type, options });
    return this;
  }

  /**
   * Add a CHECK constraint to the table.
   *
   * @param chkName - Constraint name.
   * @param expr - The check expression.
   * @returns `this` for chaining.
   */
  check(chkName: string, expr: SnapshotCheckExpr): this {
    this.checks.push({ name: chkName, expr });
    return this;
  }

  /**
   * Add a table-level UNIQUE constraint spanning one or more columns.
   *
   * @param ucName - Constraint name.
   * @param columns - Column names that form the unique key.
   * @returns `this` for chaining.
   */
  uniqueConstraint(ucName: string, columns: string[]): this {
    this._uniqueConstraints.push({ name: ucName, columns });
    return this;
  }

  /**
   * Add a composite PRIMARY KEY constraint.
   *
   * @param pkName - Constraint name.
   * @param columns - Column names that form the primary key.
   * @returns `this` for chaining.
   */
  primaryKeyConstraint(pkName: string, columns: string[]): this {
    this._primaryKeyConstraint = { name: pkName, columns };
    return this;
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.name);

    const entries: string[] = [];

    for (const col of this.columns) {
      entries.push(`  ${toColumnDef(col.name, col.type, col.options)}`);
    }

    for (const chk of this.checks) {
      entries.push(
        `  CONSTRAINT ${chk.name} CHECK (${snapshotExprToSQL(chk.expr)})`,
      );
    }

    for (const uc of this._uniqueConstraints) {
      const cols = uc.columns.map((c) => `"${c}"`).join(", ");
      entries.push(`  CONSTRAINT ${uc.name} UNIQUE (${cols})`);
    }

    if (this._primaryKeyConstraint) {
      const pk = this._primaryKeyConstraint;
      const cols = pk.columns.map((c) => `"${c}"`).join(", ");
      entries.push(`  CONSTRAINT ${pk.name} PRIMARY KEY (${cols})`);
    }

    return `CREATE TABLE ${relation} (\n${entries.join(",\n")}\n);`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    const columns: Record<string, SnapshotColumn> = {};

    for (const col of this.columns) {
      const colSnapshot: SnapshotColumn = {
        type: col.type,
      };
      if (col.options.notNull) colSnapshot.notNull = true;
      if (col.options.primaryKey) colSnapshot.primaryKey = true;
      if (col.options.unique) colSnapshot.unique = true;
      if (col.options.default !== undefined)
        colSnapshot.default = col.options.default;
      if (col.options.generated) colSnapshot.generated = col.options.generated;
      if (col.options.as) colSnapshot.as = col.options.as;
      if (col.options.references) {
        colSnapshot.references = {
          schema: col.options.references.schema,
          table: col.options.references.table,
          column: col.options.references.column,
          onDelete: col.options.references.onDelete,
        };
      }
      columns[col.name] = colSnapshot;
    }

    const tableKey = `${this.schema}.${this.name}`;
    const checks: Record<
      string,
      { name: string; table: string; expr: SnapshotCheckExpr }
    > = {};
    for (const chk of this.checks) {
      checks[chk.name] = {
        name: chk.name,
        table: tableKey,
        expr: chk.expr,
      };
    }

    const uniqueConstraints: Record<string, SnapshotTableUnique> = {};
    for (const uc of this._uniqueConstraints) {
      uniqueConstraints[uc.name] = {
        name: uc.name,
        table: tableKey,
        columns: [...uc.columns],
      };
    }

    let primaryKeyConstraint: SnapshotTablePrimaryKey | undefined;
    if (this._primaryKeyConstraint) {
      primaryKeyConstraint = {
        name: this._primaryKeyConstraint.name,
        table: tableKey,
        columns: [...this._primaryKeyConstraint.columns],
      };
    }

    snapshot.tables[key] = {
      schema: this.schema,
      name: this.name,
      columns,
      indexes: {},
      checkConstraints: checks,
      uniqueConstraints,
      primaryKeyConstraint,
    };
  }
}

// ============================================================================
// DROP TABLE
// ============================================================================

/**
 * DDL statement that drops an existing table.
 *
 * Generates: `DROP TABLE "schema"."name";`
 *
 * @example
 * ```typescript
 * ddl.dropTable('public', 'users');
 * // DROP TABLE "public"."users";
 * ```
 */
export class DropTableStatement extends DDLStatement {
  readonly type = "dropTable" as const;

  /**
   * @param schema - The schema of the table.
   * @param name - The table name to drop.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
  ) {
    super();
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.name);
    return `DROP TABLE ${relation};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    delete snapshot.tables[key];
  }
}

// ============================================================================
// RENAME TABLE
// ============================================================================

/**
 * DDL statement that renames an existing table.
 *
 * Generates: `ALTER TABLE "schema"."oldName" RENAME TO "newName";`
 *
 * @example
 * ```typescript
 * ddl.renameTable('public', 'users', 'accounts');
 * // ALTER TABLE "public"."users" RENAME TO "accounts";
 * ```
 */
export class RenameTableStatement extends DDLStatement {
  readonly type = "renameTable" as const;

  /**
   * @param schema - The schema of the table.
   * @param oldName - The current table name.
   * @param newName - The new table name.
   */
  constructor(
    private readonly schema: string,
    private readonly oldName: string,
    private readonly newName: string,
  ) {
    super();
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.oldName);
    return `ALTER TABLE ${relation} RENAME TO "${this.newName}";`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const oldKey = `${this.schema}.${this.oldName}`;
    const newKey = `${this.schema}.${this.newName}`;
    const table = snapshot.tables[oldKey];
    if (!table) return;
    table.name = this.newName;
    snapshot.tables[newKey] = table;
    delete snapshot.tables[oldKey];
  }
}

// ============================================================================
// ALTER TABLE
// ============================================================================

type AlterTableAction =
  | { type: "addColumn"; name: string; colType: string; options: ColumnOptions }
  | { type: "dropColumn"; name: string }
  | { type: "renameColumn"; oldName: string; newName: string }
  | { type: "alterColumnType"; name: string; newType: string }
  | { type: "addUnique"; column: string }
  | { type: "dropConstraint"; name: string }
  | { type: "setNotNull"; column: string }
  | { type: "dropNotNull"; column: string }
  | { type: "setDefault"; column: string; defaultValue: string }
  | { type: "dropDefault"; column: string }
  | { type: "addCheck"; name: string; expr: SnapshotCheckExpr }
  | { type: "addUniqueConstraint"; name: string; columns: string[] }
  | { type: "addPrimaryKeyConstraint"; name: string; columns: string[] };

/**
 * Chainable builder that constructs `ALTER TABLE` DDL statements.
 *
 * Supports adding/dropping columns, changing types, toggling constraints,
 * and managing defaults. Each chained method appends an action that produces
 * a separate `ALTER TABLE ... ;` SQL statement when {@link toSQL} is called.
 *
 * Use {@link ddl.alterTable} to obtain an instance.
 *
 * @example
 * ```typescript
 * ddl.alterTable('public', 'users')
 *   .addColumn('age', 'integer', { notNull: true, default: '0' })
 *   .dropColumn('legacy_field')
 *   .setNotNull('email')
 *   .addUniqueConstraint('users_email_unique', ['email']);
 * ```
 */
export class AlterTableBuilder extends DDLStatement {
  readonly type = "alterTable" as const;
  private actions: AlterTableAction[] = [];

  /**
   * @param schema - The schema of the table to alter.
   * @param name - The table name.
   */
  constructor(
    private readonly schema: string,
    private readonly name: string,
  ) {
    super();
  }

  /**
   * Add a new column to the table.
   *
   * @param name - Column name.
   * @param type - SQL type (e.g. `"varchar(255)"`).
   * @param options - Column constraints and options.
   * @returns `this` for chaining.
   */
  addColumn(name: string, type: string, options: ColumnOptions = {}): this {
    this.actions.push({ type: "addColumn", name, colType: type, options });
    return this;
  }

  /**
   * Drop a column from the table.
   *
   * @param name - The column name to drop.
   * @returns `this` for chaining.
   */
  dropColumn(name: string): this {
    this.actions.push({ type: "dropColumn", name });
    return this;
  }

  /**
   * Rename a column.
   *
   * @param oldName - The current column name.
   * @param newName - The new column name.
   * @returns `this` for chaining.
   */
  renameColumn(oldName: string, newName: string): this {
    this.actions.push({ type: "renameColumn", oldName, newName });
    return this;
  }

  /**
   * Change the type of an existing column.
   *
   * @param name - The column name.
   * @param newType - The new SQL type.
   * @returns `this` for chaining.
   */
  alterColumnType(name: string, newType: string): this {
    this.actions.push({ type: "alterColumnType", name, newType });
    return this;
  }

  /**
   * Add a column-level UNIQUE constraint.
   *
   * @param column - The column name.
   * @returns `this` for chaining.
   */
  addUnique(column: string): this {
    this.actions.push({ type: "addUnique", column });
    return this;
  }

  /**
   * Drop a named constraint (UNIQUE, CHECK, or PRIMARY KEY).
   *
   * @param name - The constraint name.
   * @returns `this` for chaining.
   */
  dropConstraint(name: string): this {
    this.actions.push({ type: "dropConstraint", name });
    return this;
  }

  /**
   * Set `NOT NULL` on a column.
   *
   * @param column - The column name.
   * @returns `this` for chaining.
   */
  setNotNull(column: string): this {
    this.actions.push({ type: "setNotNull", column });
    return this;
  }

  /**
   * Drop `NOT NULL` from a column, making it nullable.
   *
   * @param column - The column name.
   * @returns `this` for chaining.
   */
  dropNotNull(column: string): this {
    this.actions.push({ type: "dropNotNull", column });
    return this;
  }

  /**
   * Set or change the DEFAULT value for a column.
   *
   * @param column - The column name.
   * @param defaultValue - The new default value as a raw SQL expression.
   * @returns `this` for chaining.
   */
  setDefault(column: string, defaultValue: string): this {
    this.actions.push({ type: "setDefault", column, defaultValue });
    return this;
  }

  /**
   * Drop the DEFAULT value from a column.
   *
   * @param column - The column name.
   * @returns `this` for chaining.
   */
  dropDefault(column: string): this {
    this.actions.push({ type: "dropDefault", column });
    return this;
  }

  /**
   * Add a CHECK constraint to the table.
   *
   * @param name - Constraint name.
   * @param expr - The check expression.
   * @returns `this` for chaining.
   */
  addCheck(name: string, expr: SnapshotCheckExpr): this {
    this.actions.push({ type: "addCheck", name, expr });
    return this;
  }

  /**
   * Add a table-level UNIQUE constraint spanning one or more columns.
   *
   * @param name - Constraint name.
   * @param columns - Column names that form the unique key.
   * @returns `this` for chaining.
   */
  addUniqueConstraint(name: string, columns: string[]): this {
    this.actions.push({ type: "addUniqueConstraint", name, columns });
    return this;
  }

  /**
   * Add a composite PRIMARY KEY constraint.
   *
   * @param name - Constraint name.
   * @param columns - Column names that form the primary key.
   * @returns `this` for chaining.
   */
  addPrimaryKeyConstraint(name: string, columns: string[]): this {
    this.actions.push({ type: "addPrimaryKeyConstraint", name, columns });
    return this;
  }

  toSQL(): string {
    const relation = buildRelation(this.schema, this.name);

    const statements: string[] = [];

    for (const action of this.actions) {
      switch (action.type) {
        case "addColumn":
          statements.push(
            `ALTER TABLE ${relation} ADD COLUMN ${toColumnDef(action.name, action.colType, action.options)};`,
          );
          break;
        case "dropColumn":
          statements.push(
            `ALTER TABLE ${relation} DROP COLUMN "${action.name}";`,
          );
          break;
        case "renameColumn":
          statements.push(
            `ALTER TABLE ${relation} RENAME COLUMN "${action.oldName}" TO "${action.newName}";`,
          );
          break;
        case "alterColumnType":
          statements.push(
            `ALTER TABLE ${relation} ALTER COLUMN "${action.name}" TYPE ${action.newType};`,
          );
          break;
        case "addUnique":
          statements.push(
            `ALTER TABLE ${relation} ADD UNIQUE (${action.column});`,
          );
          break;
        case "dropConstraint":
          statements.push(
            `ALTER TABLE ${relation} DROP CONSTRAINT ${action.name};`,
          );
          break;
        case "setNotNull":
          statements.push(
            `ALTER TABLE ${relation} ALTER COLUMN "${action.column}" SET NOT NULL;`,
          );
          break;
        case "dropNotNull":
          statements.push(
            `ALTER TABLE ${relation} ALTER COLUMN "${action.column}" DROP NOT NULL;`,
          );
          break;
        case "setDefault":
          statements.push(
            `ALTER TABLE ${relation} ALTER COLUMN "${action.column}" SET DEFAULT '${action.defaultValue}';`,
          );
          break;
        case "dropDefault":
          statements.push(
            `ALTER TABLE ${relation} ALTER COLUMN "${action.column}" DROP DEFAULT;`,
          );
          break;
        case "addCheck":
          statements.push(
            `ALTER TABLE ${relation} ADD CONSTRAINT ${action.name} CHECK (${snapshotExprToSQL(action.expr)});`,
          );
          break;
        case "addUniqueConstraint": {
          const cols = action.columns.map((c) => `"${c}"`).join(", ");
          statements.push(
            `ALTER TABLE ${relation} ADD CONSTRAINT ${action.name} UNIQUE (${cols});`,
          );
          break;
        }
        case "addPrimaryKeyConstraint": {
          const cols = action.columns.map((c) => `"${c}"`).join(", ");
          statements.push(
            `ALTER TABLE ${relation} ADD CONSTRAINT ${action.name} PRIMARY KEY (${cols});`,
          );
          break;
        }
      }
    }

    return statements.join("\n");
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    const table = snapshot.tables[key];
    if (!table) return;

    for (const action of this.actions) {
      switch (action.type) {
        case "addColumn": {
          const colSnapshot: SnapshotColumn = {
            type: action.colType,
          };
          if (action.options.notNull) colSnapshot.notNull = true;
          if (action.options.primaryKey) colSnapshot.primaryKey = true;
          if (action.options.unique) colSnapshot.unique = true;
          if (action.options.default !== undefined)
            colSnapshot.default = action.options.default;
          if (action.options.generated)
            colSnapshot.generated = action.options.generated;
          if (action.options.as) colSnapshot.as = action.options.as;
          if (action.options.references) {
            colSnapshot.references = {
              schema: action.options.references.schema,
              table: action.options.references.table,
              column: action.options.references.column,
              onDelete: action.options.references.onDelete,
            };
          }
          table.columns[action.name] = colSnapshot;
          break;
        }
        case "dropColumn":
          delete table.columns[action.name];
          break;
        case "renameColumn": {
          const col = table.columns[action.oldName];
          if (col) {
            table.columns[action.newName] = col;
            delete table.columns[action.oldName];
          }
          break;
        }
        case "alterColumnType":
          if (table.columns[action.name]) {
            table.columns[action.name].type = action.newType;
          }
          break;
        case "addUnique":
          if (table.columns[action.column]) {
            table.columns[action.column].unique = true;
          }
          break;
        case "dropConstraint":
          // Could be a unique constraint, check constraint, etc.
          // For unique constraints ending with _key, remove unique from column
          if (action.name.endsWith("_key")) {
            const colName = action.name
              .replace(`${this.name}_`, "")
              .replace("_key", "");
            if (table.columns[colName]) {
              delete table.columns[colName].unique;
            }
          }
          // For check constraints
          delete table.checkConstraints[action.name];
          // For table-level unique constraints
          if (table.uniqueConstraints) {
            delete table.uniqueConstraints[action.name];
          }
          // For table-level primary key constraint
          if (
            table.primaryKeyConstraint &&
            table.primaryKeyConstraint.name === action.name
          ) {
            delete table.primaryKeyConstraint;
          }
          break;
        case "setNotNull":
          if (table.columns[action.column]) {
            table.columns[action.column].notNull = true;
          }
          break;
        case "dropNotNull":
          if (table.columns[action.column]) {
            delete table.columns[action.column].notNull;
          }
          break;
        case "setDefault":
          if (table.columns[action.column]) {
            table.columns[action.column].default = action.defaultValue;
          }
          break;
        case "dropDefault":
          if (table.columns[action.column]) {
            delete table.columns[action.column].default;
          }
          break;
        case "addCheck": {
          const tableKey = `${this.schema}.${this.name}`;
          table.checkConstraints[action.name] = {
            name: action.name,
            table: tableKey,
            expr: action.expr,
          };
          break;
        }
        case "addUniqueConstraint": {
          const tableKey = `${this.schema}.${this.name}`;
          if (!table.uniqueConstraints) table.uniqueConstraints = {};
          table.uniqueConstraints[action.name] = {
            name: action.name,
            table: tableKey,
            columns: [...action.columns],
          };
          break;
        }
        case "addPrimaryKeyConstraint": {
          const tableKey = `${this.schema}.${this.name}`;
          table.primaryKeyConstraint = {
            name: action.name,
            table: tableKey,
            columns: [...action.columns],
          };
          break;
        }
      }
    }
  }
}

// ============================================================================
// CREATE INDEX
// ============================================================================

/**
 * Chainable builder that constructs a `CREATE INDEX` DDL statement.
 *
 * Use {@link ddl.createIndex} to obtain an instance, then chain `.on()`,
 * and optionally `.using()` and `.unique()`.
 *
 * @example
 * ```typescript
 * ddl.createIndex('idx_users_email')
 *   .on('public', 'users', ['email'])
 *   .using('btree')
 *   .unique();
 * // CREATE UNIQUE INDEX idx_users_email ON "public"."users" USING btree ("email");
 * ```
 */
export class CreateIndexBuilder extends DDLStatement {
  readonly type = "createIndex" as const;
  private tableSchema = "";
  private tableName = "";
  private indexType: IndexType = "btree";
  private indexColumns: string[] = [];
  private isUnique = false;
  private isConcurrent = false;

  /**
   * @param indexName - The name of the index to create.
   */
  constructor(private readonly indexName: string) {
    super();
  }

  /**
   * Build the index concurrently, without locking writes on the table.
   *
   * Generates: `CREATE INDEX CONCURRENTLY ...`
   *
   * @remarks
   * Concurrent index creation cannot run inside a transaction.
   * Set `transaction: false` in your migration options when using this.
   *
   * @returns `this` for chaining.
   */
  concurrently(): this {
    this.isConcurrent = true;
    return this;
  }

  /**
   * Specify the table and columns this index is created on.
   *
   * @param schema - The table's schema.
   * @param table - The table name.
   * @param columns - Optional array of column names to index.
   * @returns `this` for chaining.
   */
  on(schema: string, table: string, columns?: string[]): this {
    this.tableSchema = schema;
    this.tableName = table;
    if (columns) {
      this.indexColumns = columns;
    }
    return this;
  }

  /**
   * Specify the index method.
   *
   * @param type - The index type (`"btree"`, `"hash"`, `"gin"`, `"gist"`, etc.).
   * @param columns - Optional array of column names to index.
   * @returns `this` for chaining.
   */
  using(type: IndexType, columns?: string[]): this {
    this.indexType = type;
    if (columns) {
      this.indexColumns = columns;
    }
    return this;
  }

  /**
   * Make this a unique index.
   *
   * @returns `this` for chaining.
   */
  unique(): this {
    this.isUnique = true;
    return this;
  }

  toSQL(): string {
    const tableRelation = buildRelation(this.tableSchema, this.tableName);
    const columns = this.indexColumns.map((c) => `"${c}"`).join(", ");
    const uniqueStr = this.isUnique ? " UNIQUE" : "";
    const concurrentlyStr = this.isConcurrent ? " CONCURRENTLY" : "";
    return `CREATE${uniqueStr} INDEX${concurrentlyStr} ${this.indexName} ON ${tableRelation} USING ${this.indexType} (${columns});`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const tableKey = `${this.tableSchema}.${this.tableName}`;
    const table = snapshot.tables[tableKey];
    if (!table) return;

    table.indexes[this.indexName] = {
      name: this.indexName,
      table: tableKey,
      columns: [...this.indexColumns],
      type: this.indexType,
      unique: this.isUnique,
    };
  }
}

// ============================================================================
// DROP INDEX
// ============================================================================

/**
 * DDL statement builder that drops an existing index.
 *
 * Generates: `DROP INDEX [CONCURRENTLY] <name>;`
 *
 * @example
 * ```typescript
 * ddl.dropIndex('idx_users_email');
 * // DROP INDEX idx_users_email;
 *
 * ddl.dropIndex('idx_users_email').concurrently();
 * // DROP INDEX CONCURRENTLY idx_users_email;
 * ```
 */
export class DropIndexStatement extends DDLStatement {
  readonly type = "dropIndex" as const;
  private isConcurrent = false;

  /**
   * @param indexName - The name of the index to drop.
   */
  constructor(private readonly indexName: string) {
    super();
  }

  /**
   * Drop the index concurrently, without locking writes on the table.
   *
   * Generates: `DROP INDEX CONCURRENTLY ...`
   *
   * @remarks
   * Concurrent index drops cannot run inside a transaction.
   * Set `transaction: false` in your migration options when using this.
   *
   * @returns `this` for chaining.
   */
  concurrently(): this {
    this.isConcurrent = true;
    return this;
  }

  toSQL(): string {
    const concurrentlyStr = this.isConcurrent ? " CONCURRENTLY" : "";
    return `DROP INDEX${concurrentlyStr} ${this.indexName};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    // Need to find which table has this index and remove it
    for (const table of Object.values(snapshot.tables)) {
      if (table.indexes[this.indexName]) {
        delete table.indexes[this.indexName];
        break;
      }
    }
  }
}

// ============================================================================
// DDL Builder (Main Entry Point)
// ============================================================================

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
   * Add a value to an existing enum.
   *
   * @remarks
   * PostgreSQL does not support removing enum values.
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
   * @param schema - The schema the enum belongs to.
   * @param name - The enum type name.
   * @returns A {@link DropEnumStatement}.
   */
  dropEnum(schema: string, name: string): DropEnumStatement {
    return new DropEnumStatement(schema, name);
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
