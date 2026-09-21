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
  .innerJoin(UserProfiles, ({ users, userProfiles }) =>
    eq(users.id, userProfiles.userId),
  )
  .select(({ users, userProfiles }) => ({
    username: users.username,
    bio: userProfiles.bio,
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
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
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
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ posts }) => ({
    postId: posts.id,
    title: posts.title,
    content: posts.content,
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
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    userId: users.id,
    username: users.username,
    postId: posts.id,
    postTitle: posts.title,
    postCreatedAt: posts.createdAt,
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
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    username: users.username,
    title: posts.title,
  }))
  .orderBy(({ users, posts }) => [asc(users.username), desc(posts.createdAt)]);

type JoinOrderBy = Awaited<typeof joinOrderByQuery>;
Expect<Equal<JoinOrderBy, { username: string; title: string | null }[]>>();

// Type test: inner join with where clause on base table
const joinWithWhereBaseQuery = db
  .from(Users)
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    username: users.username,
    title: posts.title,
  }))
  .where(({ users }) => eq(users.type, "admin"));

type JoinWithWhereBase = Awaited<typeof joinWithWhereBaseQuery>;
Expect<
  Equal<JoinWithWhereBase, { username: string; title: string | null }[]>
>();

// Type test: inner join with where clause on joined table
const joinWithWhereJoinedQuery = db
  .from(Users)
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    username: users.username,
    title: posts.title,
  }))
  .where(({ posts }) => eq(posts.title, "hello"));

type JoinWithWhereJoined = Awaited<typeof joinWithWhereJoinedQuery>;
Expect<
  Equal<JoinWithWhereJoined, { username: string; title: string | null }[]>
>();

// Type test: join Posts with Comments
const postsWithCommentsQuery = db
  .from(Posts)
  .innerJoin(Comments, ({ posts, comments }) => eq(posts.id, comments.postId))
  .select(({ posts, comments }) => ({
    postTitle: posts.title,
    commentBody: comments.body,
    commentCreatedAt: comments.createdAt,
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
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .innerJoin(Comments, ({ posts, comments }) => eq(posts.id, comments.postId))
  .select(({ users, posts, comments }) => ({
    username: users.username,
    postTitle: posts.title,
    commentBody: comments.body,
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
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .innerJoin(Comments, ({ posts, comments }) => eq(posts.id, comments.postId))
  .select(({ users, posts, comments }) => ({
    username: users.username,
    postTitle: posts.title,
    commentBody: comments.body,
  }))
  .where(({ posts }) => eq(posts.title, "foo"));

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
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .innerJoin(Comments, ({ posts, comments }) => eq(posts.id, comments.postId))
  .select(({ users, posts, comments }) => ({
    userId: users.id,
    userType: users.type,
    postId: posts.id,
    postContent: posts.content,
    commentId: comments.id,
    commentBody: comments.body,
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
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .innerJoin(Comments, ({ posts, comments }) => eq(posts.id, comments.postId))
  .select(({ users, posts, comments }) => ({
    username: users.username,
    postTitle: posts.title,
    commentBody: comments.body,
  }))
  .orderBy(({ users, comments }) => [
    asc(users.username),
    desc(comments.createdAt),
  ]);

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
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .innerJoin(Comments, ({ posts, comments }) => eq(posts.id, comments.postId))
  .select(({ users, posts, comments }) => ({
    username: users.username,
    postTitle: posts.title,
    commentBody: comments.body,
  }))
  .where(({ users }) => eq(users.type, "admin"));

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
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .innerJoin(Comments, ({ posts, comments }) => eq(posts.id, comments.postId))
  .select(({ users, posts }) => ({
    username: users.username,
    postTitle: posts.title,
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
  .innerJoin(UserProfiles, ({ users, userProfiles }) =>
    eq(users.id, userProfiles.userId),
  )
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .innerJoin(Comments, ({ posts, comments }) => eq(posts.id, comments.postId))
  .select(({ users, userProfiles, posts, comments }) => ({
    username: users.username,
    bio: userProfiles.bio,
    postTitle: posts.title,
    commentBody: comments.body,
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
  .innerJoin(Categories, ({ articles, categories }) =>
    eq(articles.categoryId, categories.id),
  )
  .select(({ articles, categories }) => ({
    articleTitle: articles.title,
    categoryName: categories.name,
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
  .innerJoin(Users, ({ articles, users }) => eq(articles.authorId, users.id))
  .select(({ articles, users }) => ({
    articleTitle: articles.title,
    authorName: users.username,
    authorEmail: users.email,
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
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  // @ts-expect-error - Using wrong column in join condition (FK from unjoined table)
  .select(({ users }) => ({ commentBody: Comments.body }));

db.from(Users)
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select("*")
  // @ts-expect-error - Wrong type in where clause after join
  .where(({ users }) => eq(users.id, "not_a_number"));

db.from(Users)
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .innerJoin(Comments, ({ posts, comments }) => eq(posts.id, comments.postId))
  // @ts-expect-error - Selecting column from wrong table should not compile
  .select(({ users }) => ({ categoryName: Categories.name }));

db.from(Users)
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select("*")
  // @ts-expect-error - where clause on column from unjoined table
  .where(() => eq(Comments.body, "test"));

db.from(Users)
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select("*")
  // @ts-expect-error - Invalid enum value in where clause after join
  .where(({ users }) => eq(users.type, "invalid_type"));

db.from(Users)
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  // @ts-expect-error - Column from wrong table should not compile
  .select(({ users, posts }) => ({
    username: users.username,
    profileBio: UserProfiles.bio,
  }));

// ============================================================================
// POSITIVE TYPE TESTS - Single Left Join
// ============================================================================

// Type test: left join with callback select — notNull columns from left-joined table become nullable
const leftJoinExplicitQuery = db
  .from(Users)
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    username: users.username,
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
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    username: users.username,
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
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
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
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    username: users.username,
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
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    username: users.username,
    postTitle: posts.title,
  }))
  .orderBy(({ users, posts }) => [asc(users.username), desc(posts.createdAt)]);

type LeftJoinOrderBy = Awaited<typeof leftJoinOrderByQuery>;
Expect<
  Equal<LeftJoinOrderBy, { username: string; postTitle: string | null }[]>
>();

// Type test: left join with enum column — enum column becomes nullable
const leftJoinEnumQuery = db
  .from(Posts)
  .leftJoin(Users, ({ posts, users }) => eq(posts.userId, users.id))
  .select(({ posts, users }) => ({
    title: posts.title,
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
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    username: users.username,
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
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({ metrics: posts.metrics }))
  .where(({ posts }) => eq(posts.metrics, { views: 10, likes: 5 }));

// ============================================================================
// POSITIVE TYPE TESTS - Mixed Inner + Left Join
// ============================================================================

// Type test: inner join then left join — inner columns not nullable, left columns nullable
const mixedJoinQuery = db
  .from(Users)
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .leftJoin(Comments, ({ posts, comments }) => eq(posts.id, comments.postId))
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
  .leftJoin(UserProfiles, ({ users, userProfiles }) =>
    eq(users.id, userProfiles.userId),
  )
  .innerJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, userProfiles, posts }) => ({
    username: users.username,
    bio: userProfiles.bio,
    postTitle: posts.title,
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
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ users, posts }) => ({
    username: users.username,
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
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .innerJoin(Comments, ({ posts, comments }) => eq(posts.id, comments.postId))
  .select(({ users, posts, comments }) => ({
    username: users.username,
    postTitle: posts.title,
    commentBody: comments.body,
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
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  // @ts-expect-error - Using column from unjoined table
  .select(({ users }) => ({ commentBody: Comments.body }));

db.from(Users)
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select("*")
  // @ts-expect-error - Wrong type in where clause after left join
  .where(({ users }) => eq(users.id, "not_a_number"));

db.from(Users)
  .leftJoin(Posts, ({ users, posts }) => eq(users.id, posts.userId))
  .select(({ posts }) => ({ metrics: posts.metrics }))
  // @ts-expect-error - Mismatched $type override property in where should not compile
  .where(({ posts }) => eq(posts.metrics, { invalidKey: 123 }));
