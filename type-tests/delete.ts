import { and, eq, gte, isIn, isNotNull, isNull, lte, or } from "durcno";
import { Comments, db, Posts, UserProfiles, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// Type test: basic delete without where
const basicDeleteQuery = db.delete(Users);
type BasicDelete = Awaited<typeof basicDeleteQuery>;
Expect<Equal<BasicDelete, null>>();

// Type test: delete with simple where condition
const deleteWithWhereQuery = db.delete(Users).where(eq(Users.id, 1n));
type DeleteWithWhere = Awaited<typeof deleteWithWhereQuery>;
Expect<Equal<DeleteWithWhere, null>>();

// Type test: delete with multiple where conditions (and)
const deleteWithAndQuery = db
  .delete(Users)
  .where(and(eq(Users.id, 1n), eq(Users.type, "admin")));
type DeleteWithAnd = Awaited<typeof deleteWithAndQuery>;
Expect<Equal<DeleteWithAnd, null>>();

// Type test: delete with or condition
const deleteWithOrQuery = db
  .delete(Users)
  .where(or(eq(Users.type, "admin"), eq(Users.type, "user")));
type DeleteWithOr = Awaited<typeof deleteWithOrQuery>;
Expect<Equal<DeleteWithOr, null>>();

// Type test: delete with comparison operators
const deleteWithGteQuery = db.delete(Users).where(gte(Users.id, 10n));
type DeleteWithGte = Awaited<typeof deleteWithGteQuery>;
Expect<Equal<DeleteWithGte, null>>();

const deleteWithLteQuery = db.delete(Users).where(lte(Users.id, 100n));
type DeleteWithLte = Awaited<typeof deleteWithLteQuery>;
Expect<Equal<DeleteWithLte, null>>();

// Type test: delete with isNull/isNotNull
const deleteWithIsNullQuery = db.delete(Users).where(isNull(Users.email));
type DeleteWithIsNull = Awaited<typeof deleteWithIsNullQuery>;
Expect<Equal<DeleteWithIsNull, null>>();

const deleteWithIsNotNullQuery = db.delete(Users).where(isNotNull(Users.email));
type DeleteWithIsNotNull = Awaited<typeof deleteWithIsNotNullQuery>;
Expect<Equal<DeleteWithIsNotNull, null>>();

// Type test: delete with isIn condition
const deleteWithIsInQuery = db
  .delete(Users)
  .where(isIn(Users.type, ["admin", "user"]));
type DeleteWithIsIn = Awaited<typeof deleteWithIsInQuery>;
Expect<Equal<DeleteWithIsIn, null>>();

// Type test: delete from Posts table
const deletePostsQuery = db.delete(Posts).where(eq(Posts.userId, 1n));
type DeletePosts = Awaited<typeof deletePostsQuery>;
Expect<Equal<DeletePosts, null>>();

// Type test: delete from Comments table
const deleteCommentsQuery = db
  .delete(Comments)
  .where(and(eq(Comments.postId, 1n), eq(Comments.userId, 1n)));
type DeleteComments = Awaited<typeof deleteCommentsQuery>;
Expect<Equal<DeleteComments, null>>();

// Type test: delete from UserProfiles table
const deleteUserProfilesQuery = db
  .delete(UserProfiles)
  .where(eq(UserProfiles.userId, 1n));
type DeleteUserProfiles = Awaited<typeof deleteUserProfilesQuery>;
Expect<Equal<DeleteUserProfiles, null>>();

// Type test: complex delete with nested conditions
const complexDeleteQuery = db
  .delete(Users)
  .where(and(eq(Users.type, "admin"), gte(Users.id, 1n)));
type ComplexDelete = Awaited<typeof complexDeleteQuery>;
Expect<Equal<ComplexDelete, null>>();

// Type test: delete with string comparison
const deleteWithStringQuery = db
  .delete(Users)
  .where(eq(Users.username, "user_to_delete"));
type DeleteWithString = Awaited<typeof deleteWithStringQuery>;
Expect<Equal<DeleteWithString, null>>();

// Type test: delete with enum comparison
const deleteWithEnumQuery = db.delete(Users).where(eq(Users.type, "admin"));
type DeleteWithEnum = Awaited<typeof deleteWithEnumQuery>;
Expect<Equal<DeleteWithEnum, null>>();

// Type test: delete with timestamp comparison
const deleteWithTimestampQuery = db
  .delete(Posts)
  .where(lte(Posts.createdAt, new Date()));
type DeleteWithTimestamp = Awaited<typeof deleteWithTimestampQuery>;
Expect<Equal<DeleteWithTimestamp, null>>();

// Type test: delete with bigint reference field
const deleteWithReferenceQuery = db
  .delete(UserProfiles)
  .where(eq(UserProfiles.userId, 123n));
type DeleteWithReference = Awaited<typeof deleteWithReferenceQuery>;
Expect<Equal<DeleteWithReference, null>>();

// Type safety tests - these should work fine
db.delete(Users).where(eq(Users.id, 1n));
db.delete(Posts).where(isIn(Posts.id, [1n, 2n, 3n]));
db.delete(Comments).where(isNotNull(Comments.body));

// Type safety tests - these should cause compile errors:
// Wrong type for comparison should not compile
// @ts-expect-error - Wrong type for comparison should not compile
db.delete(Users).where(eq(Users.id, "string_instead_of_number"));

// Invalid enum value should not compile
// @ts-expect-error - Invalid enum value should not compile
db.delete(Users).where(eq(Users.type, "invalid_type"));

// Wrong field reference should not compile
// @ts-expect-error - Wrong field reference should not compile
db.delete(Users).where(eq(Users.nonExistentField, "value"));

// Comparing incompatible types should not compile
// @ts-expect-error - Comparing incompatible types should not compile
db.delete(Users).where(eq(Users.username, 123));

// Type test: delete with returning all columns
const deleteReturningAllQuery = db
  .delete(Users)
  .where(eq(Users.id, 1n))
  .returning({ id: true, username: true, email: true, type: true });
type DeleteReturningAll = Awaited<typeof deleteReturningAllQuery>;
Expect<
  Equal<
    DeleteReturningAll,
    {
      id: bigint;
      username: string;
      email: string | null;
      type: "admin" | "user";
    }[]
  >
>();

// Type test: delete with returning specific columns
const deleteReturningSpecificQuery = db
  .delete(Users)
  .where(eq(Users.type, "admin"))
  .returning({ id: true, username: true });
type DeleteReturningSpecific = Awaited<typeof deleteReturningSpecificQuery>;
Expect<Equal<DeleteReturningSpecific, { id: bigint; username: string }[]>>();

// Type test: delete with returning single column
const deleteReturningSingleQuery = db.delete(Users).returning({ email: true });
type DeleteReturningSingle = Awaited<typeof deleteReturningSingleQuery>;
Expect<Equal<DeleteReturningSingle, { email: string | null }[]>>();

// Type test: delete without where but with returning
const deleteNoWhereReturningQuery = db
  .delete(Users)
  .returning({ id: true, type: true });
type DeleteNoWhereReturning = Awaited<typeof deleteNoWhereReturningQuery>;
Expect<
  Equal<DeleteNoWhereReturning, { id: bigint; type: "admin" | "user" }[]>
>();

// Type test: delete with returning before where
const deleteReturningBeforeWhereQuery = db
  .delete(Users)
  .returning({ id: true, username: true })
  .where(eq(Users.id, 1n));
type DeleteReturningBeforeWhere = Awaited<
  typeof deleteReturningBeforeWhereQuery
>;
Expect<Equal<DeleteReturningBeforeWhere, { id: bigint; username: string }[]>>();

// Type test: delete Posts with returning
const deletePostsReturningQuery = db
  .delete(Posts)
  .where(eq(Posts.userId, 1n))
  .returning({ id: true, title: true, userId: true });
type DeletePostsReturning = Awaited<typeof deletePostsReturningQuery>;
Expect<
  Equal<
    DeletePostsReturning,
    { id: bigint; title: string | null; userId: bigint }[]
  >
>();

// Type test: delete with enum column in returning
const deleteEnumReturningQuery = db
  .delete(Users)
  .where(eq(Users.id, 1n))
  .returning({ type: true });
type DeleteEnumReturning = Awaited<typeof deleteEnumReturningQuery>;
Expect<Equal<DeleteEnumReturning, { type: "admin" | "user" }[]>>();

// Type test: delete Comments with returning
const deleteCommentsReturningQuery = db
  .delete(Comments)
  .where(eq(Comments.postId, 1n))
  .returning({ id: true, body: true, createdAt: true });
type DeleteCommentsReturning = Awaited<typeof deleteCommentsReturningQuery>;
Expect<
  Equal<
    DeleteCommentsReturning,
    { id: bigint; body: string | null; createdAt: Date }[]
  >
>();
