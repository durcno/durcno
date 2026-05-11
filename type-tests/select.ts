import { and, asc, count, desc, eq, lower, sum } from "durcno";
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

// Type test: select uuid column from Users (notNull)
const uuidNotNullQuery = db
  .from(Users)
  .select({ externalId: Users.externalId });
type UuidNotNull = Awaited<typeof uuidNotNullQuery>;
Expect<Equal<UuidNotNull, { externalId: string }[]>>();

// Type test: select uuid column from Users (nullable)
const uuidNullableQuery = db
  .from(Users)
  .select({ trackingId: Users.trackingId });
type UuidNullable = Awaited<typeof uuidNullableQuery>;
Expect<Equal<UuidNullable, { trackingId: string | null }[]>>();

// Type test: select bytea column from UserProfiles (notNull)
const byteaNotNullQuery = db
  .from(UserProfiles)
  .select({ avatarData: UserProfiles.avatarData });
type ByteaNotNull = Awaited<typeof byteaNotNullQuery>;
Expect<Equal<ByteaNotNull, { avatarData: Buffer }[]>>();

// Type test: select bytea column from UserProfiles (nullable)
const byteaNullableQuery = db
  .from(UserProfiles)
  .select({ thumbnailData: UserProfiles.thumbnailData });
type ByteaNullable = Awaited<typeof byteaNullableQuery>;
Expect<Equal<ByteaNullable, { thumbnailData: Buffer | null }[]>>();

// Type test: select array column from UserProfiles (nullable skills)
const skillsQuery = db
  .from(UserProfiles)
  .select({ id: UserProfiles.id, skills: UserProfiles.skills });
type SkillsResult = Awaited<typeof skillsQuery>;
Expect<Equal<SkillsResult, { id: number; skills: string[] | null }[]>>();

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
// Network column type tests (INET, CIDR, MACADDR)
// ============================================================================

import { NetworkDevices } from "./schema";

// Type test: select all network columns (includes array column)
const allNetworkDevicesQuery = db.from(NetworkDevices).select();
type AllNetworkDevices = Awaited<typeof allNetworkDevicesQuery>;
Expect<
  Equal<
    AllNetworkDevices,
    {
      id: bigint;
      name: string;
      ipAddress: string;
      secondaryIp: string | null;
      networkRange: string;
      allowedNetwork: string | null;
      macAddress: string;
      backupMac: string | null;
      allowedIps: string[] | null;
    }[]
  >
>();

// Type test: select array column from NetworkDevices (allowedIps)
const allowedIpsQuery = db
  .from(NetworkDevices)
  .select({ id: NetworkDevices.id, allowedIps: NetworkDevices.allowedIps });
type AllowedIpsResult = Awaited<typeof allowedIpsQuery>;
Expect<
  Equal<AllowedIpsResult, { id: bigint; allowedIps: string[] | null }[]>
>();

// Type test: select INET column (notNull)
const inetNotNullQuery = db
  .from(NetworkDevices)
  .select({ ipAddress: NetworkDevices.ipAddress });
type InetNotNull = Awaited<typeof inetNotNullQuery>;
Expect<Equal<InetNotNull, { ipAddress: string }[]>>();

// Type test: select INET column (nullable)
const inetNullableQuery = db
  .from(NetworkDevices)
  .select({ secondaryIp: NetworkDevices.secondaryIp });
type InetNullable = Awaited<typeof inetNullableQuery>;
Expect<Equal<InetNullable, { secondaryIp: string | null }[]>>();

// Type test: select CIDR column (notNull)
const cidrNotNullQuery = db
  .from(NetworkDevices)
  .select({ networkRange: NetworkDevices.networkRange });
type CidrNotNull = Awaited<typeof cidrNotNullQuery>;
Expect<Equal<CidrNotNull, { networkRange: string }[]>>();

// Type test: select CIDR column (nullable)
const cidrNullableQuery = db
  .from(NetworkDevices)
  .select({ allowedNetwork: NetworkDevices.allowedNetwork });
type CidrNullable = Awaited<typeof cidrNullableQuery>;
Expect<Equal<CidrNullable, { allowedNetwork: string | null }[]>>();

// Type test: select MACADDR column (notNull)
const macaddrNotNullQuery = db
  .from(NetworkDevices)
  .select({ macAddress: NetworkDevices.macAddress });
type MacaddrNotNull = Awaited<typeof macaddrNotNullQuery>;
Expect<Equal<MacaddrNotNull, { macAddress: string }[]>>();

// Type test: select MACADDR column (nullable)
const macaddrNullableQuery = db
  .from(NetworkDevices)
  .select({ backupMac: NetworkDevices.backupMac });
type MacaddrNullable = Awaited<typeof macaddrNullableQuery>;
Expect<Equal<MacaddrNullable, { backupMac: string | null }[]>>();

// ============================================================================
// Negative type tests for network columns
// ============================================================================

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
      totalIds: number | null;
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
