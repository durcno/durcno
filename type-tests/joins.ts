import { asc, desc, eq } from "durcno";
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
  .innerJoin(UserProfiles, eq(Users.id, UserProfiles.userId))
  .select({
    username: Users.username,
    bio: UserProfiles.bio,
  });

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
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select();

type UsersWithPostsAll = Awaited<typeof usersWithPostsAllQuery>;
Expect<
  Equal<
    UsersWithPostsAll,
    {
      id: number;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
      userId: number;
      title: string | null;
      content: string | null;
      tags: string[] | null;
    }[]
  >
>();

// Type test: inner join selecting from joined table
const usersWithPostsSelectPostsQuery = db
  .from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select({
    postId: Posts.id,
    title: Posts.title,
    content: Posts.content,
  });

type UsersWithPostsSelectPosts = Awaited<typeof usersWithPostsSelectPostsQuery>;
Expect<
  Equal<
    UsersWithPostsSelectPosts,
    {
      postId: number;
      title: string | null;
      content: string | null;
    }[]
  >
>();

// Type test: inner join with mixed columns from both tables
const mixedColumnsQuery = db
  .from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select({
    userId: Users.id,
    username: Users.username,
    postId: Posts.id,
    postTitle: Posts.title,
    postCreatedAt: Posts.createdAt,
  });

type MixedColumns = Awaited<typeof mixedColumnsQuery>;
Expect<
  Equal<
    MixedColumns,
    {
      userId: number;
      username: string;
      postId: number;
      postTitle: string | null;
      postCreatedAt: Date;
    }[]
  >
>();

// Type test: inner join with orderBy on columns from both tables
const joinOrderByQuery = db
  .from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select({
    username: Users.username,
    title: Posts.title,
  })
  .orderBy([asc(Users.username), desc(Posts.createdAt)]);

type JoinOrderBy = Awaited<typeof joinOrderByQuery>;
Expect<Equal<JoinOrderBy, { username: string; title: string | null }[]>>();

// Type test: inner join with where clause on base table
const joinWithWhereBaseQuery = db
  .from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select({
    username: Users.username,
    title: Posts.title,
  })
  .where(eq(Users.type, "admin"));

type JoinWithWhereBase = Awaited<typeof joinWithWhereBaseQuery>;
Expect<
  Equal<JoinWithWhereBase, { username: string; title: string | null }[]>
>();

// Type test: inner join with where clause on joined table
const joinWithWhereJoinedQuery = db
  .from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select({
    username: Users.username,
    title: Posts.title,
  })
  .where(eq(Posts.title, "hello"));

type JoinWithWhereJoined = Awaited<typeof joinWithWhereJoinedQuery>;
Expect<
  Equal<JoinWithWhereJoined, { username: string; title: string | null }[]>
>();

// Type test: join Posts with Comments
const postsWithCommentsQuery = db
  .from(Posts)
  .innerJoin(Comments, eq(Posts.id, Comments.postId))
  .select({
    postTitle: Posts.title,
    commentBody: Comments.body,
    commentCreatedAt: Comments.createdAt,
  });

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
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .innerJoin(Comments, eq(Posts.id, Comments.postId))
  .select({
    username: Users.username,
    postTitle: Posts.title,
    commentBody: Comments.body,
  });
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
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .innerJoin(Comments, eq(Posts.id, Comments.postId))
  .select({
    username: Users.username,
    postTitle: Posts.title,
    commentBody: Comments.body,
  })
  .where(eq(Posts.title, "foo"));

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
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .innerJoin(Comments, eq(Posts.id, Comments.postId))
  .select({
    userId: Users.id,
    userType: Users.type,
    postId: Posts.id,
    postContent: Posts.content,
    commentId: Comments.id,
    commentBody: Comments.body,
  });

type DoubleJoinAllColumns = Awaited<typeof doubleJoinAllColumnsQuery>;
Expect<
  Equal<
    DoubleJoinAllColumns,
    {
      userId: number;
      userType: "admin" | "user";
      postId: number;
      postContent: string | null;
      commentId: number;
      commentBody: string | null;
    }[]
  >
>();

// Type test: double inner join with orderBy on any table
const doubleJoinOrderByQuery = db
  .from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .innerJoin(Comments, eq(Posts.id, Comments.postId))
  .select({
    username: Users.username,
    postTitle: Posts.title,
    commentBody: Comments.body,
  })
  .orderBy([asc(Users.username), desc(Comments.createdAt)]);

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
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .innerJoin(Comments, eq(Posts.id, Comments.postId))
  .select({
    username: Users.username,
    postTitle: Posts.title,
    commentBody: Comments.body,
  })
  .where(eq(Users.type, "admin"));

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
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .innerJoin(Comments, eq(Posts.id, Comments.postId))
  .select({
    username: Users.username,
    postTitle: Posts.title,
  })
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
  .innerJoin(UserProfiles, eq(Users.id, UserProfiles.userId))
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .innerJoin(Comments, eq(Posts.id, Comments.postId))
  .select({
    username: Users.username,
    bio: UserProfiles.bio,
    postTitle: Posts.title,
    commentBody: Comments.body,
  });

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
  .innerJoin(Categories, eq(Articles.categoryId, Categories.id))
  .select({
    articleTitle: Articles.title,
    categoryName: Categories.name,
  });

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
  .innerJoin(Users, eq(Articles.authorId, Users.id))
  .select({
    articleTitle: Articles.title,
    authorName: Users.username,
    authorEmail: Users.email,
  });

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
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  // @ts-expect-error - Using wrong column in join condition (FK from unjoined table)
  .select({ commentBody: Comments.body });

// @ts-expect-error - Using wrong column in join condition (FK from unjoined table)
db.from(Users).innerJoin(Posts, eq(Users.id, Comments.postId)).select();

// @ts-expect-error - Joining with completely unrelated tables in condition
db.from(Users).innerJoin(Posts, eq(Categories.id, Comments.postId)).select();

db.from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select()
  // @ts-expect-error - Wrong type in where clause after join
  .where(eq(Users.id, "not_a_number"));

db.from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select()
  // @ts-expect-error
  .orderBy(asc(Comments.createdAt));

db.from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .innerJoin(Comments, eq(Posts.id, Comments.postId))
  // @ts-expect-error - Selecting column from wrong table should not compile
  .select({ categoryName: Categories.name });

db.from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select()
  // @ts-expect-error - where clause on column from unjoined table
  .where(eq(Comments.body, "test"));

db.from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select()
  // @ts-expect-error - Invalid enum value in where clause after join
  .where(eq(Users.type, "invalid_type"));

db.from(Users).innerJoin(Posts, eq(Users.username, Posts.userId)).select();

db.from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  // @ts-expect-error - Joining with completely unrelated tables in condition should not compile
  .innerJoin(Comments, eq(Users.id, Categories.id))
  .select();

db.from(Users).innerJoin(Posts, eq(Users.id, Posts.userId)).select({
  username: Users.username,
  // @ts-expect-error - Column from wrong table in where should not compile
  profileBio: UserProfiles.bio,
});

db.from(Users)
  .innerJoin(Posts, eq(Users.id, Posts.userId))
  .select()
  // @ts-expect-error - orderBy array with column from unjoined table
  .orderBy([asc(Users.username), desc(Categories.name)]);
