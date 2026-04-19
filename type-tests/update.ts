import { and, eq } from "durcno";
import { Comments, db, Logs, Posts, UserProfiles, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// Type test: basic update with set
const basicUpdateQuery = db.update(Users).set({
  username: "new_username",
  email: "new@example.com",
});
type BasicUpdate = Awaited<typeof basicUpdateQuery>;
Expect<Equal<BasicUpdate, null>>();

// Type test: update with partial values (only some columns)
const partialUpdateQuery = db.update(Users).set({
  email: "updated@example.com",
});
type PartialUpdate = Awaited<typeof partialUpdateQuery>;
Expect<Equal<PartialUpdate, null>>();

// Type test: update with nullable field set to null
const nullUpdateQuery = db.update(Users).set({
  email: null,
});
type NullUpdate = Awaited<typeof nullUpdateQuery>;
Expect<Equal<NullUpdate, null>>();

// Type test: update with where condition
const updateWithWhereQuery = db
  .update(Users)
  .set({
    username: "updated_user",
    email: "updated@example.com",
  })
  .where(eq(Users.id, 1));
type UpdateWithWhere = Awaited<typeof updateWithWhereQuery>;
Expect<Equal<UpdateWithWhere, null>>();

// Type test: update with complex where condition (and)
const updateWithAndQuery = db
  .update(Users)
  .set({
    email: "new@example.com",
  })
  .where(and(eq(Users.id, 1), eq(Users.type, "admin")));
type UpdateWithAnd = Awaited<typeof updateWithAndQuery>;
Expect<Equal<UpdateWithAnd, null>>();

// Type test: update Posts table
const updatePostsQuery = db
  .update(Posts)
  .set({
    title: "Updated Title",
    content: "Updated content",
  })
  .where(eq(Posts.id, 1));
type UpdatePosts = Awaited<typeof updatePostsQuery>;
Expect<Equal<UpdatePosts, null>>();

// Type test: update Comments table with where
const updateCommentsQuery = db
  .update(Comments)
  .set({
    body: "Updated comment body",
  })
  .where(eq(Comments.userId, 1));
type UpdateComments = Awaited<typeof updateCommentsQuery>;
Expect<Equal<UpdateComments, null>>();

// Type test: update UserProfiles table
const updateUserProfilesQuery = db
  .update(UserProfiles)
  .set({
    bio: "Updated bio",
    avatarUrl: "https://example.com/new-avatar.jpg",
  })
  .where(eq(UserProfiles.userId, 1));
type UpdateUserProfiles = Awaited<typeof updateUserProfilesQuery>;
Expect<Equal<UpdateUserProfiles, null>>();

// ============================================================================
// Array column update tests
// ============================================================================

// Type test: update Posts tags array column
db.update(Posts)
  .set({
    tags: ["updated", "tags", "array"],
  })
  .where(eq(Posts.id, 1));

// Type test: update Posts tags to null
db.update(Posts)
  .set({
    tags: null,
  })
  .where(eq(Posts.id, 1));

// Type test: update UserProfiles skills array column
db.update(UserProfiles)
  .set({
    skills: ["TypeScript", "PostgreSQL"],
  })
  .where(eq(UserProfiles.id, 1));

// Type test: update UserProfiles skills to null
db.update(UserProfiles)
  .set({
    skills: null,
  })
  .where(eq(UserProfiles.id, 1));

// Type test: update with enum value
const updateEnumQuery = db
  .update(Users)
  .set({
    type: "user",
  })
  .where(eq(Users.id, 1));
type UpdateEnum = Awaited<typeof updateEnumQuery>;
Expect<Equal<UpdateEnum, null>>();

// Type safety test: Must provide correct type for notNull columns
// This should work - providing valid value for notNull column
db.update(Users).set({
  username: "valid_username",
  type: "admin",
});

// Type safety test: Reference field type validation
// This should work - providing valid bigint value
db.update(UserProfiles).set({
  userId: 1,
});

// Type safety tests - these should cause compile errors:
// Primary key should not be updatable
// @ts-expect-error - Primary key should not be updatable
db.update(Users).set({ id: 1, username: "test" });

// Invalid enum value should not compile
// @ts-expect-error - Invalid enum value should not compile
db.update(Users).set({ type: "invalid_type" });

// Wrong type for column should not compile
// @ts-expect-error - Wrong type for column should not compile
db.update(Users).set({ username: 123 });

// Wrong reference type should not compile
// @ts-expect-error - Wrong reference type should not compile
db.update(UserProfiles).set({ userId: "invalid" });

// Type test: update with returning all columns
const updateReturningAllQuery = db
  .update(Users)
  .set({ username: "new_username" })
  .returning({ id: true, username: true, email: true, type: true });
type UpdateReturningAll = Awaited<typeof updateReturningAllQuery>;
Expect<
  Equal<
    UpdateReturningAll,
    {
      id: number;
      username: string;
      email: string | null;
      type: "admin" | "user";
    }[]
  >
>();

// Type test: update with returning specific columns
const updateReturningSpecificQuery = db
  .update(Users)
  .set({ email: "updated@example.com" })
  .returning({ id: true, email: true });
type UpdateReturningSpecific = Awaited<typeof updateReturningSpecificQuery>;
Expect<
  Equal<UpdateReturningSpecific, { id: number; email: string | null }[]>
>();

// Type test: update with returning single column
const updateReturningSingleQuery = db
  .update(Users)
  .set({ username: "updated_user" })
  .returning({ username: true });
type UpdateReturningSingle = Awaited<typeof updateReturningSingleQuery>;
Expect<Equal<UpdateReturningSingle, { username: string }[]>>();

// Type test: update with where and returning
const updateWhereReturningQuery = db
  .update(Users)
  .set({ email: "new@example.com" })
  .where(eq(Users.id, 1))
  .returning({ id: true, email: true });
type UpdateWhereReturning = Awaited<typeof updateWhereReturningQuery>;
Expect<Equal<UpdateWhereReturning, { id: number; email: string | null }[]>>();

// Type test: update with returning before where
const updateReturningBeforeWhereQuery = db
  .update(Users)
  .set({ username: "new_username" })
  .returning({ id: true, username: true })
  .where(eq(Users.id, 1));
type UpdateReturningBeforeWhere = Awaited<
  typeof updateReturningBeforeWhereQuery
>;
Expect<Equal<UpdateReturningBeforeWhere, { id: number; username: string }[]>>();

// Type test: update Posts with returning
const updatePostsReturningQuery = db
  .update(Posts)
  .set({ title: "Updated Title" })
  .returning({ id: true, title: true, userId: true });
type UpdatePostsReturning = Awaited<typeof updatePostsReturningQuery>;
Expect<
  Equal<
    UpdatePostsReturning,
    { id: number; title: string | null; userId: number }[]
  >
>();

// Type test: update with enum column in returning
const updateEnumReturningQuery = db
  .update(Users)
  .set({ type: "user" })
  .returning({ type: true });
type UpdateEnumReturning = Awaited<typeof updateEnumReturningQuery>;
Expect<Equal<UpdateEnumReturning, { type: "admin" | "user" }[]>>();

// Type test: update with updateFn - updatedAt is auto-set by updateFn
// Users should not need to explicitly provide updatedAt column
const updateLogsQuery = db
  .update(Logs)
  .set({ message: "Updated message" })
  .where(eq(Logs.id, 1));
type UpdateLogs = Awaited<typeof updateLogsQuery>;
Expect<Equal<UpdateLogs, null>>();

// Type test: update Logs with returning - updateFn columns appear in result
const updateLogsReturningQuery = db
  .update(Logs)
  .set({ message: "New message" })
  .where(eq(Logs.id, 1))
  .returning({ id: true, message: true, updatedAt: true });
type UpdateLogsReturning = Awaited<typeof updateLogsReturningQuery>;
Expect<
  Equal<UpdateLogsReturning, { id: number; message: string; updatedAt: Date }[]>
>();

// Type test: update Logs - can still provide explicit value for updateFn column
db.update(Logs)
  .set({
    message: "Message",
    updatedAt: new Date("2025-01-01"), // Override updateFn with explicit value
  })
  .where(eq(Logs.id, 1));
