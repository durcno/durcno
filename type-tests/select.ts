import { and, asc, count, desc, eq, gt, gte, lower, sum } from "durcno";
import { Comments, db, Posts, UserProfiles, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// Type test: select all columns
const allUsersQuery = db.from(Users).select();
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
const usernameOnlyQuery = db.from(Users).select({ username: Users.username });
type UsernameOnly = Awaited<typeof usernameOnlyQuery>;
Expect<Equal<UsernameOnly, { username: string }[]>>();

// Type test: select multiple columns
const userIdAndEmailQuery = db
  .from(Users)
  .select({ id: Users.id, email: Users.email });
type UserIdAndEmail = Awaited<typeof userIdAndEmailQuery>;
Expect<Equal<UserIdAndEmail, { id: bigint; email: string | null }[]>>();

// Type test: select with all fields false (should be empty object array)
const noneQuery = db.from(Users).select({});
type None = Awaited<typeof noneQuery>;
Expect<Equal<None, Record<never, never>[]>>();

// Type test: select on Posts (includes array column)
const allPostsQuery = db.from(Posts).select();
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
const tagsQuery = db.from(Posts).select({ id: Posts.id, tags: Posts.tags });
type TagsResult = Awaited<typeof tagsQuery>;
Expect<Equal<TagsResult, { id: bigint; tags: string[] | null }[]>>();

// Type test: select on Comments, only body
const commentBodyQuery = db.from(Comments).select({ body: Comments.body });
type CommentBody = Awaited<typeof commentBodyQuery>;
Expect<Equal<CommentBody, { body: string | null }[]>>();

// Type test: select with where
const whereQuery = db
  .from(Users)
  .select({ email: Users.email })
  .where(eq(Users.username, "ghost"));
type Where = Awaited<typeof whereQuery>;
Expect<Equal<Where, { email: string | null }[]>>();

// Type test: select with where and and
const whereAndQuery = db
  .from(Users)
  .select({ username: Users.username })
  .where(
    and(eq(Users.username, "ghost"), eq(Users.email, "email@example.com")),
  );
type WhereAnd = Awaited<typeof whereAndQuery>;
Expect<Equal<WhereAnd, { username: string }[]>>();

// Type test: select with orderBy
const orderByQuery = db
  .from(Users)
  .select({ username: Users.username })
  .orderBy(asc(Users.username));
type OrderBy = Awaited<typeof orderByQuery>;
Expect<Equal<OrderBy, { username: string }[]>>();

// Type test: select with multi-column orderBy (array syntax)
const multiOrderByQuery = db
  .from(Users)
  .select({ username: Users.username, createdAt: Users.createdAt })
  .orderBy([asc(Users.username), desc(Users.createdAt)]);
type MultiOrderBy = Awaited<typeof multiOrderByQuery>;
Expect<Equal<MultiOrderBy, { username: string; createdAt: Date }[]>>();

// Type test: select with limit
const limitQuery = db
  .from(Users)
  .select({ username: Users.username })
  .limit(10);
type Limit = Awaited<typeof limitQuery>;
Expect<Equal<Limit, { username: string }[]>>();

// Type test: select with offset
const offsetQuery = db
  .from(Users)
  .select({ username: Users.username })
  .limit(10)
  .offset(10);
type Offset = Awaited<typeof offsetQuery>;
Expect<Equal<Offset, { username: string }[]>>();

// ============================================================================
// Negative type tests - these should cause compile errors
// ============================================================================

// @ts-expect-error
db.from(Users).select({ postId: Posts.id });

// @ts-expect-error - Wrong type in where condition should not compile
db.from(Users).select().where(eq(Users.id, "string_instead_of_number"));

// @ts-expect-error - Invalid column reference should not compile
db.from(Users).select({ nonExistent: Users.nonExistentField });

// @ts-expect-error - Wrong enum value in where should not compile
db.from(Users).select().where(eq(Users.type, "invalid_type"));

// @ts-expect-error - Comparing incompatible types should not compile
db.from(Users).select().where(eq(Users.username, 123));

// @ts-expect-error
db.from(Users).select().orderBy(asc(Posts.createdAt));

// Cannot use string where Buffer is expected for bytea
db.from(UserProfiles)
  .select()
  // @ts-expect-error - string not assignable to ByteaValType
  .where(eq(UserProfiles.avatarData, "not-a-buffer"));

// @ts-expect-error - Cannot use number where Buffer is expected for bytea
db.from(UserProfiles).select().where(eq(UserProfiles.avatarData, 123));

// ============================================================================
// Negative type tests for network columns
// ============================================================================

import { NetworkDevices } from "./schema";

// @ts-expect-error - Cannot use number for INET column (expects string)
db.from(NetworkDevices).select().where(eq(NetworkDevices.ipAddress, 123));

// @ts-expect-error - Cannot use number for CIDR column (expects string)
db.from(NetworkDevices).select().where(eq(NetworkDevices.networkRange, 456));

// @ts-expect-error - Cannot use number for MACADDR column (expects string)
db.from(NetworkDevices).select().where(eq(NetworkDevices.macAddress, 789));

// ============================================================================
// DISTINCT ON type tests
// ============================================================================

// Type test: distinctOn with a single column preserves return type
const distinctOnSingleQuery = db
  .from(Users)
  .distinctOn(Users.username)
  .select();
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
  .distinctOn([Users.type, Users.username])
  .select({ username: Users.username, type: Users.type });
type DistinctOnMulti = Awaited<typeof distinctOnMultiQuery>;
Expect<
  Equal<DistinctOnMulti, { username: string; type: "admin" | "user" }[]>
>();

// Type test: distinctOn chained with where and orderBy
const distinctOnChainedQuery = db
  .from(Users)
  .distinctOn(Users.type)
  .select({ username: Users.username })
  .where(eq(Users.type, "admin"))
  .orderBy(asc(Users.type));
type DistinctOnChained = Awaited<typeof distinctOnChainedQuery>;
Expect<Equal<DistinctOnChained, { username: string }[]>>();

// Type test: distinctOn cannot be called twice (Omit removes it)
const _distinctOnOnce = db.from(Users).distinctOn(Users.username);
// @ts-expect-error - distinctOn should not be callable after already calling it
_distinctOnOnce.distinctOn(Users.email);

// Type test: innerJoin cannot be called after distinctOn (Omit removes it)
const _distinctOnNoJoin = db.from(Users).distinctOn(Users.username);
// @ts-expect-error - innerJoin should not be callable after distinctOn
_distinctOnNoJoin.innerJoin(Posts, eq(Users.id, Posts.userId));

// ============================================================================
// Negative DISTINCT ON type tests
// ============================================================================

// @ts-expect-error - Cannot use columns from a different table in distinctOn
db.from(Users).distinctOn(Posts.title).select();

// ============================================================================
// Mixed aggregate + non-aggregate in select (auto GROUP BY)
// ============================================================================

// Type test: aggregate + plain column infers correct shape
const mixedColAggQuery = db
  .from(Users)
  .select({ type: Users.type, total: count("*") });
type MixedColAgg = Awaited<typeof mixedColAggQuery>;
Expect<Equal<MixedColAgg, { type: "admin" | "user"; total: number }[]>>();

// Type test: aggregate + scalar fn infers correct shape
const mixedFnAggQuery = db
  .from(Users)
  .select({ lowerEmail: lower(Users.email), total: count("*") });
type MixedFnAgg = Awaited<typeof mixedFnAggQuery>;
Expect<Equal<MixedFnAgg, { lowerEmail: string; total: number }[]>>();

// Type test: multiple aggregates + multiple plain columns
const multiMixedQuery = db.from(Users).select({
  type: Users.type,
  username: Users.username,
  total: count("*"),
  totalIds: sum(Users.id),
});
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
const pureAggQuery = db
  .from(Users)
  .select({ total: count("*"), distinctUsers: count(Users.id) });
type PureAgg = Awaited<typeof pureAggQuery>;
Expect<Equal<PureAgg, { total: number; distinctUsers: number }[]>>();

// Type test: pure columns + scalars only — no GROUP BY, shape is correct
const pureScalarQuery = db
  .from(Users)
  .select({ username: Users.username, lowerEmail: lower(Users.email) });
type PureScalar = Awaited<typeof pureScalarQuery>;
Expect<Equal<PureScalar, { username: string; lowerEmail: string }[]>>();

// ============================================================================
// GROUP BY type tests
// ============================================================================

// --- Positive tests: direct form ---

// single column
const _gbSingleCol = db
  .from(Users)
  .select({ type: Users.type, total: count("*") })
  .groupBy(Users.type);

// array of columns
const _gbArrayCols = db
  .from(Users)
  .select({ type: Users.type, username: Users.username, total: count("*") })
  .groupBy([Users.type, Users.username]);

// scalar SqlFn expression
const _gbScalarFn = db
  .from(Users)
  .select({ lname: lower(Users.username), total: count("*") })
  .groupBy(lower(Users.username));

// having — aggregate vs literal
const _havingLiteral = db
  .from(Users)
  .select({ type: Users.type, total: count("*") })
  .groupBy(Users.type)
  .having(gte(count("*"), 5));

// having — aggregate vs aggregate
const _havingAgg = db
  .from(Users)
  .select({ type: Users.type, total: count("*"), sumId: sum(Users.id) })
  .groupBy(Users.type)
  .having(gt(sum(Users.id), count("*")));

// chained groupBy + having
const _gbAndHaving = db
  .from(Users)
  .select({ type: Users.type, total: count("*") })
  .groupBy(Users.type)
  .having(gte(count("*"), 2));

// --- Positive tests: callback form ---

// single alias
const _gbCallbackSingle = db
  .from(Users)
  .select({ lname: lower(Users.username) })
  .groupBy(({ lname }) => [lname]);

// multiple aliases
const _gbCallbackMulti = db
  .from(Users)
  .select({ lname: lower(Users.username), type: Users.type, total: count("*") })
  .groupBy(({ lname, type }) => [lname, type]);

// mixed alias + direct column from outer scope
const _gbCallbackMixed = db
  .from(Users)
  .select({ lname: lower(Users.username), total: count("*") })
  .groupBy(({ lname }) => [lname, Users.type]);

// --- Negative tests ---

// .groupBy() called twice should error (removed from type)
const _gbOnce = db
  .from(Users)
  .select({ type: Users.type, total: count("*") })
  .groupBy(Users.type);
// @ts-expect-error - groupBy is removed after first call
_gbOnce.groupBy(Users.type);

// .having() called twice should error (removed from type)
const _havingOnce = db
  .from(Users)
  .select({ type: Users.type, total: count("*") })
  .groupBy(Users.type)
  .having(gte(count("*"), 1));
// @ts-expect-error - having is removed after first call
_havingOnce.having(gte(count("*"), 1));

// column from a different (unrelated) table — @ts-expect-error
db.from(Users)
  .select({ type: Users.type, total: count("*") })
  // @ts-expect-error - Posts.id is not a Users column
  .groupBy(Posts.id);

// aggregate SqlFn as direct groupBy expression — @ts-expect-error (only scalar allowed)
db.from(Users)
  .select({ type: Users.type, total: count("*") })
  // @ts-expect-error - aggregate function not allowed in groupBy (only scalar)
  .groupBy(count("*"));

// callback form when no named select (select() with no arg) — @ts-expect-error
db.from(Users)
  .select()
  // @ts-expect-error - callback type is never without a named select
  .groupBy((_selects: never) => [Users.type]);
