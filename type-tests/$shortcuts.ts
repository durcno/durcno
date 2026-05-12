import { eq } from "durcno";

import { db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// ============================================================
// $count tests
// ============================================================

// Test $count without where clause
const countAll = db.$count(Users);
type CountAllResult = Awaited<typeof countAll>;
Expect<Equal<CountAllResult, number>>();

// Test $count with where clause
const countFiltered = db.$count(Users, eq(Users.username, "Dan"));
type CountFilteredResult = Awaited<typeof countFiltered>;
Expect<Equal<CountFilteredResult, number>>();

// Test $count with different table
const countPosts = db.$count(Posts);
type CountPostsResult = Awaited<typeof countPosts>;
Expect<Equal<CountPostsResult, number>>();

// Test $count with enum column filter
const countAdmin = db.$count(Users, eq(Users.type, "admin"));
type CountAdminResult = Awaited<typeof countAdmin>;
Expect<Equal<CountAdminResult, number>>();

// ============================================================
// $exists tests
// ============================================================

// Test $exists without where clause
const existsAll = db.$exists(Users);
type ExistsAllResult = Awaited<typeof existsAll>;
Expect<Equal<ExistsAllResult, boolean>>();

// Test $exists with where clause
const existsFiltered = db.$exists(Users, eq(Users.username, "Dan"));
type ExistsFilteredResult = Awaited<typeof existsFiltered>;
Expect<Equal<ExistsFilteredResult, boolean>>();

// Test $exists with enum column filter
const existsAdmin = db.$exists(Users, eq(Users.type, "admin"));
type ExistsAdminResult = Awaited<typeof existsAdmin>;
Expect<Equal<ExistsAdminResult, boolean>>();

// ============================================================
// $first tests
// ============================================================

// Test $first without where clause
const firstUser = db.$first(Users);
type FirstUserResult = Awaited<typeof firstUser>;
Expect<
  Equal<
    FirstUserResult,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    } | null
  >
>();

// Test $first with where clause
const firstByUsername = db.$first(Users, eq(Users.username, "Dan"));
type FirstByUsernameResult = Awaited<typeof firstByUsername>;
Expect<
  Equal<
    FirstByUsernameResult,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    } | null
  >
>();

// Test $first with enum filter
const firstAdmin = db.$first(Users, eq(Users.type, "admin"));
type FirstAdminResult = Awaited<typeof firstAdmin>;
Expect<
  Equal<
    FirstAdminResult,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    } | null
  >
>();

// Test $first with different table (Posts)
const firstPost = db.$first(Posts);
type FirstPostResult = Awaited<typeof firstPost>;
Expect<
  Equal<
    FirstPostResult,
    {
      id: bigint;
      userId: bigint;
      title: string | null;
      content: string | null;
      createdAt: Date;
      tags: string[] | null;
      metrics: { views: number; likes: number } | null;
    } | null
  >
>();

// ============================================================
// $sum tests
// ============================================================

// Test $sum without where clause
const sumUserId = db.$sum(Posts, Posts.userId);
type SumUserIdResult = Awaited<typeof sumUserId>;
Expect<Equal<SumUserIdResult, number | null>>();

// Test $sum with where clause
const sumUserIdFiltered = db.$sum(Posts, Posts.userId, eq(Posts.title, "Test"));
type SumUserIdFilteredResult = Awaited<typeof sumUserIdFiltered>;
Expect<Equal<SumUserIdFilteredResult, number | null>>();

// Test $sum with bigint column
const sumId = db.$sum(Posts, Posts.id);
type SumIdResult = Awaited<typeof sumId>;
Expect<Equal<SumIdResult, number | null>>();

// ============================================================
// $avg tests
// ============================================================

// Test $avg without where clause
const avgUserId = db.$avg(Posts, Posts.userId);
type AvgUserIdResult = Awaited<typeof avgUserId>;
Expect<Equal<AvgUserIdResult, number | null>>();

// Test $avg with where clause
const avgUserIdFiltered = db.$avg(Posts, Posts.userId, eq(Posts.title, "Test"));
type AvgUserIdFilteredResult = Awaited<typeof avgUserIdFiltered>;
Expect<Equal<AvgUserIdFilteredResult, number | null>>();

// ============================================================
// $min tests
// ============================================================

// Test $min without where clause
const minUserId = db.$min(Posts, Posts.userId);
type MinUserIdResult = Awaited<typeof minUserId>;
Expect<Equal<MinUserIdResult, number | null>>();

// Test $min with where clause
const minUserIdFiltered = db.$min(Posts, Posts.userId, eq(Posts.title, "Test"));
type MinUserIdFilteredResult = Awaited<typeof minUserIdFiltered>;
Expect<Equal<MinUserIdFilteredResult, number | null>>();

// ============================================================
// $max tests
// ============================================================

// Test $max without where clause
const maxUserId = db.$max(Posts, Posts.userId);
type MaxUserIdResult = Awaited<typeof maxUserId>;
Expect<Equal<MaxUserIdResult, number | null>>();

// Test $max with where clause
const maxUserIdFiltered = db.$max(Posts, Posts.userId, eq(Posts.title, "Test"));
type MaxUserIdFilteredResult = Awaited<typeof maxUserIdFiltered>;
Expect<Equal<MaxUserIdFilteredResult, number | null>>();

// ============================================================
// $distinct tests
// ============================================================

// Test $distinct with string column
const distinctUsernames = db.$distinct(Users, Users.username);
type DistinctUsernamesResult = Awaited<typeof distinctUsernames>;
Expect<Equal<DistinctUsernamesResult, string[]>>();

// Test $distinct with nullable column
const distinctEmails = db.$distinct(Users, Users.email);
type DistinctEmailsResult = Awaited<typeof distinctEmails>;
Expect<Equal<DistinctEmailsResult, (string | null)[]>>();

// Test $distinct with enum column
const distinctTypes = db.$distinct(Users, Users.type);
type DistinctTypesResult = Awaited<typeof distinctTypes>;
Expect<Equal<DistinctTypesResult, ("admin" | "user")[]>>();

// Test $distinct with where clause
const distinctUsernamesFiltered = db.$distinct(
  Users,
  Users.username,
  eq(Users.type, "admin"),
);
type DistinctUsernamesFilteredResult = Awaited<
  typeof distinctUsernamesFiltered
>;
Expect<Equal<DistinctUsernamesFilteredResult, string[]>>();

// Test $distinct with numeric column
const distinctUserIds = db.$distinct(Posts, Posts.userId);
type DistinctUserIdsResult = Awaited<typeof distinctUserIds>;
Expect<Equal<DistinctUserIdsResult, bigint[]>>();

// ============================================================
// $insertReturning tests
// ============================================================

// Test $insertReturning with required fields
const insertedUser = db.$insertReturning(Users, {
  username: "testuser",
  type: "user",
  externalId: "550e8400-e29b-41d4-a716-446655440000",
});
type InsertedUserResult = Awaited<typeof insertedUser>;
Expect<
  Equal<
    InsertedUserResult,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    }
  >
>();

// Test $insertReturning with all fields
const insertedUserFull = db.$insertReturning(Users, {
  username: "testuser",
  email: "test@example.com",
  type: "admin",
  externalId: "550e8400-e29b-41d4-a716-446655440000",
});
type InsertedUserFullResult = Awaited<typeof insertedUserFull>;
Expect<
  Equal<
    InsertedUserFullResult,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    }
  >
>();

// Test $insertReturning with Posts table
const insertedPost = db.$insertReturning(Posts, {
  userId: 1n,
});
type InsertedPostResult = Awaited<typeof insertedPost>;
Expect<
  Equal<
    InsertedPostResult,
    {
      id: bigint;
      userId: bigint;
      title: string | null;
      content: string | null;
      createdAt: Date;
      tags: string[] | null;
      metrics: { views: number; likes: number } | null;
    }
  >
>();

// ============================================================================
// Negative type tests - these should cause compile errors
// ============================================================================

// @ts-expect-error - $count with wrong type in where should not compile
db.$count(Users, eq(Users.id, "string_instead_of_number"));

// @ts-expect-error - $count with invalid enum value should not compile
db.$count(Users, eq(Users.type, "invalid_type"));

// @ts-expect-error - $exists with wrong type in where should not compile
db.$exists(Users, eq(Users.id, "string_instead_of_number"));

// @ts-expect-error - $first with wrong type in where should not compile
db.$first(Users, eq(Users.id, "string_instead_of_number"));

// @ts-expect-error - $sum with wrong type in where should not compile
db.$sum(Posts, Posts.userId, eq(Posts.id, "not_a_number"));

// @ts-expect-error - $min with wrong type in where should not compile
db.$min(Posts, Posts.userId, eq(Posts.id, "not_a_number"));

// @ts-expect-error - $max with wrong type in where should not compile
db.$max(Posts, Posts.userId, eq(Posts.id, "not_a_number"));

// @ts-expect-error - $distinct with column from wrong table should not compile
db.$distinct(Users, Posts.title);

// @ts-expect-error - $insertReturning with missing required field should not compile
db.$insertReturning(Users, { email: "test@example.com" });

// @ts-expect-error - $insertReturning with wrong type should not compile
db.$insertReturning(Users, { username: 123, type: "user" });

// @ts-expect-error - $insertReturning with invalid enum value should not compile
db.$insertReturning(Users, { username: "test", type: "invalid_type" });
