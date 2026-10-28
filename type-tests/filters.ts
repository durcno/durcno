import {
  Arg,
  and,
  eq,
  exists,
  gt,
  gte,
  isIn,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  notExists,
  notIn,
  or,
  prepare,
  sql,
} from "durcno";
import { db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

type UserRow = {
  id: bigint;
  username: string;
  email: string | null;
  type: "admin" | "user";
  createdAt: Date;
  externalId: string;
  trackingId: string | null;
};

type UserRows = UserRow[];
type PostRows = {
  id: bigint;
  userId: bigint;
  title: string | null;
  content: string | null;
  createdAt: Date;
  tags: string[] | null;
  metrics: { views: number; likes: number } | null;
}[];

// -----------------------------------------------------------------------------
// Comparisons
// -----------------------------------------------------------------------------

// eq/ne accept every column value shape without changing the row type
const comparisonQuery = db
  .from(Users)
  .select("*")
  .where(() =>
    and(
      eq(Users.id, 1n),
      eq(Users.username, "john"),
      eq(Users.email, "test@example.com"),
      eq(Users.type, "admin"),
      eq(Users.createdAt, new Date("2024-01-01")),
      ne(Users.id, 2n),
      ne(Users.username, "admin"),
      ne(Users.type, "user"),
      eq(Users.id, Users.username),
    ),
  );
type ComparisonResult = Awaited<typeof comparisonQuery>;
Expect<Equal<ComparisonResult, UserRows>>();

// gte/lte/gt/lt accept numbers, bigints, and dates
const rangeQuery = db
  .from(Users)
  .select("*")
  .where(() =>
    and(
      gte(Users.id, 1n),
      lte(Users.id, 100n),
      gt(Users.createdAt, new Date("2024-01-01")),
      lt(Users.createdAt, new Date("2024-12-31")),
    ),
  );
type RangeResult = Awaited<typeof rangeQuery>;
Expect<Equal<RangeResult, UserRows>>();

db.from(Users)
  .select("*")
  // @ts-expect-error - eq rejects a value of the wrong type
  .where(() => eq(Users.id, "string_instead_of_number"));

db.from(Users)
  .select("*")
  // @ts-expect-error - eq rejects an invalid enum value
  .where(() => eq(Users.type, "invalid_type"));

db.from(Users)
  .select("*")
  // @ts-expect-error - ne rejects a value of the wrong type
  .where(() => ne(Users.id, "not_a_number"));

db.from(Users)
  .select("*")
  // @ts-expect-error - gte rejects a value of the wrong type
  .where(() => gte(Users.id, "not_a_number"));

db.from(Users)
  .select("*")
  // @ts-expect-error - gt rejects a value of the wrong type
  .where(() => gt(Users.id, "not_a_number"));

db.from(Users)
  .select("*")
  // @ts-expect-error - lte rejects a value of the wrong type
  .where(() => lte(Users.createdAt, "not_a_date"));

db.from(Users)
  .select("*")
  // @ts-expect-error - lt rejects a value of the wrong type
  .where(() => lt(Users.createdAt, "not_a_date"));

db.from(Users)
  .select("*")
  // @ts-expect-error - column from another table
  .where(() => eq(Posts.userId, 1));

db.from(Users)
  .select("*")
  // @ts-expect-error - non-existent field
  .where(() => eq(Users.nonExistentField, "value"));

// -----------------------------------------------------------------------------
// Nullability
// -----------------------------------------------------------------------------

const nullabilityQuery = db
  .from(Users)
  .select("*")
  .where(() => and(isNull(Users.email), isNotNull(Users.email)));
type NullabilityResult = Awaited<typeof nullabilityQuery>;
Expect<Equal<NullabilityResult, UserRows>>();

// -----------------------------------------------------------------------------
// Membership
// -----------------------------------------------------------------------------

const membershipQuery = db
  .from(Users)
  .select("*")
  .where(() =>
    and(
      isIn(Users.id, [1n, 2n, 3n]),
      isIn(Users.username, ["alice", "bob"]),
      isIn(Users.type, ["admin", "user"]),
      isIn(Users.id, []),
      notIn(Users.username, ["alice"]),
    ),
  );
type MembershipResult = Awaited<typeof membershipQuery>;
Expect<Equal<MembershipResult, UserRows>>();

// A subquery is accepted where an array is
const subqueryMembershipQuery = db
  .from(Posts)
  .select("*")
  .where(() =>
    and(
      isIn(
        Posts.userId,
        db.from(Users).select(() => ({ id: Users.id })),
      ),
      notIn(
        Posts.userId,
        db.from(Users).select(() => ({ id: Users.id })),
      ),
    ),
  );
type SubqueryMembershipResult = Awaited<typeof subqueryMembershipQuery>;
Expect<Equal<SubqueryMembershipResult, PostRows>>();

// Both checks return a boolean in a projection
const flagProjectionQuery = db.from(Users).select(() => ({
  isAdmin: isIn(Users.type, ["admin"]),
  notAdmin: notIn(Users.type, ["admin"]),
}));
type FlagProjection = Awaited<typeof flagProjectionQuery>;
Expect<Equal<FlagProjection, { isAdmin: boolean; notAdmin: boolean }[]>>();

// Prepared arguments are accepted inside the array
const preparedIsInQuery = prepare(
  { id1: Users.id.arg(), id2: Users.id.arg() },
  (args) =>
    db
      .prepare()
      .from(Users)
      .select("*")
      .where(() => isIn(Users.id, [args.id1, args.id2])),
);
type PreparedIsInResult = Awaited<ReturnType<typeof preparedIsInQuery.run>>;
Expect<Equal<PreparedIsInResult, UserRows>>();

db.from(Users)
  .select("*")
  // @ts-expect-error - isIn rejects an array of the wrong element type
  .where(() => isIn(Users.id, ["a", "b"]));

db.from(Users)
  .select("*")
  // @ts-expect-error - isIn rejects invalid enum values
  .where(() => isIn(Users.type, ["admin", "invalid"]));

db.from(Users)
  .select("*")
  // @ts-expect-error - notIn rejects an array of the wrong element type
  .where(() => notIn(Users.id, ["a", "b"]));

db.from(Users)
  .select("*")
  // @ts-expect-error - an unprepared query cannot accept Arg placeholders
  .where(() => isIn(Users.id, [Arg.bigint()]));

// -----------------------------------------------------------------------------
// Logical composition
// -----------------------------------------------------------------------------

// and/or nest arbitrarily and preserve the row type
const nestedQuery = db
  .from(Posts)
  .select("*")
  .where(() =>
    or(
      and(
        or(
          and(gte(Posts.userId, 1n), lte(Posts.userId, 10n)),
          and(gte(Posts.userId, 100n), lte(Posts.userId, 200n)),
        ),
        gte(Posts.id, 1n),
      ),
      eq(Posts.id, 999n),
    ),
  );
type NestedResult = Awaited<typeof nestedQuery>;
Expect<Equal<NestedResult, PostRows>>();

const nestedProjectionQuery = db
  .from(Users)
  .select(() => ({ id: Users.id, type: Users.type }))
  .where(() =>
    and(or(gte(Users.id, 1n), lte(Users.id, 100n)), eq(Users.type, "admin")),
  );
type NestedProjection = Awaited<typeof nestedProjectionQuery>;
Expect<Equal<NestedProjection, { id: bigint; type: "admin" | "user" }[]>>();

// -----------------------------------------------------------------------------
// exists / notExists
// -----------------------------------------------------------------------------

const existsWhereQuery = db
  .from(Users)
  .select("*")
  .where(() =>
    exists(
      db
        .from(Posts)
        .select("*")
        .where(() => eq(Posts.userId, Users.id)),
    ),
  );
type ExistsWhereResult = Awaited<typeof existsWhereQuery>;
Expect<Equal<ExistsWhereResult, UserRows>>();

// Both helpers return booleans in a projection
const existsProjectionQuery = db.from(Users).select(() => ({
  hasPosts: exists(
    db
      .from(Posts)
      .select("*")
      .where(() => eq(Posts.userId, Users.id)),
  ),
  noPosts: notExists(
    db
      .from(Posts)
      .select("*")
      .where(() => eq(Posts.userId, Users.id)),
  ),
}));
type ExistsProjection = Awaited<typeof existsProjectionQuery>;
Expect<Equal<ExistsProjection, { hasPosts: boolean; noPosts: boolean }[]>>();

// Raw SQL is accepted as the subquery
const existsRawSqlQuery = db
  .from(Users)
  .select("*")
  .where(() =>
    exists(sql`SELECT 1 FROM posts WHERE Posts.user_id = ${Users.id}`),
  );
type ExistsRawSqlResult = Awaited<typeof existsRawSqlQuery>;
Expect<Equal<ExistsRawSqlResult, UserRows>>();

db.from(Users)
  .select("*")
  // @ts-expect-error - exists expects a subquery or Sql, not a string
  .where(() => exists("invalid"));

const preparedSubquery = db
  .prepare()
  .from(Posts)
  .select("*")
  .where(() => eq(Posts.userId, Arg.bigint()));

db.from(Users)
  .select("*")
  // @ts-expect-error - a prepared subquery cannot be used in an unprepared query
  .where(() => exists(preparedSubquery));
