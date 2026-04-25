import type { OnDeleteAction } from "../../columns/common";
import {
  type SnapshotCheckExpr,
  snapshotExprToSQL,
} from "../../constraints/check";
import type {
  Snapshot,
  SnapshotColumn,
  SnapshotTablePrimaryKey,
  SnapshotTableUnique,
} from "../snapshot";
import { DDLStatement } from "./statement";

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
    const relation = `"${this.schema}"."${this.name}"`;

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
    const relation = `"${this.schema}"."${this.name}"`;
    return `DROP TABLE ${relation};`;
  }

  applyToSnapshot(snapshot: Snapshot): void {
    const key = `${this.schema}.${this.name}`;
    delete snapshot.tables[key];
  }
}

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
    const relation = `"${this.schema}"."${this.oldName}"`;
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
  | { type: "addPrimaryKeyConstraint"; name: string; columns: string[] }
  | {
      type: "addForeignKey";
      constraintName: string;
      column: string;
      references: ColumnReference;
    }
  | { type: "dropForeignKey"; constraintName: string; column: string };

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

  /**
   * Add a foreign key constraint to an existing column.
   *
   * @param constraintName - The explicit constraint name.
   * @param column - The column name.
   * @param references - The foreign key reference target.
   * @returns `this` for chaining.
   */
  addForeignKey(
    constraintName: string,
    column: string,
    references: ColumnReference,
  ): this {
    this.actions.push({
      type: "addForeignKey",
      constraintName,
      column,
      references,
    });
    return this;
  }

  /**
   * Drop a foreign key constraint from a column.
   *
   * @param constraintName - The constraint name to drop.
   * @param column - The column whose FK is being dropped.
   * @returns `this` for chaining.
   */
  dropForeignKey(constraintName: string, column: string): this {
    this.actions.push({ type: "dropForeignKey", constraintName, column });
    return this;
  }

  toSQL(): string {
    const relation = `"${this.schema}"."${this.name}"`;

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
            `ALTER TABLE ${relation} ALTER COLUMN "${action.column}" SET DEFAULT ${action.defaultValue};`,
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
        case "addForeignKey": {
          const refTable = `"${action.references.schema}"."${action.references.table}"`;
          statements.push(
            `ALTER TABLE ${relation} ADD CONSTRAINT ${action.constraintName} FOREIGN KEY ("${action.column}") REFERENCES ${refTable}("${action.references.column}") ON DELETE ${action.references.onDelete};`,
          );
          break;
        }
        case "dropForeignKey": {
          statements.push(
            `ALTER TABLE ${relation} DROP CONSTRAINT ${action.constraintName};`,
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
        case "addForeignKey": {
          if (table.columns[action.column]) {
            table.columns[action.column].references = {
              schema: action.references.schema,
              table: action.references.table,
              column: action.references.column,
              onDelete: action.references.onDelete,
            };
          }
          break;
        }
        case "dropForeignKey": {
          if (table.columns[action.column]) {
            delete table.columns[action.column].references;
          }
          break;
        }
      }
    }
  }
}
