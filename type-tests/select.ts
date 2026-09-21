import { and, asc, count, desc, eq, gt, gte, lower, sql, sum } from "durcno";
import { Comments, db, Posts, UserProfiles, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// Type test: select all columns
const allUsersQuery = db.from(Users).select("*");
type AllUsers = Awaited<typeof allUsersQuery>;
Expect<
  Equal<
    AllUsers,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    }[]
  >
>();

// Type test: select specific columns
const usernameOnlyQuery = db
  .from(Users)
  .select(({ users }) => ({ username: users.username }));
type UsernameOnly = Awaited<typeof usernameOnlyQuery>;
Expect<Equal<UsernameOnly, { username: string }[]>>();

// Type test: select multiple columns
const userIdAndEmailQuery = db
  .from(Users)
  .select(({ users }) => ({ id: users.id, email: users.email }));
type UserIdAndEmail = Awaited<typeof userIdAndEmailQuery>;
Expect<Equal<UserIdAndEmail, { id: bigint; email: string | null }[]>>();

// Type test: select with all fields false (should be empty object array)
const noneQuery = db.from(Users).select(() => ({}));
type None = Awaited<typeof noneQuery>;
Expect<Equal<None, Record<never, never>[]>>();

// Type test: select on Posts (includes array column)
const allPostsQuery = db.from(Posts).select("*");
type AllPosts = Awaited<typeof allPostsQuery>;
Expect<
  Equal<
    AllPosts,
    {
      id: bigint;
      userId: bigint;
      title: string | null;
      content: string | null;
      createdAt: Date;
      tags: string[] | null;
      metrics: { views: number; likes: number } | null;
    }[]
  >
>();

// Type test: select array column from Posts (nullable)
const tagsQuery = db
  .from(Posts)
  .select(({ posts }) => ({ id: posts.id, tags: posts.tags }));
type TagsResult = Awaited<typeof tagsQuery>;
Expect<Equal<TagsResult, { id: bigint; tags: string[] | null }[]>>();

// Type test: select on Comments, only body
const commentBodyQuery = db
  .from(Comments)
  .select(({ comments }) => ({ body: comments.body }));
type CommentBody = Awaited<typeof commentBodyQuery>;
Expect<Equal<CommentBody, { body: string | null }[]>>();

// Type test: select with where
const whereQuery = db
  .from(Users)
  .select(({ users }) => ({ email: users.email }))
  .where(({ users }) => eq(users.username, "ghost"));
type Where = Awaited<typeof whereQuery>;
Expect<Equal<Where, { email: string | null }[]>>();

// Type test: select with where and and
const whereAndQuery = db
  .from(Users)
  .select(({ users }) => ({ username: users.username }))
  .where(({ users }) =>
    and(eq(users.username, "ghost"), eq(users.email, "email@example.com")),
  );
type WhereAnd = Awaited<typeof whereAndQuery>;
Expect<Equal<WhereAnd, { username: string }[]>>();

// Type test: select with orderBy
const orderByQuery = db
  .from(Users)
  .select(({ users }) => ({ username: users.username }))
  .orderBy(({ users }) => asc(users.username));
type OrderBy = Awaited<typeof orderByQuery>;
Expect<Equal<OrderBy, { username: string }[]>>();

// Type test: select with multi-column orderBy (array syntax)
const multiOrderByQuery = db
  .from(Users)
  .select(({ users }) => ({
    username: users.username,
    createdAt: users.createdAt,
  }))
  .orderBy(({ users }) => [asc(users.username), desc(users.createdAt)]);
type MultiOrderBy = Awaited<typeof multiOrderByQuery>;
Expect<Equal<MultiOrderBy, { username: string; createdAt: Date }[]>>();

// Type test: select with limit
const limitQuery = db
  .from(Users)
  .select(({ users }) => ({ username: users.username }))
  .limit(10);
type Limit = Awaited<typeof limitQuery>;
Expect<Equal<Limit, { username: string }[]>>();

// Type test: select with offset
const offsetQuery = db
  .from(Users)
  .select(({ users }) => ({ username: users.username }))
  .limit(10)
  .offset(10);
type Offset = Awaited<typeof offsetQuery>;
Expect<Equal<Offset, { username: string }[]>>();

// ============================================================================
// Negative type tests - these should cause compile errors
// Negative type tests
// ============================================================================

db.from(Users).select(
  // @ts-expect-error - Property 'nonExistent' does not exist on table view
  ({ users }) => ({ postId: users.nonExistent }),
);

db.from(Users)
  .select("*")
  // @ts-expect-error - Wrong type in where condition should not compile
  .where(({ users }) => eq(users.id, "string_instead_of_number"));

db.from(Users)
  .select("*")
  // @ts-expect-error - Wrong enum value in where should not compile
  .where(({ users }) => eq(users.type, "invalid_type"));

db.from(Users)
  .select("*")
  // @ts-expect-error - Comparing incompatible types should not compile
  .where(({ users }) => eq(users.username, 123));

// Cannot use string where Buffer is expected for bytea
db.from(UserProfiles)
  .select("*")
  // @ts-expect-error - string not assignable to ByteaValType
  .where(({ userProfiles }) => eq(userProfiles.avatarData, "not-a-buffer"));

db.from(UserProfiles)
  .select("*")
  // @ts-expect-error - Cannot use number where Buffer is expected for bytea
  .where(({ userProfiles }) => eq(userProfiles.avatarData, 123));

// ============================================================================
// Negative type tests for network columns
// ============================================================================

import { NetworkDevices } from "./schema";

db.from(NetworkDevices)
  .select("*")
  // @ts-expect-error - Cannot use number for INET column (expects string)
  .where(({ network_devices }) => eq(network_devices.ipAddress, 123));

db.from(NetworkDevices)
  .select("*")
  // @ts-expect-error - Cannot use number for CIDR column (expects string)
  .where(({ network_devices }) => eq(network_devices.networkRange, 456));

db.from(NetworkDevices)
  .select("*")
  // @ts-expect-error - Cannot use number for MACADDR column (expects string)
  .where(({ network_devices }) => eq(network_devices.macAddress, 789));

// ============================================================================
// DISTINCT ON type tests
// ============================================================================

// Type test: distinctOn with a single column preserves return type
const distinctOnSingleQuery = db
  .from(Users)
  .distinctOn(({ users }) => users.username)
  .select("*");
type DistinctOnSingle = Awaited<typeof distinctOnSingleQuery>;
Expect<
  Equal<
    DistinctOnSingle,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    }[]
  >
>();

// Type test: distinctOn with an array of columns
const distinctOnMultiQuery = db
  .from(Users)
  .distinctOn(({ users }) => [users.type, users.username])
  .select(({ users }) => ({ username: users.username, type: users.type }));
type DistinctOnMulti = Awaited<typeof distinctOnMultiQuery>;
Expect<
  Equal<DistinctOnMulti, { username: string; type: "admin" | "user" }[]>
>();

// Type test: distinctOn chained with where and orderBy
const distinctOnChainedQuery = db
  .from(Users)
  .distinctOn(({ users }) => users.type)
  .select(({ users }) => ({ username: users.username }))
  .where(({ users }) => eq(users.type, "admin"))
  .orderBy(({ users }) => asc(users.type));
type DistinctOnChained = Awaited<typeof distinctOnChainedQuery>;
Expect<Equal<DistinctOnChained, { username: string }[]>>();

// Type test: distinctOn cannot be called twice (Omit removes it)
const _distinctOnOnce = db
  .from(Users)
  .distinctOn(({ users }) => users.username);
// @ts-expect-error - distinctOn should not be callable after already calling it
_distinctOnOnce.distinctOn(({ users }) => users.email);

// Type test: innerJoin cannot be called after distinctOn (Omit removes it)
const _distinctOnNoJoin = db
  .from(Users)
  .distinctOn(({ users }) => users.username);
// @ts-expect-error - innerJoin should not be callable after distinctOn
_distinctOnNoJoin.innerJoin(Posts, ({ users, posts }) =>
  eq(users.id, posts.userId),
);

// ============================================================================
// Negative DISTINCT ON type tests
// ============================================================================

db.from(Users)
  // @ts-expect-error - Cannot use columns from a different table in distinctOn
  .distinctOn(() => Posts.title)
  .select("*");

// ============================================================================
// Mixed aggregate + non-aggregate in select (auto GROUP BY)
// ============================================================================

// Type test: aggregate + plain column infers correct shape
const mixedColAggQuery = db
  .from(Users)
  .select(({ users }) => ({ type: users.type, total: count("*") }));
type MixedColAgg = Awaited<typeof mixedColAggQuery>;
Expect<Equal<MixedColAgg, { type: "admin" | "user"; total: number }[]>>();

// Type test: aggregate + scalar fn infers correct shape
const mixedFnAggQuery = db.from(Users).select(({ users }) => ({
  lowerEmail: lower(users.email),
  total: count("*"),
}));
type MixedFnAgg = Awaited<typeof mixedFnAggQuery>;
Expect<Equal<MixedFnAgg, { lowerEmail: string | null; total: number }[]>>();

// Type test: multiple aggregates + multiple plain columns
const multiMixedQuery = db.from(Users).select(({ users }) => ({
  type: users.type,
  username: users.username,
  total: count("*"),
  totalIds: sum(users.id),
}));
type MultiMixed = Awaited<typeof multiMixedQuery>;
Expect<
  Equal<
    MultiMixed,
    {
      type: "admin" | "user";
      username: string;
      total: number;
      totalIds: bigint | null;
    }[]
  >
>();

// Type test: pure aggregates only — no GROUP BY needed, shape is correct
const pureAggQuery = db.from(Users).select(({ users }) => ({
  total: count("*"),
  distinctUsers: count(users.id),
}));
type PureAgg = Awaited<typeof pureAggQuery>;
Expect<Equal<PureAgg, { total: number; distinctUsers: number }[]>>();

// Type test: pure columns + scalars only — no GROUP BY, shape is correct
const pureScalarQuery = db.from(Users).select(({ users }) => ({
  username: users.username,
  lowerEmail: lower(users.email),
}));
type PureScalar = Awaited<typeof pureScalarQuery>;
Expect<Equal<PureScalar, { username: string; lowerEmail: string | null }[]>>();

// ============================================================================
// GROUP BY type tests
// ============================================================================

// --- Positive tests: callback form ---

// single column
const _gbSingleCol = db
  .from(Users)
  .select(({ users }) => ({ type: users.type, total: count("*") }))
  .groupBy(({ users }) => users.type);

// array of columns
const _gbArrayCols = db
  .from(Users)
  .select(({ users }) => ({
    type: users.type,
    username: users.username,
    total: count("*"),
  }))
  .groupBy(({ users }) => [users.type, users.username]);

// scalar SqlFn expression
const _gbScalarFn = db
  .from(Users)
  .select(({ users }) => ({
    lname: lower(users.username),
    total: count("*"),
  }))
  .groupBy(({ users }) => lower(users.username));

// having — aggregate vs literal
const _havingLiteral = db
  .from(Users)
  .select(({ users }) => ({ type: users.type, total: count("*") }))
  .groupBy(({ users }) => users.type)
  .having(() => gte(count("*"), 5));

// having — aggregate vs aggregate
const _havingAgg = db
  .from(Users)
  .select(({ users }) => ({
    type: users.type,
    total: count("*"),
    sumId: sum(users.id),
  }))
  .groupBy(({ users }) => users.type)
  .having(() => gt(sum(Users.id), count("*")));

// chained groupBy + having
const _gbAndHaving = db
  .from(Users)
  .select(({ users }) => ({ type: users.type, total: count("*") }))
  .groupBy(({ users }) => users.type)
  .having(() => gte(count("*"), 2));

// callback with select aliases
const _gbCallbackSingle = db
  .from(Users)
  .select(({ users }) => ({ lname: lower(users.username) }))
  .groupBy((_view, { lname }) => [lname]);

// multiple aliases
const _gbCallbackMulti = db
  .from(Users)
  .select(({ users }) => ({
    lname: lower(users.username),
    type: users.type,
    total: count("*"),
  }))
  .groupBy((_view, { lname, type }) => [lname, type]);

// mixed alias + direct column
const _gbCallbackMixed = db
  .from(Users)
  .select(({ users }) => ({
    lname: lower(users.username),
    total: count("*"),
  }))
  .groupBy(({ users }, { lname }) => [lname, users.type]);

// --- Negative tests ---

// .groupBy() called twice should error (removed from type)
const _gbOnce = db
  .from(Users)
  .select(({ users }) => ({ type: users.type, total: count("*") }))
  .groupBy(({ users }) => users.type);
// @ts-expect-error - groupBy is removed after first call
_gbOnce.groupBy(({ users }) => users.type);

// .having() called twice should error (removed from type)
const _havingOnce = db
  .from(Users)
  .select(({ users }) => ({ type: users.type, total: count("*") }))
  .groupBy(({ users }) => users.type)
  .having(() => gte(count("*"), 1));
// @ts-expect-error - having is removed after first call
_havingOnce.having(() => gte(count("*"), 1));

// aggregate SqlFn as direct groupBy expression — @ts-expect-error (only scalar allowed)
db.from(Users)
  .select(({ users }) => ({ type: users.type, total: count("*") }))
  // @ts-expect-error - aggregate function not allowed in groupBy (only scalar)
  .groupBy(() => count("*"));

// callback form when no named select (select("*")) — @ts-expect-error
db.from(Users)
  .select("*")
  // @ts-expect-error - callback type is never without a named select
  .groupBy((_view: never, _selects: never) => [Users.type]);

// ============================================================================
// Null and literal projection type tests
// ============================================================================

const nullAndLiteralSelectQuery = db.from(Users).select(({ users }) => ({
  directNull: null,
  sqlNull: sql.null,
  rawStr: "hello",
  rawNum: 100,
  rawBool: true,
  lowerNull: lower(null),
  lowerUsername: lower(users.username),
  lowerEmail: lower(users.email),
}));
type NullAndLiteralSelect = Awaited<typeof nullAndLiteralSelectQuery>;
Expect<
  Equal<
    NullAndLiteralSelect,
    {
      directNull: null;
      sqlNull: null;
      rawStr: string;
      rawNum: number;
      rawBool: boolean;
      lowerNull: null;
      lowerUsername: string;
      lowerEmail: string | null;
    }[]
  >
>();
