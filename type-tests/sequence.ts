import type { Sql } from "durcno";
import { integer, notNull, pk, sequence, table } from "durcno";
import type { Equal } from "./utils";
import { Expect } from "./utils";

// Test basic sequence creation with all options
export const customSequence = sequence("public", "orderSeq", {
  startWith: 100,
  maxValue: 10000,
  minValue: 100,
  cycle: true,
  cache: 10,
  increment: 2,
});

// Test sequence creation with no options
export const simpleSequence = sequence("public", "simpleSeq", {});

// Test sequence creation with schema
const schemaSequence = sequence("public", "schemaSeq", {
  startWith: 1,
  increment: 1,
});

// Test sequence name property
type SequenceName = typeof customSequence.name;
Expect<Equal<SequenceName, string>>();

// Test sequence schema property
type SequenceSchema = typeof customSequence.schema;
Expect<Equal<SequenceSchema, string>>();

// Test nextval() returns Sql
const nextVal = customSequence.nextval();
Expect<Equal<typeof nextVal, Sql>>();

// Test currval() returns Sql
const currVal = customSequence.currval();
Expect<Equal<typeof currVal, Sql>>();

// Test setval() returns Sql
const setVal = customSequence.setval(500);
Expect<Equal<typeof setVal, Sql>>();

// Test sequence with schema - nextval() returns Sql
const schemaNextVal = schemaSequence.nextval();
Expect<Equal<typeof schemaNextVal, Sql>>();

// Test sequence usage as column default
const Orders = table("public", "orders", {
  id: pk(),
  orderNumber: integer({ default: customSequence.nextval(), notNull }),
});

// Type check: Orders table should have the orderNumber column
type OrderColumns = typeof Orders._.columns;
type HasOrderNumberColumn = "orderNumber" extends keyof OrderColumns
  ? true
  : false;
Expect<Equal<HasOrderNumberColumn, true>>();

// ============================================================================
// Negative type tests - these should cause compile errors
// ============================================================================

// @ts-expect-error - setval with non-number should not compile
customSequence.setval("not_a_number");

// @ts-expect-error - sequence options with invalid startWith type should not compile
sequence("public", "invalidSeq", { startWith: "100" });

// @ts-expect-error - sequence options with invalid maxValue type should not compile
sequence("public", "invalidSeq2", { maxValue: "10000" });

// @ts-expect-error - sequence options with invalid increment type should not compile
sequence("public", "invalidSeq3", { increment: "2" });

// @ts-expect-error - sequence options with invalid cache type should not compile
sequence("public", "invalidSeq4", { cache: "10" });

// @ts-expect-error - sequence options with invalid cycle type should not compile
sequence("public", "invalidSeq5", { cycle: "true" });
