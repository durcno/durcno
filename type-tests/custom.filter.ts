import type { AnyColumn, Query, TableColumn } from "durcno";
import { and, eq, Filter } from "durcno";
import { db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// ============================================================================
// Custom Filters
// ============================================================================

// A basic string length generic custom filter
class ColumnLengthFilter<
  TCol extends TableColumn<any, any, any, AnyColumn>,
> extends Filter<TCol> {
  constructor(
    private readonly field: TCol,
    private readonly length: number,
  ) {
    super();
  }

  toQuery(query: Query): void {
    query.sql += `LENGTH(${this.field.fullName}) > ${this.length}`;
  }
}

function hasNameLongerThan<TCol extends TableColumn<any, any, any, AnyColumn>>(
  field: TCol,
  length: number,
) {
  return new ColumnLengthFilter(field, length);
}

// Positive Test: Valid Custom Filter usage
const validCustomQuery = db
  .from(Users)
  .select()
  .where(hasNameLongerThan(Users.username, 5));

type ValidCustomResult = Awaited<typeof validCustomQuery>;
Expect<
  Equal<
    ValidCustomResult,
    {
      id: number;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    }[]
  >
>();

// Positive Test: Custom filter mixed with existing conditions (and)
const validMixedQuery = db
  .from(Users)
  .select()
  .where(and(eq(Users.type, "admin"), hasNameLongerThan(Users.username, 5)));

type ValidMixedResult = Awaited<typeof validMixedQuery>;
Expect<
  Equal<
    ValidMixedResult,
    {
      id: number;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    }[]
  >
>();

// ============================================================================
// Negative type tests - these should cause compile errors
// ============================================================================

// @ts-expect-error - Using a column that does not exist in the from/join scope should fail
db.from(Users).select().where(hasNameLongerThan(Posts.title, 5));

db.from(Users)
  .select()
  .where(
    // @ts-expect-error - and() with wrong table column should fail when passed to where()
    and(eq(Users.type, "admin"), hasNameLongerThan(Posts.title, 5)),
  );
