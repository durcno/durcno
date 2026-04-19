/**
 * Type tests for DDL Builder API
 */
import {
  type DDLStatement,
  ddl,
  type MigrationOptions,
} from "durcno/migration";

// ============================================================================
// MigrationOptions type tests
// ============================================================================

// Positive: Full options
const _fullOptions: MigrationOptions = {
  transaction: true,
};

// Positive: Empty options (all optional)
const _emptyOptions: MigrationOptions = {};

// ============================================================================
// DDL Builder return types
// ============================================================================

// Positive: createTable returns CreateTableBuilder
const _tableBuilder = ddl.createTable("public", "users");

// Positive: CreateTableBuilder extends DDLStatement
const _tableAsStatement: DDLStatement = _tableBuilder;

// Positive: alterTable returns AlterTableBuilder
const _alterBuilder = ddl.alterTable("public", "users");

// Positive: AlterTableBuilder extends DDLStatement
const _alterAsStatement: DDLStatement = _alterBuilder;

// Positive: createIndex returns CreateIndexBuilder
const _indexBuilder = ddl.createIndex("users_name_idx");

// Positive: CreateIndexBuilder extends DDLStatement
const _indexAsStatement: DDLStatement = _indexBuilder;

// Positive: createEnum returns CreateEnumStatement
const _enumStatement = ddl.createEnum("public", "user_type", ["admin", "user"]);

// Positive: createSequence returns CreateSequenceStatement
const _seqStatement = ddl.createSequence("public", "user_seq", {
  startWith: 1,
});

// Positive: dropTable returns DropTableStatement
const _dropStatement = ddl.dropTable("public", "users");

// Positive: custom returns CustomStatement
const _customStatement = ddl.custom("INSERT INTO users VALUES (1)");

// ============================================================================
// Chainable methods return this
// ============================================================================

// Positive: CreateTableBuilder.column returns this (chainable)
const _chainedTable = ddl
  .createTable("public", "users")
  .column("id", "serial", { primaryKey: true })
  .column("name", "varchar(255)", { notNull: true })
  .check("name_not_empty", { type: "raw", sql: "name <> ''" });

// Positive: 'as' option allowed on column options
const _asOption = ddl
  .createTable("public", "users")
  .column("id", "serial", { as: "(START WITH 1)" });

// Positive: AlterTableBuilder methods return this (chainable)
const _chainedAlter = ddl
  .alterTable("public", "users")
  .addColumn("email", "varchar(255)", { notNull: true })
  .dropColumn("old_field")
  .setNotNull("name")
  .addCheck("email_valid", { type: "raw", sql: "email LIKE '%@%'" });

// Positive: CreateIndexBuilder methods return this (chainable)
const _chainedIndex = ddl
  .createIndex("users_name_idx")
  .on("public", "users", ["name"])
  .using("btree")
  .unique();

// Positive: columns provided in on(), using() just sets index type
const _onWithCols = ddl
  .createIndex("idx_with_on_cols")
  .on("public", "users", ["email"])
  .using("btree")
  .unique();

// Positive: columns can be provided in using(type, columns)
const _usingWithCols = ddl
  .createIndex("idx_with_using_cols")
  .on("public", "users")
  .using("hash", ["id"])
  .unique();

// Positive: skip using entirely to default to btree
const _simpleOnOnly = ddl
  .createIndex("idx_simple")
  .on("public", "users", ["id"]);

// Positive: concurrently() chainable on CreateIndexBuilder
const _concurrentIndex = ddl
  .createIndex("idx_concurrent")
  .concurrently()
  .on("public", "users", ["email"])
  .using("btree")
  .unique();

// Positive: concurrently() on CreateIndexBuilder returns DDLStatement
const _concurrentAsStatement: DDLStatement = _concurrentIndex;

// Positive: concurrently() chainable on dropIndex
const _concurrentDrop = ddl.dropIndex("idx_users_email").concurrently();

// Positive: dropIndex with concurrently() returns DDLStatement
const _concurrentDropAsStatement: DDLStatement = _concurrentDrop;

// ============================================================================
// toSQL returns string
// ============================================================================

const _tableSql: string = _tableBuilder.toSQL();
const _alterSql: string = _alterBuilder.toSQL();
const _indexSql: string = _indexBuilder.toSQL();
const _enumSql: string = _enumStatement.toSQL();
const _seqSql: string = _seqStatement.toSQL();
const _dropSql: string = _dropStatement.toSQL();
const _customSql: string = _customStatement.toSQL();

// ============================================================================
// DDLStatement isCustom
// ============================================================================

const _isCustomFlag: boolean = _customStatement.isCustom;
const _isCustomFlag2: boolean = _tableBuilder.isCustom;

// ============================================================================
// Statements array type
// ============================================================================

const _statements: DDLStatement[] = [
  ddl.createEnum("public", "user_type", ["admin", "user"]),
  ddl
    .createTable("public", "users")
    .column("id", "serial", { primaryKey: true })
    .column("type", "public.user_type"),
  ddl
    .createIndex("users_type_idx")
    .on("public", "users", ["type"])
    .using("btree"),
  ddl.custom("INSERT INTO users (type) VALUES ('admin')"),
];

// ============================================================================
// Negative tests
// ============================================================================

// @ts-expect-error: createTable requires schema and name arguments
ddl.createTable();

// @ts-expect-error: createEnum requires schema, name and array of strings
ddl.createEnum("public", "type", "not-an-array");

// @ts-expect-error: column requires name and type
ddl.createTable("public", "users").column();

ddl
  .createTable("public", "users")
  // @ts-expect-error: invalid option key
  .column("id", "serial", { invalidOption: true });

// @ts-expect-error: createIndex requires name argument
ddl.createIndex();

// Positive: on can be called without columns when using(type, columns)
ddl.createIndex("idx").on("public", "users");

// @ts-expect-error: on columns must be a string array
ddl.createIndex("idx").on("public", "users", "not-an-array");

// @ts-expect-error: using columns must be a string array
ddl.createIndex("idx").on("public", "users").using("btree", "not-an-array");

// @ts-expect-error: concurrently does not accept arguments
ddl.createIndex("idx").concurrently(true);

// @ts-expect-error: concurrently on dropIndex does not accept arguments
ddl.dropIndex("idx").concurrently(true);
