import { and, asc, desc, eq, lower } from "durcno";
import {
  Articles,
  Categories,
  Comments,
  db,
  Posts,
  UserProfiles,
  Users,
} from "./schema";
import { type Equal, Expect } from "./utils";

// -----------------------------------------------------------------------------
// Inner join
// -----------------------------------------------------------------------------

const usersWithProfileQuery = db
  .from(Users)
  .innerJoin(UserProfiles)
  .on(() => eq(Users.id, UserProfiles.userId))
  .select(() => ({
    username: Users.username,
    bio: UserProfiles.bio,
  }));
type UsersWithProfile = Awaited<typeof usersWithProfileQuery>;
Expect<Equal<UsersWithProfile, { username: string; bio: string | null }[]>>();

// select("*") includes the joined table's columns
const usersWithPostsAllQuery = db
  .from(Users)
  .innerJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .select("*");
type UsersWithPostsAll = Awaited<typeof usersWithPostsAllQuery>;
Expect<
  Equal<
    UsersWithPostsAll,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
      userId: bigint;
      title: string | null;
      content: string | null;
      tags: string[] | null;
      metrics: { views: number; likes: number } | null;
    }[]
  >
>();

// Columns from both tables, filtering both, and ordering both
const mixedJoinQuery = db
  .from(Users)
  .innerJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .select(() => ({
    userId: Users.id,
    username: Users.username,
    postId: Posts.id,
    postTitle: Posts.title,
    postCreatedAt: Posts.createdAt,
  }))
  .where(() => and(eq(Users.type, "admin"), eq(Posts.title, "hello")))
  .orderBy(() => [asc(Users.username), desc(Posts.createdAt)]);
type MixedJoin = Awaited<typeof mixedJoinQuery>;
Expect<
  Equal<
    MixedJoin,
    {
      userId: bigint;
      username: string;
      postId: bigint;
      postTitle: string | null;
      postCreatedAt: Date;
    }[]
  >
>();

db.from(Users)
  .innerJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  // @ts-expect-error - column from an unjoined table
  .select(() => ({ commentBody: Comments.body }));

db.from(Users)
  .innerJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .select("*")
  // @ts-expect-error - wrong value type in the where clause
  .where(() => eq(Users.id, "not_a_number"));

// -----------------------------------------------------------------------------
// Chained inner joins
// -----------------------------------------------------------------------------

const doubleJoinQuery = db
  .from(Users)
  .innerJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .innerJoin(Comments)
  .on(() => eq(Posts.id, Comments.postId))
  .select(() => ({
    username: Users.username,
    postTitle: Posts.title,
    commentBody: Comments.body,
  }))
  .where(() => eq(Posts.title, "foo"))
  .orderBy(() => [asc(Users.username), desc(Comments.createdAt)])
  .limit(10)
  .offset(5);
type DoubleJoin = Awaited<typeof doubleJoinQuery>;
Expect<
  Equal<
    DoubleJoin,
    {
      username: string;
      postTitle: string | null;
      commentBody: string | null;
    }[]
  >
>();

// A nullable FK column joins the same way
const articlesWithCategoriesQuery = db
  .from(Articles)
  .innerJoin(Categories)
  .on(() => eq(Articles.categoryId, Categories.id))
  .select(() => ({
    articleTitle: Articles.title,
    categoryName: Categories.name,
  }));
type ArticlesWithCategories = Awaited<typeof articlesWithCategoriesQuery>;
Expect<
  Equal<
    ArticlesWithCategories,
    { articleTitle: string; categoryName: string }[]
  >
>();

// -----------------------------------------------------------------------------
// Left join
// -----------------------------------------------------------------------------

// Every column of a left-joined table becomes nullable
const leftJoinQuery = db
  .from(Users)
  .leftJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({
    username: Users.username,
    postTitle: posts.title,
    postUserId: posts.userId,
    metrics: posts.metrics,
  }))
  .where(({ posts }) => eq(posts.title, "hello"))
  .orderBy(({ posts }) => [asc(Users.username), desc(posts.createdAt)]);
type LeftJoin = Awaited<typeof leftJoinQuery>;
Expect<
  Equal<
    LeftJoin,
    {
      username: string;
      postTitle: string | null;
      postUserId: bigint | null;
      metrics: { views: number; likes: number } | null;
    }[]
  >
>();

// select("*") promotes the same way
const leftJoinSelectAllQuery = db
  .from(Users)
  .leftJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .select("*");
type LeftJoinSelectAll = Awaited<typeof leftJoinSelectAllQuery>;
Expect<
  Equal<
    LeftJoinSelectAll,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
      userId: bigint | null;
      title: string | null;
      content: string | null;
      tags: string[] | null;
      metrics: { views: number; likes: number } | null;
    }[]
  >
>();

// A composite join key wrapped in and()
const andJoinQuery = db
  .from(Comments)
  .leftJoin(Posts)
  .on(() =>
    and(eq(Comments.postId, Posts.id), eq(Comments.userId, Posts.userId)),
  )
  .select(({ posts }) => ({ title: posts.title }));
type AndJoin = Awaited<typeof andJoinQuery>;
Expect<Equal<AndJoin, { title: string | null }[]>>();

// Scalar functions over left-joined columns stay nullable
const leftJoinSqlFnQuery = db
  .from(Users)
  .leftJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({
    username: Users.username,
    lowerPostTitle: lower(posts.title),
  }));
type LeftJoinSqlFn = Awaited<typeof leftJoinSqlFnQuery>;
Expect<
  Equal<LeftJoinSqlFn, { username: string; lowerPostTitle: string | null }[]>
>();

db.from(Users)
  .leftJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({ metrics: posts.metrics }))
  // @ts-expect-error - mismatched `$type` override property in where
  .where(({ posts }) => eq(posts.metrics, { invalidKey: 123 }));

// -----------------------------------------------------------------------------
// Mixed inner and left joins
// -----------------------------------------------------------------------------

// Inner-joined columns stay non-null; left-joined columns become nullable
const mixedJoinTypesQuery = db
  .from(Users)
  .innerJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .leftJoin(Comments)
  .on(() => eq(Posts.id, Comments.postId))
  .select("*");
type MixedJoinTypes = Awaited<typeof mixedJoinTypesQuery>;
Expect<
  Equal<
    MixedJoinTypes,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
      userId: bigint;
      title: string | null;
      content: string | null;
      tags: string[] | null;
      metrics: { views: number; likes: number } | null;
      postId: bigint | null;
      body: string | null;
    }[]
  >
>();

// A later join can reference a column from an earlier left-joined table
const leftThenJoinOnLeftColQuery = db
  .from(Users)
  .leftJoin(Posts)
  .on(() => eq(Users.id, Posts.userId))
  .innerJoin(Comments)
  .on(({ posts }) => eq(posts.id, Comments.postId))
  .select(({ posts }) => ({
    username: Users.username,
    postTitle: posts.title,
    commentBody: Comments.body,
  }));
type LeftThenJoinOnLeftCol = Awaited<typeof leftThenJoinOnLeftColQuery>;
Expect<
  Equal<
    LeftThenJoinOnLeftCol,
    {
      username: string;
      postTitle: string | null;
      commentBody: string | null;
    }[]
  >
>();
