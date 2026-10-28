import {
  and,
  asc,
  desc,
  eq,
  type InferSelect,
  type InferSelectModel,
  lower,
  sql,
} from "durcno";
import { db, NetworkDevices, Posts, UserProfiles, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// -----------------------------------------------------------------------------
// Select model inference
// -----------------------------------------------------------------------------

type UsersModel = InferSelect<typeof Users>;
Expect<Equal<InferSelectModel<typeof Users>, UsersModel>>();

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
Expect<Equal<UsersModel, AllUsers[number]>>();

// -----------------------------------------------------------------------------
// Projections
// -----------------------------------------------------------------------------

const userProjectionQuery = db
  .from(Users)
  .select(() => ({ id: Users.id, email: Users.email }));
type UserProjection = Awaited<typeof userProjectionQuery>;
Expect<Equal<UserProjection, { id: bigint; email: string | null }[]>>();

// An empty projection is an empty object
const noneQuery = db.from(Users).select(() => ({}));
type None = Awaited<typeof noneQuery>;
Expect<Equal<None, Record<never, never>[]>>();

// A table with array, JSON, and nullable columns keeps every type
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

db.from(Users).select(
  // @ts-expect-error - non-existent column in the projection
  ({ users }) => ({ postId: users.nonExistent }),
);

// -----------------------------------------------------------------------------
// Chaining
// -----------------------------------------------------------------------------

// where + and + multi-column orderBy + limit + offset preserve the projection
const chainedQuery = db
  .from(Users)
  .select(() => ({ username: Users.username, createdAt: Users.createdAt }))
  .where(() =>
    and(eq(Users.username, "ghost"), eq(Users.email, "email@example.com")),
  )
  .orderBy(() => [asc(Users.username), desc(Users.createdAt)])
  .limit(10)
  .offset(10);
type ChainedResult = Awaited<typeof chainedQuery>;
Expect<Equal<ChainedResult, { username: string; createdAt: Date }[]>>();

// -----------------------------------------------------------------------------
// Null and literal projections
// -----------------------------------------------------------------------------

const nullAndLiteralSelectQuery = db.from(Users).select(() => ({
  directNull: null,
  sqlNull: sql.null,
  rawStr: "hello",
  rawNum: 100,
  rawBool: true,
  lowerNull: lower(null),
  lowerUsername: lower(Users.username),
  lowerEmail: lower(Users.email),
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

// -----------------------------------------------------------------------------
// Column value constraints
// -----------------------------------------------------------------------------

db.from(UserProfiles)
  .select("*")
  // @ts-expect-error - bytea expects a Buffer, not a string
  .where(() => eq(UserProfiles.avatarData, "not-a-buffer"));

db.from(NetworkDevices)
  .select("*")
  // @ts-expect-error - network columns expect a string, not a number
  .where(() => eq(NetworkDevices.ipAddress, 123));

// -----------------------------------------------------------------------------
// DISTINCT ON
// -----------------------------------------------------------------------------

const _distinctOnSingle = db
  .from(Users)
  .distinctOn(() => Users.username)
  .select("*");
type DistinctOnSingle = Awaited<typeof _distinctOnSingle>;
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

const _distinctOnMulti = db
  .from(Users)
  .distinctOn(() => [Users.type, Users.username])
  .select(() => ({ username: Users.username, type: Users.type }));
type DistinctOnMulti = Awaited<typeof _distinctOnMulti>;
Expect<
  Equal<DistinctOnMulti, { username: string; type: "admin" | "user" }[]>
>();

const _distinctOnOnce = db.from(Users).distinctOn(() => Users.username);
// @ts-expect-error - distinctOn is removed after the first call
_distinctOnOnce.distinctOn(() => Users.email);

const _distinctOnNoJoin = db.from(Users).distinctOn(() => Users.username);
// @ts-expect-error - innerJoin is removed after distinctOn
_distinctOnNoJoin.innerJoin(Posts).on(() => eq(Users.id, Posts.userId));

db.from(Users)
  // @ts-expect-error - columns from another table
  .distinctOn(() => Posts.title)
  .select("*");
