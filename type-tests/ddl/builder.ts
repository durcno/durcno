import { type DDLStatement, ddl, sql, type MigrationOptions } from "durcno/migration";


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


// Negative: check() no longer accepts a raw SnapshotCheckExpr object — only callbacks
ddl
  .createTable("public", "users")
  .column("id", "serial", { primaryKey: true })
  .column("name", "varchar(255)", { notNull: true })
  // @ts-expect-error: raw SnapshotCheckExpr is no longer accepted; use the callback form
  .check("name_not_empty", { type: "raw", sql: "name <> ''" });

// Positive: 'as' option allowed on column options
const _asOption = ddl
  .createTable("public", "users")
  .column("id", "serial", { as: "(START WITH 1)" });

// Negative: addCheck() no longer accepts a raw SnapshotCheckExpr object — only callbacks
ddl
  .alterTable("public", "users")
  .addColumn("email", "varchar(255)", { notNull: true })
  .dropColumn("old_field")
  .setNotNull("name")
  // @ts-expect-error: raw SnapshotCheckExpr is no longer accepted; use the callback form
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


const _tableSql: string = _tableBuilder.toSQL();
const _alterSql: string = _alterBuilder.toSQL();
const _indexSql: string = _indexBuilder.toSQL();
const _enumSql: string = _enumStatement.toSQL();
const _seqSql: string = _seqStatement.toSQL();
const _dropSql: string = _dropStatement.toSQL();
const _customSql: string = _customStatement.toSQL();


const _isCustomFlag: boolean = _customStatement.isCustom;
const _isCustomFlag2: boolean = _tableBuilder.isCustom;


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
// MigrationCheckBuilder callback pattern — positive type tests
// ============================================================================

// Positive: check() accepts a simple comparison callback
const _checkGt = ddl
  .createTable("public", "orders")
  .column("price", "bigint", { notNull: true })
  .check("positive_price", ({ gt }) => gt("price", sql`0`));

// Positive: check() accepts a logical AND callback
const _checkAnd = ddl
  .createTable("public", "orders")
  .column("quantity", "integer", { notNull: true })
  .check("valid_qty", ({ and, gte, lte }) =>
    and(gte("quantity", sql`0`), lte("quantity", sql`10000`)),
  );

// Positive: check() accepts a LIKE callback
const _checkLike = ddl
  .createTable("public", "users")
  .column("email", "varchar(255)", {})
  .check("valid_email", ({ like }) => like("email", sql`'%@%.%'`));

// Positive: check() accepts function-based constraints (fnGte, length)
const _checkFn = ddl
  .createTable("public", "items")
  .column("name", "varchar(100)", { notNull: true })
  .check("name_length", ({ and, fnGte, fnLte, length }) =>
    and(fnGte(length("name"), sql`2`), fnLte(length("name"), sql`100`)),
  );

// Positive: check() accepts raw() fallback
const _checkRaw = ddl
  .createTable("public", "misc")
  .column("price", "bigint", {})
  .check("raw_check", ({ raw }) => raw("price > 0"));

// Positive: check() returns this — chainable
const _checkChained: DDLStatement = ddl
  .createTable("public", "products")
  .column("price", "bigint", { notNull: true })
  .check("positive_price", ({ gt }) => gt("price", sql`0`))
  .check("max_price", ({ lt }) => lt("price", sql`1000000`));

// Positive: addCheck() on AlterTableBuilder accepts a callback
const _addCheckCallback: DDLStatement = ddl
  .alterTable("public", "orders")
  .addCheck("max_price", ({ lt }) => lt("price", sql`1000000`));

// Positive: OR logical operator
const _checkOr = ddl
  .createTable("public", "t")
  .column("status", "text", {})
  .check("status_ok", ({ or, eq }) =>
    or(eq("status", sql`'active'`), eq("status", sql`'pending'`)),
  );

// Positive: IN operator
const _checkIn = ddl
  .createTable("public", "t2")
  .column("category_id", "integer", {})
  .check("valid_category", ({ in: inOp }) => inOp("category_id", sql`(1, 2, 3)`));

// Positive: NOT IN operator
const _checkNotIn = ddl
  .createTable("public", "t3")
  .column("status", "text", {})
  .check("excluded_status", ({ notIn }) => notIn("status", sql`('archived', 'deleted')`));

// Positive: neq operator
const _checkNeq = ddl
  .createTable("public", "t4")
  .column("name", "varchar(100)", {})
  .check("name_not_empty", ({ neq }) => neq("name", sql`''`));


// ============================================================================
// MigrationCheckBuilder callback pattern — negative type tests
// ============================================================================

// Negative: callback must return a SnapshotCheckExpr — string is rejected
ddl.createTable("public", "t")
  // @ts-expect-error: callback must return SnapshotCheckExpr, not string
  .check("bad", ({ gt }) => "not an expr");

// Negative: callback must return a SnapshotCheckExpr — number is rejected
ddl.createTable("public", "t")
  // @ts-expect-error: callback must return SnapshotCheckExpr, not number
  .check("bad2", (_b) => 42);

// Negative: addCheck callback must return a SnapshotCheckExpr
ddl.alterTable("public", "t")
  // @ts-expect-error: callback must return SnapshotCheckExpr, not boolean
  .addCheck("bad3", (_b) => true);

// Suppress unused variable warnings for positive tests
void _tableBuilder;
void _tableAsStatement;
void _alterBuilder;
void _alterAsStatement;
void _indexBuilder;
void _indexAsStatement;
void _enumStatement;
void _seqStatement;
void _dropStatement;
void _customStatement;
void _asOption;
void _chainedIndex;
void _onWithCols;
void _usingWithCols;
void _simpleOnOnly;
void _concurrentIndex;
void _concurrentAsStatement;
void _concurrentDrop;
void _concurrentDropAsStatement;
void _tableSql;
void _alterSql;
void _indexSql;
void _enumSql;
void _seqSql;
void _dropSql;
void _customSql;
void _isCustomFlag;
void _isCustomFlag2;
void _statements;
void _checkGt;
void _checkAnd;
void _checkLike;
void _checkFn;
void _checkRaw;
void _checkChained;
void _addCheckCallback;
void _checkOr;
void _checkIn;
void _checkNotIn;
void _checkNeq;

// suppress unused import warning
type _MigOpts = MigrationOptions;
