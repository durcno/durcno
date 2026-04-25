import { type DDLStatement, ddl, type MigrationOptions } from "durcno/migration";


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
