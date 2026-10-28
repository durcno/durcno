import {
  boolean,
  enumtype,
  notNull,
  now,
  pk,
  table,
  timestamp,
  type UuidVersion,
  unique,
  uuid,
  varchar,
} from "durcno";
import { createInsertSchema, createUpdateSchema } from "durcno/validators/zod";
import type * as z from "zod";
import { type Equal, Expect } from "./utils";

const TestEnum = enumtype("public", "testStatus", ["active", "inactive"]);

const TestTable = table("public", "testTable", {
  id: pk(),
  requiredField: varchar({ length: 50, notNull }),
  optionalField: varchar({ length: 100 }),
  uniqueField: varchar({ length: 30, unique }),
  booleanField: boolean({ notNull }),
  enumField: TestEnum.enumed({ notNull }),
  timestampField: timestamp({}).default(now()),
});

// -----------------------------------------------------------------------------
// Insert schema
// -----------------------------------------------------------------------------

const insertSchema = createInsertSchema(TestTable);

// Primary key is excluded
Expect<
  Equal<"id" extends keyof (typeof insertSchema)["shape"] ? false : true, true>
>();

// notNull columns are required
Expect<
  Equal<
    (typeof insertSchema)["shape"]["requiredField"] extends z.ZodString
      ? true
      : false,
    true
  >
>();

// Nullable columns are optional and nullable
Expect<
  Equal<
    (typeof insertSchema)["shape"]["optionalField"] extends z.ZodOptional<
      z.ZodNullable<z.ZodString>
    >
      ? true
      : false,
    true
  >
>();

// Columns with defaults are optional
Expect<
  Equal<
    (typeof insertSchema)["shape"]["timestampField"] extends z.ZodOptional<z.ZodTypeAny>
      ? true
      : false,
    true
  >
>();

// @ts-expect-error - createInsertSchema requires a table
createInsertSchema({ notATable: true });

export type NonExistentColumn =
  // @ts-expect-error - non-existent column shape
  (typeof insertSchema)["shape"]["nonExistentColumn"];

// -----------------------------------------------------------------------------
// Update schema
// -----------------------------------------------------------------------------

const updateSchema = createUpdateSchema(TestTable);

// Primary key is excluded
Expect<
  Equal<"id" extends keyof (typeof updateSchema)["shape"] ? true : false, false>
>();

// notNull columns become optional
Expect<
  Equal<
    (typeof updateSchema)["shape"]["requiredField"] extends z.ZodOptional<z.ZodString>
      ? true
      : false,
    true
  >
>();

// Nullable columns stay optional and nullable
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

// @ts-expect-error - createUpdateSchema requires a table
createUpdateSchema({ notATable: true });

// -----------------------------------------------------------------------------
// UUID version
// -----------------------------------------------------------------------------

const _uuidV4Col = uuid({ notNull, version: "v4" });
Expect<
  Equal<UuidVersion, "v1" | "v2" | "v3" | "v4" | "v5" | "v6" | "v7" | "v8">
>();

// @ts-expect-error - "v9" is not a valid UUID version
uuid({ version: "v9" });

// @ts-expect-error - the version is a string literal, not a number
uuid({ version: 4 });
