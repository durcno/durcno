import {
  boolean,
  enumtype,
  notNull,
  now,
  pk,
  table,
  timestamp,
  uuid,
  varchar,
  type UuidVersion,
} from "durcno";
import { createInsertSchema, createUpdateSchema } from "durcno/validators/zod";
import type * as z from "zod";
import { type Equal, Expect } from "./utils";

const TestEnum = enumtype("public", "testStatus", ["active", "inactive"]);

const TestTable = table("public", "testTable", {
  id: pk(), // auto-generated, should not be in insert schema
  requiredField: varchar({ length: 50, notNull }),
  optionalField: varchar({ length: 100 }), // nullable, should be optional
  uniqueField: varchar({ length: 30 }),
  booleanField: boolean({ notNull }),
  enumField: TestEnum.enumed({ notNull }),
  timestampField: timestamp({}).default(now()), // has default, should be optional
});

// Test createInsertSchema
const insertSchema = createInsertSchema(TestTable);

// Test that id (pk with generated: "ALWAYS") is excluded from insert schema
Expect<
  Equal<"id" extends keyof (typeof insertSchema)["shape"] ? false : true, true>
>();

// Test that required fields are required
Expect<
  Equal<
    (typeof insertSchema)["shape"]["requiredField"] extends z.ZodString
      ? true
      : false,
    true
  >
>();

// Test that optional nullable fields are optional and nullable
Expect<
  Equal<
    (typeof insertSchema)["shape"]["optionalField"] extends z.ZodOptional<z.ZodString>
      ? true
      : false,
    true
  >
>();

// Test that fields with defaults are optional
Expect<
  Equal<
    (typeof insertSchema)["shape"]["timestampField"] extends z.ZodOptional<z.ZodTypeAny>
      ? true
      : false,
    true
  >
>();

// Test createInsertSchema with extend

// Test createUpdateSchema
const updateSchema = createUpdateSchema(TestTable);

// Test that id (pk with generated: "ALWAYS") is excluded from update schema
Expect<
  Equal<"id" extends keyof (typeof updateSchema)["shape"] ? true : false, false>
>();

// Test that non-nullable fields are optional
Expect<
  Equal<
    (typeof updateSchema)["shape"]["requiredField"] extends z.ZodOptional<z.ZodString>
      ? true
      : false,
    true
  >
>();

// Test that nullable fields are optional and nullable
Expect<
  Equal<
    (typeof updateSchema)["shape"]["optionalField"] extends z.ZodOptional<
      z.ZodNullable<z.ZodString>
    >
      ? true
      : false,
    true
  >
>();

// ============================================================================
// Negative type tests - these should cause compile errors
// ============================================================================

// @ts-expect-error - createInsertSchema with non-table should not compile
createInsertSchema({ notATable: true });

// @ts-expect-error - createUpdateSchema with non-table should not compile
createUpdateSchema({ notATable: true });

export type NonExistentColumn =
  // @ts-expect-error - Accessing non-existent column shape should not compile
  (typeof insertSchema)["shape"]["nonExistentColumn"];

// ============================================================================
// UUID version option type tests
// ============================================================================

// Positive: uuid column accepts version option
const _uuidV4Col = uuid({ notNull, version: "v4" });
const _uuidV7Col = uuid({ version: "v7" });
const _uuidNoVersion = uuid({ notNull });
const _uuidEmpty = uuid({});

// Positive: UuidVersion type includes all expected versions
Expect<
  Equal<UuidVersion, "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | "v8">
>();

// Positive: uuid with version works in table definition
const _UuidVersionTable = table("public", "uuid_version_test", {
  id: pk(),
  v4Id: uuid({ notNull, version: "v4" }),
  v7Id: uuid({ notNull, version: "v7" }),
  anyId: uuid({ notNull }),
});

// Negative: invalid version string should not compile
// @ts-expect-error - "v9" is not a valid UUID version
uuid({ version: "v9" });

// @ts-expect-error - numeric version is not valid
uuid({ version: 4 });
