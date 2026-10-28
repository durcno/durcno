import type { Sql } from "durcno";
import { integer, notNull, pk, sequence, table } from "durcno";
import { type Equal, Expect } from "./utils";

export const customSequence = sequence("public", "orderSeq", {
  startWith: 100,
  maxValue: 10000,
  minValue: 100,
  cycle: true,
  cache: 10,
  increment: 2,
});

export const simpleSequence = sequence("public", "simpleSeq", {});

type SequenceName = typeof customSequence.name;
Expect<Equal<SequenceName, string>>();
type SequenceSchema = typeof customSequence.schema;
Expect<Equal<SequenceSchema, string>>();

// nextval / currval / setval all return Sql
const nextVal = customSequence.nextval();
const currVal = customSequence.currval();
const setVal = customSequence.setval(500);
Expect<Equal<typeof nextVal, Sql>>();
Expect<Equal<typeof currVal, Sql>>();
Expect<Equal<typeof setVal, Sql>>();

// @ts-expect-error - setval expects a number
customSequence.setval("not_a_number");

// A sequence can back a column default
const Orders = table("public", "orders", {
  id: pk(),
  orderNumber: integer({ default: customSequence.nextval(), notNull }),
});
Expect<
  Equal<
    "orderNumber" extends keyof typeof Orders._.columns ? true : false,
    true
  >
>();

// @ts-expect-error - startWith must be a number
sequence("public", "invalidSeq", { startWith: "100" });

// @ts-expect-error - increment must be a number
sequence("public", "invalidSeq2", { increment: "2" });

// @ts-expect-error - cycle must be a boolean
sequence("public", "invalidSeq3", { cycle: "true" });
