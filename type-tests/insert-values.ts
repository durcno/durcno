import {
  bigint,
  database,
  notNull,
  now,
  primaryKey,
  type Sql,
  table,
  timestamp,
  varchar,
} from "durcno";
import { type Equal, Expect, testSetup } from "./utils";

// Test different column configurations for insert types

// Table with various column configurations
const TestTable = table("public", "testTable", {
  // Generate ALWAYS - should be never in insert
  id: bigint({ primaryKey, generated: "ALWAYS" as const }),

  // Generate BY DEFAULT - should be optional in insert
  autoId: bigint({ generated: "BY DEFAULT" as const }),

  // Not null without default - should be required in insert
  requiredField: varchar({ length: 50, notNull }),

  // Not null with default - should be optional in insert (default takes precedence)
  requiredWithDefault: varchar({
    length: 50,
    notNull,
  }).default("defaultValue"),

  // Default without not null - should be optional in insert
  optionalWithDefault: varchar({ length: 50 }).default("defaultValue"),

  // Nullable without default - should allow TColVal in insert
  nullable: varchar({ length: 50 }),

  // Timestamp with now() default and notNull - should be optional
  createdAt: timestamp({ notNull }).default(now()),
});

const db = database({ TestTable }, testSetup);

// Get the insert type by using the insert query builder's values method
type TestInsertType = Parameters<
  ReturnType<typeof db.insert<typeof TestTable>>["values"]
>[0] extends (infer T)[] | object
  ? T
  : never;

// Test: Generate ALWAYS should be never (column should not exist in insert type)
// The `id` column should not exist in the insert type at all
Expect<Equal<"id" extends keyof TestInsertType ? true : false, false>>();

// Test: Generate BY DEFAULT should be optional
Expect<Equal<TestInsertType["autoId"], number | undefined>>();

// Test: Not null without default should be required
Expect<Equal<TestInsertType["requiredField"], string | Sql>>();

// Test: Not null with default should be optional (default takes precedence)
Expect<
  Equal<TestInsertType["requiredWithDefault"], string | null | undefined | Sql>
>();

// Test: Default without not null should be optional
Expect<
  Equal<TestInsertType["optionalWithDefault"], string | null | undefined | Sql>
>();

// Test: Nullable without default should allow the value type and null
Expect<Equal<TestInsertType["nullable"], string | null | undefined | Sql>>();

// Test: Timestamp with now() default and notNull should be optional
Expect<Equal<TestInsertType["createdAt"], Date | null | undefined | Sql>>();

// Test actual insert operations work correctly
db.insert(TestTable).values({
  // @ts-expect-error - id should cause a type error since it's generated: "ALWAYS"
  id: 1,
  // autoId: 1, // This should be optional
  requiredField: "test", // This should be required
  // requiredWithDefault: "test", // This should be optional due to default
  // optionalWithDefault: "test", // This should be optional
  // nullable: "test", // This should be optional due to no constraint
  // createdAt: new Date(), // This should be optional due to default
});

// Test another insert with optional fields
db.insert(TestTable).values({
  autoId: undefined,
  requiredField: "test",
  requiredWithDefault: "custom",
  optionalWithDefault: "custom",
  nullable: "test",
  createdAt: new Date(),
});

export { TestTable };
