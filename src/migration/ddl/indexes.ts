import type { IndexType } from "../../indexes";
import type { Snapshot } from "../snapshot";
import { DDLStatement } from "./statement";

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
    const tableRelation = `"${this.tableSchema}"."${this.tableName}"`;
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
      columns: [...this.indexColumns],
      type: this.indexType,
      unique: this.isUnique,
    };
  }
}

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
