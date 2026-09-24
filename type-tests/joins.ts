import { asc, desc, eq, lower } from "durcno";
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

// ============================================================================
// POSITIVE TYPE TESTS - Single Inner Join
// ============================================================================

// Type test: simple inner join selecting columns from both tables
const usersWithProfileQuery = db
  .from(Users)
  .innerJoin(UserProfiles, () => eq(Users.id, UserProfiles.userId))
  .select(() => ({
    username: Users.username,
    bio: UserProfiles.bio,
  }));

type UsersWithProfile = Awaited<typeof usersWithProfileQuery>;
Expect<
  Equal<
    UsersWithProfile,
    {
      username: string;
      bio: string | null;
    }[]
  >
>();

// Type test: inner join with select all (default - selects from base table only)
const usersWithPostsAllQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
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

// Type test: inner join selecting from joined table
const usersWithPostsSelectPostsQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(() => ({
    postId: Posts.id,
    title: Posts.title,
    content: Posts.content,
  }));

type UsersWithPostsSelectPosts = Awaited<typeof usersWithPostsSelectPostsQuery>;
Expect<
  Equal<
    UsersWithPostsSelectPosts,
    {
      postId: bigint;
      title: string | null;
      content: string | null;
    }[]
  >
>();

// Type test: inner join with mixed columns from both tables
const mixedColumnsQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(() => ({
    userId: Users.id,
    username: Users.username,
    postId: Posts.id,
    postTitle: Posts.title,
    postCreatedAt: Posts.createdAt,
  }));

type MixedColumns = Awaited<typeof mixedColumnsQuery>;
Expect<
  Equal<
    MixedColumns,
    {
      userId: bigint;
      username: string;
      postId: bigint;
      postTitle: string | null;
      postCreatedAt: Date;
    }[]
  >
>();

// Type test: inner join with orderBy on columns from both tables
const joinOrderByQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(() => ({
    username: Users.username,
    title: Posts.title,
  }))
  .orderBy(() => [asc(Users.username), desc(Posts.createdAt)]);

type JoinOrderBy = Awaited<typeof joinOrderByQuery>;
Expect<Equal<JoinOrderBy, { username: string; title: string | null }[]>>();

// Type test: inner join with where clause on base table
const joinWithWhereBaseQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(() => ({
    username: Users.username,
    title: Posts.title,
  }))
  .where(() => eq(Users.type, "admin"));

type JoinWithWhereBase = Awaited<typeof joinWithWhereBaseQuery>;
Expect<
  Equal<JoinWithWhereBase, { username: string; title: string | null }[]>
>();

// Type test: inner join with where clause on joined table
const joinWithWhereJoinedQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(() => ({
    username: Users.username,
    title: Posts.title,
  }))
  .where(() => eq(Posts.title, "hello"));

type JoinWithWhereJoined = Awaited<typeof joinWithWhereJoinedQuery>;
Expect<
  Equal<JoinWithWhereJoined, { username: string; title: string | null }[]>
>();

// Type test: join Posts with Comments
const postsWithCommentsQuery = db
  .from(Posts)
  .innerJoin(Comments, () => eq(Posts.id, Comments.postId))
  .select(() => ({
    postTitle: Posts.title,
    commentBody: Comments.body,
    commentCreatedAt: Comments.createdAt,
  }));

type PostsWithComments = Awaited<typeof postsWithCommentsQuery>;
Expect<
  Equal<
    PostsWithComments,
    {
      postTitle: string | null;
      commentBody: string | null;
      commentCreatedAt: Date;
    }[]
  >
>();

// ============================================================================
// POSITIVE TYPE TESTS - Double Inner Join (Chained Joins)
// ============================================================================

// Type test: double inner join Users -> Posts -> Comments
const doubleJoinQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .innerJoin(Comments, () => eq(Posts.id, Comments.postId))
  .select(() => ({
    username: Users.username,
    postTitle: Posts.title,
    commentBody: Comments.body,
  }));
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

// Type test: double inner join with where clause referencing the middle table
const doubleJoinWithMiddleWhereQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .innerJoin(Comments, () => eq(Posts.id, Comments.postId))
  .select(() => ({
    username: Users.username,
    postTitle: Posts.title,
    commentBody: Comments.body,
  }))
  .where(() => eq(Posts.title, "foo"));

type DoubleJoinWithMiddleWhere = Awaited<typeof doubleJoinWithMiddleWhereQuery>;
Expect<
  Equal<
    DoubleJoinWithMiddleWhere,
    {
      username: string;
      postTitle: string | null;
      commentBody: string | null;
    }[]
  >
>();

// Type test: double inner join with columns from all three tables
const doubleJoinAllColumnsQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .innerJoin(Comments, () => eq(Posts.id, Comments.postId))
  .select(() => ({
    userId: Users.id,
    userType: Users.type,
    postId: Posts.id,
    postContent: Posts.content,
    commentId: Comments.id,
    commentBody: Comments.body,
  }));

type DoubleJoinAllColumns = Awaited<typeof doubleJoinAllColumnsQuery>;
Expect<
  Equal<
    DoubleJoinAllColumns,
    {
      userId: bigint;
      userType: "admin" | "user";
      postId: bigint;
      postContent: string | null;
      commentId: bigint;
      commentBody: string | null;
    }[]
  >
>();

// Type test: double inner join with orderBy on any table
const doubleJoinOrderByQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .innerJoin(Comments, () => eq(Posts.id, Comments.postId))
  .select(() => ({
    username: Users.username,
    postTitle: Posts.title,
    commentBody: Comments.body,
  }))
  .orderBy(() => [asc(Users.username), desc(Comments.createdAt)]);

type DoubleJoinOrderBy = Awaited<typeof doubleJoinOrderByQuery>;
Expect<
  Equal<
    DoubleJoinOrderBy,
    {
      username: string;
      postTitle: string | null;
      commentBody: string | null;
    }[]
  >
>();

// Type test: double inner join with where clause
const doubleJoinWithWhereQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .innerJoin(Comments, () => eq(Posts.id, Comments.postId))
  .select(() => ({
    username: Users.username,
    postTitle: Posts.title,
    commentBody: Comments.body,
  }))
  .where(() => eq(Users.type, "admin"));

type DoubleJoinWithWhere = Awaited<typeof doubleJoinWithWhereQuery>;
Expect<
  Equal<
    DoubleJoinWithWhere,
    {
      username: string;
      postTitle: string | null;
      commentBody: string | null;
    }[]
  >
>();

// Type test: double inner join with limit and offset
const doubleJoinPaginatedQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .innerJoin(Comments, () => eq(Posts.id, Comments.postId))
  .select(() => ({
    username: Users.username,
    postTitle: Posts.title,
  }))
  .limit(10)
  .offset(5);

type DoubleJoinPaginated = Awaited<typeof doubleJoinPaginatedQuery>;
Expect<
  Equal<
    DoubleJoinPaginated,
    {
      username: string;
      postTitle: string | null;
    }[]
  >
>();

// ============================================================================
// POSITIVE TYPE TESTS - Triple Inner Join
// ============================================================================

// Type test: triple inner join Users -> Posts -> Comments + UserProfiles
const tripleJoinQuery = db
  .from(Users)
  .innerJoin(UserProfiles, () => eq(Users.id, UserProfiles.userId))
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .innerJoin(Comments, () => eq(Posts.id, Comments.postId))
  .select(() => ({
    username: Users.username,
    bio: UserProfiles.bio,
    postTitle: Posts.title,
    commentBody: Comments.body,
  }));

type TripleJoin = Awaited<typeof tripleJoinQuery>;
Expect<
  Equal<
    TripleJoin,
    {
      username: string;
      bio: string | null;
      postTitle: string | null;
      commentBody: string | null;
    }[]
  >
>();

// ============================================================================
// POSITIVE TYPE TESTS - Join with Different Table Combinations
// ============================================================================

// Type test: Articles with Categories (nullable FK)
const articlesWithCategoriesQuery = db
  .from(Articles)
  .innerJoin(Categories, () => eq(Articles.categoryId, Categories.id))
  .select(() => ({
    articleTitle: Articles.title,
    categoryName: Categories.name,
  }));

type ArticlesWithCategories = Awaited<typeof articlesWithCategoriesQuery>;
Expect<
  Equal<
    ArticlesWithCategories,
    {
      articleTitle: string;
      categoryName: string;
    }[]
  >
>();

// Type test: Articles with author (Users)
const articlesWithAuthorQuery = db
  .from(Articles)
  .innerJoin(Users, () => eq(Articles.authorId, Users.id))
  .select(() => ({
    articleTitle: Articles.title,
    authorName: Users.username,
    authorEmail: Users.email,
  }));

type ArticlesWithAuthor = Awaited<typeof articlesWithAuthorQuery>;
Expect<
  Equal<
    ArticlesWithAuthor,
    {
      articleTitle: string;
      authorName: string;
      authorEmail: string | null;
    }[]
  >
>();

// ============================================================================
// NEGATIVE TYPE TESTS - These should cause compile errors
// ============================================================================

db.from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  // @ts-expect-error - Using wrong column in join condition (FK from unjoined table)
  .select(() => ({ commentBody: Comments.body }));

db.from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select("*")
  // @ts-expect-error - Wrong type in where clause after join
  .where(() => eq(Users.id, "not_a_number"));

db.from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .innerJoin(Comments, () => eq(Posts.id, Comments.postId))
  // @ts-expect-error - Selecting column from wrong table should not compile
  .select(() => ({ categoryName: Categories.name }));

db.from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select("*")
  // @ts-expect-error - where clause on column from unjoined table
  .where(() => eq(Comments.body, "test"));

db.from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select("*")
  // @ts-expect-error - Invalid enum value in where clause after join
  .where(() => eq(Users.type, "invalid_type"));

db.from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  // @ts-expect-error - Column from wrong table should not compile
  .select(() => ({
    username: Users.username,
    profileBio: UserProfiles.bio,
  }));

// ============================================================================
// POSITIVE TYPE TESTS - Single Left Join
// ============================================================================

// Type test: left join with callback select — notNull columns from left-joined table become nullable
const leftJoinExplicitQuery = db
  .from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({
    username: Users.username,
    postTitle: posts.title,
  }));

type LeftJoinExplicit = Awaited<typeof leftJoinExplicitQuery>;
Expect<
  Equal<
    LeftJoinExplicit,
    {
      username: string;
      postTitle: string | null;
    }[]
  >
>();

// Type test: left join with callback select — notNull column (userId) becomes nullable
const leftJoinNotNullQuery = db
  .from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({
    username: Users.username,
    postUserId: posts.userId,
    postCreatedAt: posts.createdAt,
    postId: posts.id,
  }));

type LeftJoinNotNull = Awaited<typeof leftJoinNotNullQuery>;
Expect<
  Equal<
    LeftJoinNotNull,
    {
      username: string;
      postUserId: bigint | null;
      postCreatedAt: Date | null;
      postId: bigint | null;
    }[]
  >
>();

// Type test: left join with select all — left-joined columns become nullable
const leftJoinSelectAllQuery = db
  .from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
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
      // Left-joined Post columns — all nullable
      userId: bigint | null;
      title: string | null;
      content: string | null;
      tags: string[] | null;
      metrics: { views: number; likes: number } | null;
    }[]
  >
>();

// Type test: left join with where clause on left-joined table
const leftJoinWithWhereQuery = db
  .from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({
    username: Users.username,
    postTitle: posts.title,
  }))
  .where(({ posts }) => eq(posts.title, "hello"));

type LeftJoinWithWhere = Awaited<typeof leftJoinWithWhereQuery>;
Expect<
  Equal<LeftJoinWithWhere, { username: string; postTitle: string | null }[]>
>();

// Type test: left join with orderBy on both tables
const leftJoinOrderByQuery = db
  .from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({
    username: Users.username,
    postTitle: posts.title,
  }))
  .orderBy(({ posts }) => [asc(Users.username), desc(posts.createdAt)]);

type LeftJoinOrderBy = Awaited<typeof leftJoinOrderByQuery>;
Expect<
  Equal<LeftJoinOrderBy, { username: string; postTitle: string | null }[]>
>();

// Type test: left join with enum column — enum column becomes nullable
const leftJoinEnumQuery = db
  .from(Posts)
  .leftJoin(Users, () => eq(Posts.userId, Users.id))
  .select(({ users }) => ({
    title: Posts.title,
    userType: users.type,
  }));

type LeftJoinEnum = Awaited<typeof leftJoinEnumQuery>;
Expect<
  Equal<
    LeftJoinEnum,
    {
      title: string | null;
      userType: "admin" | "user" | null;
    }[]
  >
>();

// Type test: left join with $type override column — preserves override and becomes nullable
const leftJoinTypeOverrideQuery = db
  .from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({
    username: Users.username,
    metrics: posts.metrics,
  }));

type LeftJoinTypeOverride = Awaited<typeof leftJoinTypeOverrideQuery>;
Expect<
  Equal<
    LeftJoinTypeOverride,
    {
      username: string;
      metrics: { views: number; likes: number } | null;
    }[]
  >
>();

// Type test: left join with $type override column in where clause
db.from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({ metrics: posts.metrics }))
  .where(({ posts }) => eq(posts.metrics, { views: 10, likes: 5 }));

// ============================================================================
// POSITIVE TYPE TESTS - Mixed Inner + Left Join
// ============================================================================

// Type test: inner join then left join — inner columns not nullable, left columns nullable
const mixedJoinQuery = db
  .from(Users)
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .leftJoin(Comments, () => eq(Posts.id, Comments.postId))
  .select("*");

type MixedJoin = Awaited<typeof mixedJoinQuery>;
Expect<
  Equal<
    MixedJoin,
    {
      // Users — base table, not nullable
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
      // Posts — inner join, not nullable
      userId: bigint;
      title: string | null;
      content: string | null;
      tags: string[] | null;
      metrics: { views: number; likes: number } | null;
      // Comments — left join, all nullable
      postId: bigint | null;
      body: string | null;
    }[]
  >
>();

// Type test: left join then inner join — left columns nullable, inner not
const leftThenInnerQuery = db
  .from(Users)
  .leftJoin(UserProfiles, () => eq(Users.id, UserProfiles.userId))
  .innerJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(({ userProfiles }) => ({
    username: Users.username,
    bio: userProfiles.bio,
    postTitle: Posts.title,
  }));

type LeftThenInner = Awaited<typeof leftThenInnerQuery>;
Expect<
  Equal<
    LeftThenInner,
    {
      username: string;
      bio: string | null;
      postTitle: string | null;
    }[]
  >
>();

// Type test: left join with SqlFn (e.g., lower, concat)
const leftJoinSqlFnQuery = db
  .from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({
    username: Users.username,
    lowerPostTitle: lower(posts.title),
  }));
type LeftJoinSqlFn = Awaited<typeof leftJoinSqlFnQuery>;
Expect<
  Equal<
    LeftJoinSqlFn,
    {
      username: string;
      lowerPostTitle: string | null;
    }[]
  >
>();

// Type test: left join then join on column from earlier left-joined table
const leftThenJoinOnLeftColQuery = db
  .from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  .innerJoin(Comments, ({ posts }) => eq(posts.id, Comments.postId))
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

// ============================================================================
// NEGATIVE TYPE TESTS - Left Join
// ============================================================================

db.from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  // @ts-expect-error - Using column from unjoined table
  .select(() => ({ commentBody: Comments.body }));

db.from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  .select("*")
  // @ts-expect-error - Wrong type in where clause after left join
  .where(() => eq(Users.id, "not_a_number"));

db.from(Users)
  .leftJoin(Posts, () => eq(Users.id, Posts.userId))
  .select(({ posts }) => ({ metrics: posts.metrics }))
  // @ts-expect-error - Mismatched $type override property in where should not compile
  .where(({ posts }) => eq(posts.metrics, { invalidKey: 123 }));
