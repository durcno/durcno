import { and, eq, or, prequery } from "durcno";
import { Comments, db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// Type test: basic prepared query with single argument
const basicQuery = prequery({ username: Users.username.arg() }, (args) => {
  return db
    .prepare()
    .from(Users)
    .select()
    .where(eq(Users.username, args.username));
});

const basicResult = basicQuery.run(db, { username: "john" });
type BasicResult = Awaited<typeof basicResult>;
Expect<
  Equal<
    BasicResult,
    {
      id: number;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    }[]
  >
>();

// Type test: prepared query with multiple arguments
const multiArgQuery = prequery(
  {
    username: Users.username.arg(),
    email: Users.email.arg(),
    type: Users.type.arg(),
  },
  (args) => {
    return db
      .prepare()
      .from(Users)
      .select()
      .where(
        and(
          eq(Users.username, args.username),
          eq(Users.email, args.email),
          eq(Users.type, args.type),
        ),
      );
  },
);

const multiArgResult = multiArgQuery.run(db, {
  username: "john",
  email: "john@example.com",
  type: "admin",
});
type MultiArgResult = Awaited<typeof multiArgResult>;
Expect<
  Equal<
    MultiArgResult,
    {
      id: number;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    }[]
  >
>();

// Type test: prepared query with selective column selection
const selectiveQuery = prequery({ id: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .from(Users)
    .select({ username: Users.username, email: Users.email })
    .where(eq(Users.id, args.id));
});

const selectiveResult = selectiveQuery.run(db, { id: 1 });
type SelectiveResult = Awaited<typeof selectiveResult>;
Expect<Equal<SelectiveResult, { username: string; email: string | null }[]>>();

// Type test: prepared query with numeric argument
const numericQuery = prequery({ userId: Users.id.arg() }, (args) => {
  return db.prepare().from(Posts).select().where(eq(Posts.userId, args.userId));
});

const numericResult = numericQuery.run(db, { userId: 1 });
type NumericResult = Awaited<typeof numericResult>;
Expect<
  Equal<
    NumericResult,
    {
      id: number;
      userId: number;
      title: string | null;
      content: string | null;
      createdAt: Date;
      tags: string[] | null;
    }[]
  >
>();

// Type test: prepared query with OR condition
const orQuery = prequery(
  { username1: Users.username.arg(), username2: Users.username.arg() },
  (args) => {
    return db
      .prepare()
      .from(Users)
      .select({ id: Users.id, username: Users.username })
      .where(
        or(
          eq(Users.username, args.username1),
          eq(Users.username, args.username2),
        ),
      );
  },
);

const orResult = orQuery.run(db, {
  username1: "john",
  username2: "jane",
});
type OrResult = Awaited<typeof orResult>;
Expect<Equal<OrResult, { id: number; username: string }[]>>();

// Type test: prepared query with enum argument
const enumQuery = prequery({ userType: Users.type.arg() }, (args) => {
  return db
    .prepare()
    .from(Users)
    .select({ id: Users.id, type: Users.type })
    .where(eq(Users.type, args.userType));
});

const enumResult = enumQuery.run(db, { userType: "admin" });
type EnumResult = Awaited<typeof enumResult>;
Expect<Equal<EnumResult, { id: number; type: "admin" | "user" }[]>>();

// Type test: prepared query with nullable column argument
const nullableQuery = prequery({ email: Users.email.arg() }, (args) => {
  return db.prepare().from(Users).select().where(eq(Users.email, args.email));
});

const nullableResult = nullableQuery.run(db, {
  email: "test@example.com",
});
type NullableResult = Awaited<typeof nullableResult>;
Expect<
  Equal<
    NullableResult,
    {
      id: number;
      username: string;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
      externalId: string;
      trackingId: string | null;
    }[]
  >
>();

// Type test: prepared query with complex AND/OR conditions
const complexQuery = prequery(
  {
    username: Users.username.arg(),
    type1: Users.type.arg(),
    type2: Users.type.arg(),
  },
  (args) => {
    return db
      .prepare()
      .from(Users)
      .select({ username: Users.username, type: Users.type })
      .where(
        and(
          eq(Users.username, args.username),
          or(eq(Users.type, args.type1), eq(Users.type, args.type2)),
        ),
      );
  },
);

const complexResult = complexQuery.run(db, {
  username: "john",
  type1: "admin",
  type2: "user",
});
type ComplexResult = Awaited<typeof complexResult>;
Expect<Equal<ComplexResult, { username: string; type: "admin" | "user" }[]>>();

// Type test: prepared query on different table (Posts)
const postsQuery = prequery(
  { postId: Posts.id.arg(), userId: Posts.userId.arg() },
  (args) => {
    return db
      .prepare()
      .from(Posts)
      .select({ title: Posts.title, content: Posts.content })
      .where(and(eq(Posts.id, args.postId), eq(Posts.userId, args.userId)));
  },
);

const postsResult = postsQuery.run(db, { postId: 1, userId: 1 });
type PostsResult = Awaited<typeof postsResult>;
Expect<
  Equal<PostsResult, { title: string | null; content: string | null }[]>
>();

// Type test: prepared query on Comments table with multiple args
const commentsQuery = prequery(
  {
    postId: Comments.postId.arg(),
    userId: Comments.userId.arg(),
  },
  (args) => {
    return db
      .prepare()
      .from(Comments)
      .select()
      .where(
        and(eq(Comments.postId, args.postId), eq(Comments.userId, args.userId)),
      );
  },
);

const commentsResult = commentsQuery.run(db, { postId: 1, userId: 1 });
type CommentsResult = Awaited<typeof commentsResult>;
Expect<
  Equal<
    CommentsResult,
    {
      id: number;
      postId: number;
      userId: number;
      body: string | null;
      createdAt: Date;
    }[]
  >
>();

// Type test: prepared query selecting single column
const singleColumnQuery = prequery({ id: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .from(Users)
    .select({ username: Users.username })
    .where(eq(Users.id, args.id));
});

const singleColumnResult = singleColumnQuery.run(db, { id: 1 });
type SingleColumnResult = Awaited<typeof singleColumnResult>;
Expect<Equal<SingleColumnResult, { username: string }[]>>();

// Type test: prepared query with timestamp argument
const timestampQuery = prequery(
  { createdAt: Users.createdAt.arg() },
  (args) => {
    return db
      .prepare()
      .from(Users)
      .select({ id: Users.id, createdAt: Users.createdAt })
      .where(eq(Users.createdAt, args.createdAt));
  },
);

const timestampResult = timestampQuery.run(db, { createdAt: new Date() });
type TimestampResult = Awaited<typeof timestampResult>;
Expect<Equal<TimestampResult, { id: number; createdAt: Date }[]>>();

// ============================================================================
// Negative type tests - these should cause compile errors
// ============================================================================

const wrongArgTypeQuery = prequery({ id: Users.id.arg() }, (args) =>
  db.prepare().from(Users).select().where(eq(Users.id, args.id)),
);
// @ts-expect-error - Wrong argument type at runtime should not compile
wrongArgTypeQuery.run(db, { id: "string_instead_of_number" });

const missingArgQuery = prequery(
  { username: Users.username.arg(), type: Users.type.arg() },
  (args) =>
    db
      .prepare()
      .from(Users)
      .select()
      .where(and(eq(Users.username, args.username), eq(Users.type, args.type))),
);
// @ts-expect-error - Missing required argument should not compile
missingArgQuery.run(db, { username: "test" }); // missing type

const enumArgQuery = prequery({ type: Users.type.arg() }, (args) =>
  db.prepare().from(Users).select().where(eq(Users.type, args.type)),
);
// @ts-expect-error - Invalid enum value at runtime should not compile
enumArgQuery.run(db, { type: "invalid_type" });

const bigintArgQuery = prequery({ userId: Posts.userId.arg() }, (args) =>
  db.prepare().from(Posts).select().where(eq(Posts.userId, args.userId)),
);
// @ts-expect-error - Wrong type for bigint argument should not compile
bigintArgQuery.run(db, { userId: "not_a_number" });

const extraArgQuery = prequery({ id: Users.id.arg() }, (args) =>
  db.prepare().from(Users).select().where(eq(Users.id, args.id)),
);
// @ts-expect-error - Extra argument should not compile
extraArgQuery.run(db, { id: 1, extra: "unused" });

// ============================================================================
// Update prepared query type tests
// ============================================================================

// Type test: basic prepared update with single argument
const updateBasicQuery = prequery({ userId: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .update(Users)
    .set({ username: "updated_name" })
    .where(eq(Users.id, args.userId));
});

const updateBasicResult = updateBasicQuery.run(db, { userId: 1 });
type UpdateBasicResult = Awaited<typeof updateBasicResult>;
Expect<Equal<UpdateBasicResult, null>>();

// Type test: prepared update with multiple arguments
const updateMultiArgQuery = prequery(
  { userId: Users.id.arg(), userType: Users.type.arg() },
  (args) => {
    return db
      .prepare()
      .update(Users)
      .set({ email: "new@example.com" })
      .where(and(eq(Users.id, args.userId), eq(Users.type, args.userType)));
  },
);

const updateMultiArgResult = updateMultiArgQuery.run(db, {
  userId: 1,
  userType: "admin",
});
type UpdateMultiArgResult = Awaited<typeof updateMultiArgResult>;
Expect<Equal<UpdateMultiArgResult, null>>();

// Type test: prepared update with returning
const updateReturningQuery = prequery({ userId: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .update(Users)
    .set({ username: "updated" })
    .where(eq(Users.id, args.userId))
    .returning({ id: true, username: true });
});

const updateReturningResult = updateReturningQuery.run(db, { userId: 1 });
type UpdateReturningResult = Awaited<typeof updateReturningResult>;
Expect<Equal<UpdateReturningResult, { id: number; username: string }[]>>();

// Type test: prepared update with OR condition
const updateOrQuery = prequery(
  { type1: Users.type.arg(), type2: Users.type.arg() },
  (args) => {
    return db
      .prepare()
      .update(Users)
      .set({ email: "batch@example.com" })
      .where(or(eq(Users.type, args.type1), eq(Users.type, args.type2)));
  },
);

const updateOrResult = updateOrQuery.run(db, {
  type1: "admin",
  type2: "user",
});
type UpdateOrResult = Awaited<typeof updateOrResult>;
Expect<Equal<UpdateOrResult, null>>();

// Type test: prepared update on Posts table
const updatePostsQuery = prequery(
  { postId: Posts.id.arg(), userId: Posts.userId.arg() },
  (args) => {
    return db
      .prepare()
      .update(Posts)
      .set({ title: "Updated Title" })
      .where(and(eq(Posts.id, args.postId), eq(Posts.userId, args.userId)));
  },
);

const updatePostsResult = updatePostsQuery.run(db, { postId: 1, userId: 1 });
type UpdatePostsResult = Awaited<typeof updatePostsResult>;
Expect<Equal<UpdatePostsResult, null>>();

// Negative type tests for update

const wrongUpdateArgType = prequery({ id: Users.id.arg() }, (args) =>
  db
    .prepare()
    .update(Users)
    .set({ username: "test" })
    .where(eq(Users.id, args.id)),
);
// @ts-expect-error - Wrong argument type for update should not compile
wrongUpdateArgType.run(db, { id: "string_instead_of_number" });

const missingUpdateArg = prequery(
  { id: Users.id.arg(), type: Users.type.arg() },
  (args) =>
    db
      .prepare()
      .update(Users)
      .set({ username: "test" })
      .where(and(eq(Users.id, args.id), eq(Users.type, args.type))),
);
// @ts-expect-error - Missing required argument for update should not compile
missingUpdateArg.run(db, { id: 1 });

// ============================================================================
// Delete prepared query type tests
// ============================================================================

// Type test: basic prepared delete with single argument
const deleteBasicQuery = prequery({ userId: Users.id.arg() }, (args) => {
  return db.prepare().delete(Users).where(eq(Users.id, args.userId));
});

const deleteBasicResult = deleteBasicQuery.run(db, { userId: 1 });
type DeleteBasicResult = Awaited<typeof deleteBasicResult>;
Expect<Equal<DeleteBasicResult, null>>();

// Type test: prepared delete with multiple arguments
const deleteMultiArgQuery = prequery(
  { userId: Users.id.arg(), userType: Users.type.arg() },
  (args) => {
    return db
      .prepare()
      .delete(Users)
      .where(and(eq(Users.id, args.userId), eq(Users.type, args.userType)));
  },
);

const deleteMultiArgResult = deleteMultiArgQuery.run(db, {
  userId: 1,
  userType: "admin",
});
type DeleteMultiArgResult = Awaited<typeof deleteMultiArgResult>;
Expect<Equal<DeleteMultiArgResult, null>>();

// Type test: prepared delete with returning
const deleteReturningQuery = prequery({ userId: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .delete(Users)
    .where(eq(Users.id, args.userId))
    .returning({ id: true, username: true });
});

const deleteReturningResult = deleteReturningQuery.run(db, { userId: 1 });
type DeleteReturningResult = Awaited<typeof deleteReturningResult>;
Expect<Equal<DeleteReturningResult, { id: number; username: string }[]>>();

// Type test: prepared delete with OR condition
const deleteOrQuery = prequery(
  { type1: Users.type.arg(), type2: Users.type.arg() },
  (args) => {
    return db
      .prepare()
      .delete(Users)
      .where(or(eq(Users.type, args.type1), eq(Users.type, args.type2)));
  },
);

const deleteOrResult = deleteOrQuery.run(db, {
  type1: "admin",
  type2: "user",
});
type DeleteOrResult = Awaited<typeof deleteOrResult>;
Expect<Equal<DeleteOrResult, null>>();

// Type test: prepared delete on Posts table
const deletePostsPreQuery = prequery(
  { postId: Posts.id.arg(), userId: Posts.userId.arg() },
  (args) => {
    return db
      .prepare()
      .delete(Posts)
      .where(and(eq(Posts.id, args.postId), eq(Posts.userId, args.userId)));
  },
);

const deletePostsPreResult = deletePostsPreQuery.run(db, {
  postId: 1,
  userId: 1,
});
type DeletePostsPreResult = Awaited<typeof deletePostsPreResult>;
Expect<Equal<DeletePostsPreResult, null>>();

// Negative type tests for delete

const wrongDeleteArgType = prequery({ id: Users.id.arg() }, (args) =>
  db.prepare().delete(Users).where(eq(Users.id, args.id)),
);
// @ts-expect-error - Wrong argument type for delete should not compile
wrongDeleteArgType.run(db, { id: "string_instead_of_number" });

const missingDeleteArg = prequery(
  { id: Users.id.arg(), type: Users.type.arg() },
  (args) =>
    db
      .prepare()
      .delete(Users)
      .where(and(eq(Users.id, args.id), eq(Users.type, args.type))),
);
// @ts-expect-error - Missing required argument for delete should not compile
missingDeleteArg.run(db, { id: 1 });
