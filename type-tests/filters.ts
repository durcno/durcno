import {
  Arg,
  and,
  caseWhen,
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
import { Comments, db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// ============================================================================
// Common Expected Types
// ============================================================================

// Full row types for each table
type UserRow = {
  id: bigint;
  username: string;
  email: string | null;
  type: "admin" | "user";
  createdAt: Date;
  externalId: string;
  trackingId: string | null;
};

type PostRow = {
  id: bigint;
  userId: bigint;
  title: string | null;
  content: string | null;
  createdAt: Date;
  tags: string[] | null;
  metrics: { views: number; likes: number } | null;
};

type CommentRow = {
  id: bigint;
  postId: bigint;
  userId: bigint;
  body: string | null;
  createdAt: Date;
};

// Array versions (most common return type)
type UserRows = UserRow[];
type PostRows = PostRow[];
type CommentRows = CommentRow[];

// ============================================================================
// eq() - Equality Tests
// ============================================================================

// Type test: eq with value - should filter correctly
const eqValueQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => eq(users.id, 1n));
type EqValueResult = Awaited<typeof eqValueQuery>;
Expect<Equal<EqValueResult, UserRows>>();

// Type test: eq with string column
const eqStringQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => eq(users.username, "john"));
type EqStringResult = Awaited<typeof eqStringQuery>;
Expect<Equal<EqStringResult, UserRows>>();

// Type test: eq with nullable column
const eqNullableQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => eq(users.email, "test@example.com"));
type EqNullableResult = Awaited<typeof eqNullableQuery>;
Expect<Equal<EqNullableResult, UserRows>>();

// Type test: eq with enum column
const eqEnumQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => eq(users.type, "admin"));
type EqEnumResult = Awaited<typeof eqEnumQuery>;
Expect<Equal<EqEnumResult, UserRows>>();
// Type test: eq with Date column
const eqDateQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => eq(users.createdAt, new Date("2024-01-01")));
type EqDateResult = Awaited<typeof eqDateQuery>;
Expect<Equal<EqDateResult, UserRows>>();

// ============================================================================
// ne() - Not Equal Tests
// ============================================================================

// Type test: ne with value
const neValueQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => ne(users.id, 1n));
type NeValueResult = Awaited<typeof neValueQuery>;
Expect<Equal<NeValueResult, UserRows>>();

// Type test: ne with string
const neStringQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => ne(users.username, "admin"));
type NeStringResult = Awaited<typeof neStringQuery>;
Expect<Equal<NeStringResult, UserRows>>();

// Type test: ne with enum
const neEnumQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => ne(users.type, "admin"));
type NeEnumResult = Awaited<typeof neEnumQuery>;
Expect<Equal<NeEnumResult, UserRows>>();

// ============================================================================
// gte() - Greater Than or Equal Tests
// ============================================================================

// Type test: gte with number
const gteNumberQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => gte(users.id, 10n));
type GteNumberResult = Awaited<typeof gteNumberQuery>;
Expect<Equal<GteNumberResult, UserRows>>();

// Type test: gte with Date
const gteDateQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => gte(users.createdAt, new Date("2024-01-01")));
type GteDateResult = Awaited<typeof gteDateQuery>;
Expect<Equal<GteDateResult, UserRows>>();

// Type test: gte with bigint column
const gteBigIntQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) => gte(posts.userId, 100n));
type GteBigIntResult = Awaited<typeof gteBigIntQuery>;
Expect<Equal<GteBigIntResult, PostRows>>();

// ============================================================================
// lte() - Less Than or Equal Tests
// ============================================================================

// Type test: lte with number
const lteNumberQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => lte(users.id, 100n));
type LteNumberResult = Awaited<typeof lteNumberQuery>;
Expect<Equal<LteNumberResult, UserRows>>();

// Type test: lte with Date
const lteDateQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => lte(users.createdAt, new Date("2024-12-31")));
type LteDateResult = Awaited<typeof lteDateQuery>;
Expect<Equal<LteDateResult, UserRows>>();

// Type test: lte with bigint column
const lteBigIntQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) => lte(posts.userId, 1000n));
type LteBigIntResult = Awaited<typeof lteBigIntQuery>;
Expect<Equal<LteBigIntResult, PostRows>>();

// ============================================================================
// gt() - Greater Than Tests
// ============================================================================

// Type test: gt with number
const gtNumberQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => gt(users.id, 10n));
type GtNumberResult = Awaited<typeof gtNumberQuery>;
Expect<Equal<GtNumberResult, UserRows>>();

// Type test: gt with Date
const gtDateQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => gt(users.createdAt, new Date("2024-01-01")));
type GtDateResult = Awaited<typeof gtDateQuery>;
Expect<Equal<GtDateResult, UserRows>>();

// Type test: gt with bigint column
const gtBigIntQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) => gt(posts.userId, 100n));
type GtBigIntResult = Awaited<typeof gtBigIntQuery>;
Expect<Equal<GtBigIntResult, PostRows>>();

// ============================================================================
// lt() - Less Than Tests
// ============================================================================

// Type test: lt with number
const ltNumberQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => lt(users.id, 100n));
type LtNumberResult = Awaited<typeof ltNumberQuery>;
Expect<Equal<LtNumberResult, UserRows>>();

// Type test: lt with Date
const ltDateQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => lt(users.createdAt, new Date("2024-12-31")));
type LtDateResult = Awaited<typeof ltDateQuery>;
Expect<Equal<LtDateResult, UserRows>>();

// Type test: lt with bigint column
const ltBigIntQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) => lt(posts.userId, 1000n));
type LtBigIntResult = Awaited<typeof ltBigIntQuery>;
Expect<Equal<LtBigIntResult, PostRows>>();

// ============================================================================
// isNull() Tests
// ============================================================================

// Type test: isNull with nullable column
const isNullQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => isNull(users.email));
type IsNullResult = Awaited<typeof isNullQuery>;
Expect<Equal<IsNullResult, UserRows>>();

// Type test: isNull with nullable string column on Posts
const isNullPostsTitleQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) => isNull(posts.title));
type IsNullPostsTitleResult = Awaited<typeof isNullPostsTitleQuery>;
Expect<Equal<IsNullPostsTitleResult, PostRows>>();

// Type test: isNull with nullable content column
const isNullContentQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) => isNull(posts.content));
type IsNullContentResult = Awaited<typeof isNullContentQuery>;
Expect<Equal<IsNullContentResult, PostRows>>();

// ============================================================================
// isNotNull() Tests
// ============================================================================

// Type test: isNotNull with nullable column
const isNotNullQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => isNotNull(users.email));
type IsNotNullResult = Awaited<typeof isNotNullQuery>;
Expect<Equal<IsNotNullResult, UserRows>>();

// Type test: isNotNull with nullable string column on Posts
const isNotNullPostsTitleQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) => isNotNull(posts.title));
type IsNotNullPostsTitleResult = Awaited<typeof isNotNullPostsTitleQuery>;
Expect<Equal<IsNotNullPostsTitleResult, PostRows>>();

// Type test: isNotNull with nullable content column
const isNotNullContentQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) => isNotNull(posts.content));
type IsNotNullContentResult = Awaited<typeof isNotNullContentQuery>;
Expect<Equal<IsNotNullContentResult, PostRows>>();

// ============================================================================
// isIn() Tests
// ============================================================================

// Type test: isIn with array of numbers
const isInNumbersQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => isIn(users.id, [1n, 2n, 3n, 4n, 5n]));
type IsInNumbersResult = Awaited<typeof isInNumbersQuery>;
Expect<Equal<IsInNumbersResult, UserRows>>();

// Type test: isIn with array of strings
const isInStringsQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => isIn(users.username, ["alice", "bob", "charlie"]));
type IsInStringsResult = Awaited<typeof isInStringsQuery>;
Expect<Equal<IsInStringsResult, UserRows>>();

// Type test: isIn with array of enum values
const isInEnumQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => isIn(users.type, ["admin", "user"]));
type IsInEnumResult = Awaited<typeof isInEnumQuery>;
Expect<Equal<IsInEnumResult, UserRows>>();

// Type test: isIn with empty array
const isInEmptyQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => isIn(users.id, []));
type IsInEmptyResult = Awaited<typeof isInEmptyQuery>;
Expect<Equal<IsInEmptyResult, UserRows>>();

// Type test: isIn with subquery
const isInSubqueryQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) =>
    isIn(
      posts.userId,
      db.from(Users).select(({ users }) => ({ id: users.id })),
    ),
  );
type IsInSubqueryResult = Awaited<typeof isInSubqueryQuery>;
Expect<Equal<IsInSubqueryResult, PostRows>>();

// Type test: isIn in select projection
const isInSelectQuery = db.from(Users).select(({ users }) => ({
  id: users.id,
  isAdmin: isIn(users.type, ["admin"]),
}));
type IsInSelectResult = Awaited<typeof isInSelectQuery>;
Expect<Equal<IsInSelectResult, { id: bigint; isAdmin: boolean }[]>>();

// Type test: isIn with array of Arg inside prepare
const preparedIsInQuery = prepare(
  { id1: Users.id.arg(), id2: Users.id.arg() },
  (args) =>
    db
      .prepare()
      .from(Users)
      .select("*")
      .where(({ users }) => isIn(users.id, [args.id1, args.id2])),
);
type PreparedIsInResult = Awaited<ReturnType<typeof preparedIsInQuery.run>>;
Expect<Equal<PreparedIsInResult, UserRows>>();

// Type test: notIn with array of strings
const notInStringsQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => notIn(users.username, ["alice", "bob"]));
type NotInStringsResult = Awaited<typeof notInStringsQuery>;
Expect<Equal<NotInStringsResult, UserRows>>();

// Type test: notIn with subquery
const notInSubqueryQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) =>
    notIn(
      posts.userId,
      db.from(Users).select(({ users }) => ({ id: users.id })),
    ),
  );
type NotInSubqueryResult = Awaited<typeof notInSubqueryQuery>;
Expect<Equal<NotInSubqueryResult, PostRows>>();

// Type test: notIn in select projection
const notInSelectQuery = db.from(Users).select(({ users }) => ({
  id: users.id,
  notAdmin: notIn(users.type, ["admin"]),
}));
type NotInSelectResult = Awaited<typeof notInSelectQuery>;
Expect<Equal<NotInSelectResult, { id: bigint; notAdmin: boolean }[]>>();

// ============================================================================
// and() - Logical AND Tests
// ============================================================================

// Type test: and with two conditions
const andTwoQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => and(eq(users.type, "admin"), gte(users.id, 10n)));
type AndTwoResult = Awaited<typeof andTwoQuery>;
Expect<Equal<AndTwoResult, UserRows>>();

// Type test: and with three conditions
const andThreeQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    and(eq(users.type, "user"), gte(users.id, 1n), lte(users.id, 100n)),
  );
type AndThreeResult = Awaited<typeof andThreeQuery>;
Expect<Equal<AndThreeResult, UserRows>>();

// Type test: and with two eq conditions
const andMixedQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    and(eq(users.type, "admin"), eq(users.username, "admin")),
  );
type AndMixedResult = Awaited<typeof andMixedQuery>;
Expect<Equal<AndMixedResult, UserRows>>();

// Type test: and with isIn condition
const andIsInQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    and(isIn(users.id, [1n, 2n, 3n]), eq(users.type, "admin")),
  );
type AndIsInResult = Awaited<typeof andIsInQuery>;
Expect<Equal<AndIsInResult, UserRows>>();

// Type test: and with date comparison
const andDateQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    and(
      gte(users.createdAt, new Date("2024-01-01")),
      lte(users.createdAt, new Date("2024-12-31")),
    ),
  );
type AndDateResult = Awaited<typeof andDateQuery>;
Expect<Equal<AndDateResult, UserRows>>();

// ============================================================================
// or() - Logical OR Tests
// ============================================================================

// Type test: or with two conditions
const orTwoQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => or(eq(users.type, "admin"), eq(users.type, "user")));
type OrTwoResult = Awaited<typeof orTwoQuery>;
Expect<Equal<OrTwoResult, UserRows>>();

// Type test: or with three conditions
const orThreeQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    or(eq(users.id, 1n), eq(users.id, 2n), eq(users.id, 3n)),
  );
type OrThreeResult = Awaited<typeof orThreeQuery>;
Expect<Equal<OrThreeResult, UserRows>>();

// Type test: or with mixed condition types
const orMixedQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    or(eq(users.type, "admin"), isNull(users.email), lte(users.id, 5n)),
  );
type OrMixedResult = Awaited<typeof orMixedQuery>;
Expect<Equal<OrMixedResult, UserRows>>();

// Type test: or with gte and lte
const orRangeQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => or(lte(users.id, 10n), gte(users.id, 100n)));
type OrRangeResult = Awaited<typeof orRangeQuery>;
Expect<Equal<OrRangeResult, UserRows>>();

// Type test: or with isIn
const orIsInQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    or(isIn(users.id, [1n, 2n, 3n]), eq(users.type, "admin")),
  );
type OrIsInResult = Awaited<typeof orIsInQuery>;
Expect<Equal<OrIsInResult, UserRows>>();

// ============================================================================
// Combined and/or Conditions
// ============================================================================

// Type test: and with multiple eq conditions
const andMultipleEqQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    and(eq(users.type, "admin"), eq(users.username, "admin")),
  );
type AndMultipleEqResult = Awaited<typeof andMultipleEqQuery>;
Expect<Equal<AndMultipleEqResult, UserRows>>();

// Type test: or with two eq conditions
const orEqNeQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => or(eq(users.type, "admin"), eq(users.id, 1n)));
type OrEqNeResult = Awaited<typeof orEqNeQuery>;
Expect<Equal<OrEqNeResult, UserRows>>();

// Type test: and with gte and lte (range query)
const andRangeQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) => and(gte(posts.userId, 1n), lte(posts.userId, 100n)));
type AndRangeResult = Awaited<typeof andRangeQuery>;
Expect<Equal<AndRangeResult, PostRows>>();

// Type test: or with different comparison operators
const orComparisonsQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => or(lte(users.id, 10n), gte(users.id, 100n)));
type OrComparisonsResult = Awaited<typeof orComparisonsQuery>;
Expect<Equal<OrComparisonsResult, UserRows>>();

// ============================================================================
// Where with Different Tables
// ============================================================================

// Type test: where on Posts table
const postsWhereQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) => eq(posts.userId, 1n));
type PostsWhereResult = Awaited<typeof postsWhereQuery>;
Expect<Equal<PostsWhereResult, PostRows>>();

// Type test: where on Comments table
const commentsWhereQuery = db
  .from(Comments)
  .select("*")
  .where(({ comments }) => eq(comments.postId, 1n));
type CommentsWhereResult = Awaited<typeof commentsWhereQuery>;
Expect<Equal<CommentsWhereResult, CommentRows>>();

// Type test: where with multiple eq conditions on Comments
const commentsMultiWhereQuery = db
  .from(Comments)
  .select("*")
  .where(({ comments }) =>
    and(eq(comments.postId, 1n), eq(comments.userId, 2n)),
  );
type CommentsMultiWhereResult = Awaited<typeof commentsMultiWhereQuery>;
Expect<Equal<CommentsMultiWhereResult, CommentRows>>();

// ============================================================================
// Where with Select Specific Columns
// ============================================================================

// Type test: where with select specific columns
const selectWithWhereQuery = db
  .from(Users)
  .select(({ users }) => ({ id: users.id, username: users.username }))
  .where(({ users }) => eq(users.type, "admin"));
type SelectWithWhereResult = Awaited<typeof selectWithWhereQuery>;
Expect<Equal<SelectWithWhereResult, { id: bigint; username: string }[]>>();

// Type test: where with select and range conditions
const selectComplexWhereQuery = db
  .from(Users)
  .select(({ users }) => ({ id: users.id, email: users.email }))
  .where(({ users }) => and(gte(users.id, 10n), lte(users.id, 100n)));
type SelectComplexWhereResult = Awaited<typeof selectComplexWhereQuery>;
Expect<
  Equal<SelectComplexWhereResult, { id: bigint; email: string | null }[]>
>();

// Type test: where with select single column
const selectSingleWhereQuery = db
  .from(Users)
  .select(({ users }) => ({ username: users.username }))
  .where(({ users }) => eq(users.type, "user"));
type SelectSingleWhereResult = Awaited<typeof selectSingleWhereQuery>;
Expect<Equal<SelectSingleWhereResult, { username: string }[]>>();

// ============================================================================
// Edge Cases
// ============================================================================

// Type test: where with eq and isIn
const whereEqIsInQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    and(eq(users.type, "admin"), eq(users.username, "admin")),
  );
type WhereEqIsInResult = Awaited<typeof whereEqIsInQuery>;
Expect<Equal<WhereEqIsInResult, UserRows>>();

// Type test: where with multiple or conditions
const whereMultipleOrQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) =>
    or(eq(posts.id, 1n), eq(posts.id, 2n), eq(posts.id, 3n)),
  );
type WhereMultipleOrResult = Awaited<typeof whereMultipleOrQuery>;
Expect<Equal<WhereMultipleOrResult, PostRows>>();

// Type test: where with only or conditions
const whereOnlyOrQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    or(eq(users.id, 1n), eq(users.id, 2n), eq(users.id, 3n), eq(users.id, 4n)),
  );
type WhereOnlyOrResult = Awaited<typeof whereOnlyOrQuery>;
Expect<Equal<WhereOnlyOrResult, UserRows>>();

// Type test: where with and range conditions
const whereAndRangeQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) => and(gte(users.id, 1n), lte(users.id, 100n)));
type WhereAndRangeResult = Awaited<typeof whereAndRangeQuery>;
Expect<Equal<WhereAndRangeResult, UserRows>>();

// Type test: isNull with where
const isNullWithWhereQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) => isNull(posts.title));
type IsNullWithWhereResult = Awaited<typeof isNullWithWhereQuery>;
Expect<Equal<IsNullWithWhereResult, PostRows>>();

// Type test: isNotNull with where
const isNotNullWithWhereQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) => isNotNull(posts.content));
type IsNotNullWithWhereResult = Awaited<typeof isNotNullWithWhereQuery>;
Expect<Equal<IsNotNullWithWhereResult, PostRows>>();

// ============================================================================
// Nested and/or Clauses
// ============================================================================

// Type test: and with nested or - (admin OR user) AND id >= 10
const nestedAndWithOrQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    and(
      or(eq(users.type, "admin"), eq(users.type, "user")),
      gte(users.id, 10n),
    ),
  );
type NestedAndWithOrResult = Awaited<typeof nestedAndWithOrQuery>;
Expect<Equal<NestedAndWithOrResult, UserRows>>();

// Type test: or with nested and - (admin AND id >= 100) OR (user AND id <= 10)
const nestedOrWithAndQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    or(
      and(eq(users.type, "admin"), gte(users.id, 100n)),
      and(eq(users.type, "user"), lte(users.id, 10n)),
    ),
  );
type NestedOrWithAndResult = Awaited<typeof nestedOrWithAndQuery>;
Expect<Equal<NestedOrWithAndResult, UserRows>>();

// Type test: complex nested - (type=admin OR type=user) AND (id >= 50 OR id <= 10)
const complexNestedQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    and(
      or(eq(users.type, "admin"), eq(users.type, "user")),
      or(gte(users.id, 50n), lte(users.id, 10n)),
    ),
  );
type ComplexNestedResult = Awaited<typeof complexNestedQuery>;
Expect<Equal<ComplexNestedResult, UserRows>>();

// Type test: triple nested - (id in range1 OR id in range2) AND id > 0
const tripleNestedQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) =>
    and(
      or(
        and(gte(posts.userId, 1n), lte(posts.userId, 10n)),
        and(gte(posts.userId, 100n), lte(posts.userId, 200n)),
      ),
      gte(posts.id, 1n),
    ),
  );
type TripleNestedResult = Awaited<typeof tripleNestedQuery>;
Expect<Equal<TripleNestedResult, PostRows>>();

// Type test: nested with multiple conditions in and
const nestedMultipleAndQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    and(or(eq(users.type, "admin"), eq(users.id, 1n)), lte(users.id, 1000n)),
  );
type NestedMultipleAndResult = Awaited<typeof nestedMultipleAndQuery>;
Expect<Equal<NestedMultipleAndResult, UserRows>>();

// Type test: nested with multiple conditions in or
const nestedMultipleOrQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    or(
      and(eq(users.type, "admin"), gte(users.id, 100n)),
      eq(users.id, 1n),
      eq(users.id, 2n),
    ),
  );
type NestedMultipleOrResult = Awaited<typeof nestedMultipleOrQuery>;
Expect<Equal<NestedMultipleOrResult, UserRows>>();

// Type test: deeply nested with 4 levels - ((range1 OR range2) AND exists) OR special
const deeplyNestedQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) =>
    or(
      and(
        or(
          and(gte(posts.userId, 1n), lte(posts.userId, 10n)),
          and(gte(posts.userId, 100n), lte(posts.userId, 200n)),
        ),
        gte(posts.id, 1n),
      ),
      eq(posts.id, 999n),
    ),
  );
type DeeplyNestedResult = Awaited<typeof deeplyNestedQuery>;
Expect<Equal<DeeplyNestedResult, PostRows>>();

// Type test: nested with isIn
const nestedWithIsInQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    and(
      or(eq(users.type, "admin"), eq(users.type, "user")),
      isIn(users.id, [1n, 2n, 3n, 4n, 5n]),
    ),
  );
type NestedWithIsInResult = Awaited<typeof nestedWithIsInQuery>;
Expect<Equal<NestedWithIsInResult, UserRows>>();

// Type test: nested with select specific columns
const nestedWithSelectQuery = db
  .from(Users)
  .select(({ users }) => ({ id: users.id, type: users.type }))
  .where(({ users }) =>
    and(or(gte(users.id, 1n), lte(users.id, 100n)), eq(users.type, "admin")),
  );
type NestedWithSelectResult = Awaited<typeof nestedWithSelectQuery>;
Expect<
  Equal<NestedWithSelectResult, { id: bigint; type: "admin" | "user" }[]>
>();

// Type test: nested on Comments table
const nestedCommentsQuery = db
  .from(Comments)
  .select("*")
  .where(({ comments }) =>
    and(
      or(eq(comments.postId, 1n), eq(comments.postId, 2n)),
      or(eq(comments.userId, 1n), eq(comments.userId, 2n)),
    ),
  );
type NestedCommentsResult = Awaited<typeof nestedCommentsQuery>;
Expect<Equal<NestedCommentsResult, CommentRows>>();

// Type test: nested with date comparisons
const nestedWithDatesQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    and(
      or(
        gte(users.createdAt, new Date("2024-01-01")),
        lte(users.createdAt, new Date("2023-01-01")),
      ),
      eq(users.type, "admin"),
    ),
  );
type NestedWithDatesResult = Awaited<typeof nestedWithDatesQuery>;
Expect<Equal<NestedWithDatesResult, UserRows>>();

// Type test: symmetric nested - (eq OR eq) AND (eq OR eq)
const symmetricNestedQuery = db
  .from(Posts)
  .select("*")
  .where(({ posts }) =>
    and(
      or(eq(posts.userId, 1n), eq(posts.userId, 2n)),
      or(gte(posts.id, 10n), lte(posts.id, 5n)),
    ),
  );
type SymmetricNestedResult = Awaited<typeof symmetricNestedQuery>;
Expect<Equal<SymmetricNestedResult, PostRows>>();

// Type test: asymmetric nested - (eq AND eq) OR simple
const asymmetricNestedQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    or(
      and(eq(users.type, "admin"), gte(users.id, 10n)),
      eq(users.username, "superuser"),
    ),
  );
type AsymmetricNestedResult = Awaited<typeof asymmetricNestedQuery>;
Expect<Equal<AsymmetricNestedResult, UserRows>>();

// ============================================================================
// exists() & notExists() Tests
// ============================================================================

// Type test: exists in where clause with correlated subquery
const existsWhereQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    exists(
      db
        .from(Posts)
        .select("*")
        .where(({ posts }) => eq(posts.userId, users.id)),
    ),
  );
type ExistsWhereResult = Awaited<typeof existsWhereQuery>;
Expect<Equal<ExistsWhereResult, UserRows>>();

// Type test: notExists in where clause with correlated subquery
const notExistsWhereQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    notExists(
      db
        .from(Posts)
        .select("*")
        .where(({ posts }) => eq(posts.userId, users.id)),
    ),
  );
type NotExistsWhereResult = Awaited<typeof notExistsWhereQuery>;
Expect<Equal<NotExistsWhereResult, UserRows>>();

// Type test: exists in select projection
const existsSelectQuery = db.from(Users).select(({ users }) => ({
  id: users.id,
  hasPosts: exists(
    db
      .from(Posts)
      .select("*")
      .where(({ posts }) => eq(posts.userId, users.id)),
  ),
}));
type ExistsSelectResult = Awaited<typeof existsSelectQuery>;
Expect<Equal<ExistsSelectResult, { id: bigint; hasPosts: boolean }[]>>();

// Type test: notExists in select projection
const notExistsSelectQuery = db.from(Users).select(({ users }) => ({
  id: users.id,
  noPosts: notExists(
    db
      .from(Posts)
      .select("*")
      .where(({ posts }) => eq(posts.userId, users.id)),
  ),
}));
type NotExistsSelectResult = Awaited<typeof notExistsSelectQuery>;
Expect<Equal<NotExistsSelectResult, { id: bigint; noPosts: boolean }[]>>();

// Type test: exists combined with and()
const existsAndQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    and(
      eq(users.type, "admin"),
      exists(
        db
          .from(Posts)
          .select("*")
          .where(({ posts }) => eq(posts.userId, users.id)),
      ),
    ),
  );
type ExistsAndResult = Awaited<typeof existsAndQuery>;
Expect<Equal<ExistsAndResult, UserRows>>();

// Type test: exists combined with or()
const existsOrQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    or(
      eq(users.type, "admin"),
      notExists(
        db
          .from(Posts)
          .select("*")
          .where(({ posts }) => eq(posts.userId, users.id)),
      ),
    ),
  );
type ExistsOrResult = Awaited<typeof existsOrQuery>;
Expect<Equal<ExistsOrResult, UserRows>>();

// Type test: exists inside caseWhen
const existsCaseWhenQuery = db.from(Users).select(({ users }) => ({
  id: users.id,
  status: caseWhen(
    exists(
      db
        .from(Posts)
        .select("*")
        .where(({ posts }) => eq(posts.userId, users.id)),
    ),
    "active",
  ).else("inactive"),
}));
type ExistsCaseWhenResult = Awaited<typeof existsCaseWhenQuery>;
Expect<
  Equal<ExistsCaseWhenResult, { id: bigint; status: "active" | "inactive" }[]>
>();

// Type test: exists with raw Sql snippet
const existsRawSqlQuery = db
  .from(Users)
  .select("*")
  .where(({ users }) =>
    exists(sql`SELECT 1 FROM posts WHERE posts.user_id = ${users.id}`),
  );
type ExistsRawSqlResult = Awaited<typeof existsRawSqlQuery>;
Expect<Equal<ExistsRawSqlResult, UserRows>>();

// ============================================================================
// Negative type tests - these should cause compile errors
// ============================================================================

db.from(Users)
  .select("*")
  // @ts-expect-error - Wrong type for eq comparison should not compile
  .where(({ users }) => eq(users.id, "string_instead_of_number"));

db.from(Users)
  .select("*")
  // @ts-expect-error - Invalid enum value in eq should not compile
  .where(({ users }) => eq(users.type, "invalid_type"));

db.from(Users)
  .select("*")
  // @ts-expect-error - Comparing incompatible types should not compile
  .where(({ users }) => eq(users.username, 123));

db.from(Users)
  .select("*")
  // @ts-expect-error - Wrong type for gte comparison should not compile
  .where(({ users }) => gte(users.id, "not_a_number"));

db.from(Users)
  .select("*")
  // @ts-expect-error - Wrong type for gt comparison should not compile
  .where(({ users }) => gt(users.id, "not_a_number"));

db.from(Users)
  .select("*")
  // @ts-expect-error - Wrong type for lte comparison should not compile
  .where(({ users }) => lte(users.createdAt, "not_a_date"));

db.from(Users)
  .select("*")
  // @ts-expect-error - Wrong type for lt comparison should not compile
  .where(({ users }) => lt(users.createdAt, "not_a_date"));

db.from(Users)
  .select("*")
  // @ts-expect-error - isIn with wrong type array should not compile
  .where(({ users }) => isIn(users.id, ["a", "b", "c"]));

db.from(Users)
  .select("*")
  // @ts-expect-error - isIn with invalid enum values should not compile
  .where(({ users }) => isIn(users.type, ["admin", "invalid"]));

db.from(Users)
  .select("*")
  // @ts-expect-error - notIn with wrong type array should not compile
  .where(({ users }) => notIn(users.id, ["a", "b", "c"]));

db.from(Users)
  .select("*")
  // @ts-expect-error - Column from wrong table in where should not compile
  .where(({ users }) => eq(Posts.userId, 1));

db.from(Users)
  .select("*")
  // @ts-expect-error - ne with wrong type should not compile
  .where(({ users }) => ne(users.id, "not_a_number"));

db.from(Users)
  .select("*")
  .where(({ users }) => eq(users.id, users.username));

db.from(Users)
  .select("*")
  .where(
    // @ts-expect-error - Non-existent field in where should not compile
    ({ users }) => eq(users.nonExistentField, "value"),
  );

// Negative test: exists with invalid argument
db.from(Users)
  .select("*")
  // @ts-expect-error - exists expects a subquery or Sql, not a string
  .where(() => exists("invalid"));

// Negative test: notExists with invalid argument
db.from(Users)
  .select("*")
  // @ts-expect-error - notExists expects a subquery or Sql, not a number
  .where(() => notExists(123));

// Negative test: prepared subquery inside unprepared query
const preparedSubqueryForTest = db
  .prepare()
  .from(Posts)
  .select("*")
  .where(({ posts }) => eq(posts.userId, Arg.bigint()));

db.from(Users)
  .select("*")
  // @ts-expect-error - Prepared subquery carrying Arg cannot be used in unprepared query
  .where(() => exists(preparedSubqueryForTest));

db.from(Users)
  .select("*")
  // @ts-expect-error - isIn with array containing Arg cannot be used in unprepared query
  .where(({ users }) => isIn(users.id, [Arg.bigint()]));
