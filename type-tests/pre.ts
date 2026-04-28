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

// Type test: prepared query with selective column selection
const selectiveQuery = prequery({ id: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .from(Users)
    .select({ username: Users.username, email: Users.email })
    .where(eq(Users.id, args.id));
});

const selectiveResult = selectiveQuery.run(db, { id: 1n });
type SelectiveResult = Awaited<typeof selectiveResult>;
Expect<Equal<SelectiveResult, { username: string; email: string | null }[]>>();

// Type test: prepared query with numeric argument
const numericQuery = prequery({ userId: Users.id.arg() }, (args) => {
  return db.prepare().from(Posts).select().where(eq(Posts.userId, args.userId));
});

const numericResult = numericQuery.run(db, { userId: 1n });
type NumericResult = Awaited<typeof numericResult>;
Expect<
  Equal<
    NumericResult,
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
Expect<Equal<OrResult, { id: bigint; username: string }[]>>();

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
Expect<Equal<EnumResult, { id: bigint; type: "admin" | "user" }[]>>();

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

const postsResult = postsQuery.run(db, { postId: 1n, userId: 1n });
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

const commentsResult = commentsQuery.run(db, { postId: 1n, userId: 1n });
type CommentsResult = Awaited<typeof commentsResult>;
Expect<
  Equal<
    CommentsResult,
    {
      id: bigint;
      postId: bigint;
      userId: bigint;
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

const singleColumnResult = singleColumnQuery.run(db, { id: 1n });
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
Expect<Equal<TimestampResult, { id: bigint; createdAt: Date }[]>>();

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
extraArgQuery.run(db, { id: 1n, extra: "unused" });

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

const updateBasicResult = updateBasicQuery.run(db, { userId: 1n });
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
  userId: 1n,
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

const updateReturningResult = updateReturningQuery.run(db, { userId: 1n });
type UpdateReturningResult = Awaited<typeof updateReturningResult>;
Expect<Equal<UpdateReturningResult, { id: bigint; username: string }[]>>();

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

const updatePostsResult = updatePostsQuery.run(db, { postId: 1n, userId: 1n });
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
missingUpdateArg.run(db, { id: 1n });

// ============================================================================
// Delete prepared query type tests
// ============================================================================

// Type test: basic prepared delete with single argument
const deleteBasicQuery = prequery({ userId: Users.id.arg() }, (args) => {
  return db.prepare().delete(Users).where(eq(Users.id, args.userId));
});

const deleteBasicResult = deleteBasicQuery.run(db, { userId: 1n });
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
  userId: 1n,
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

const deleteReturningResult = deleteReturningQuery.run(db, { userId: 1n });
type DeleteReturningResult = Awaited<typeof deleteReturningResult>;
Expect<Equal<DeleteReturningResult, { id: bigint; username: string }[]>>();

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
  postId: 1n,
  userId: 1n,
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
missingDeleteArg.run(db, { id: 1n });

// ============================================================================
// Shortcut ($) prepared query type tests
// ============================================================================

// Type test: $count with Arg in WHERE
const countPreparedQuery = prequery({ userType: Users.type.arg() }, (args) => {
  return db.prepare().$count(Users, eq(Users.type, args.userType));
});
const _countPreparedResult = countPreparedQuery.run(db, { userType: "admin" });
type CountPreparedResult = Awaited<typeof _countPreparedResult>;
Expect<Equal<CountPreparedResult, number>>();

// Type test: $exists with Arg in WHERE
const existsPreparedQuery = prequery(
  { username: Users.username.arg() },
  (args) => {
    return db.prepare().$exists(Users, eq(Users.username, args.username));
  },
);
const _existsPreparedResult = existsPreparedQuery.run(db, { username: "john" });
type ExistsPreparedResult = Awaited<typeof _existsPreparedResult>;
Expect<Equal<ExistsPreparedResult, boolean>>();

// Type test: $first with Arg in WHERE
const firstPreparedQuery = prequery({ userId: Users.id.arg() }, (args) => {
  return db.prepare().$first(Users, eq(Users.id, args.userId));
});
const _firstPreparedResult = firstPreparedQuery.run(db, { userId: 1n });
type FirstPreparedResult = Awaited<typeof _firstPreparedResult>;
Expect<
  Equal<
    FirstPreparedResult,
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

// Type test: $sum with Arg in WHERE
const sumPreparedQuery = prequery({ userType: Users.type.arg() }, (args) => {
  return db.prepare().$sum(Users, Users.id, eq(Users.type, args.userType));
});
const _sumPreparedResult = sumPreparedQuery.run(db, { userType: "admin" });
type SumPreparedResult = Awaited<typeof _sumPreparedResult>;
Expect<Equal<SumPreparedResult, number | null>>();

// Type test: $avg with Arg in WHERE
const avgPreparedQuery = prequery({ userType: Users.type.arg() }, (args) => {
  return db.prepare().$avg(Users, Users.id, eq(Users.type, args.userType));
});
const _avgPreparedResult = avgPreparedQuery.run(db, { userType: "user" });
type AvgPreparedResult = Awaited<typeof _avgPreparedResult>;
Expect<Equal<AvgPreparedResult, number | null>>();

// Type test: $min with Arg in WHERE
const minPreparedQuery = prequery({ userType: Users.type.arg() }, (args) => {
  return db.prepare().$min(Users, Users.id, eq(Users.type, args.userType));
});
const _minPreparedResult = minPreparedQuery.run(db, { userType: "admin" });
type MinPreparedResult = Awaited<typeof _minPreparedResult>;
Expect<Equal<MinPreparedResult, number | null>>();

// Type test: $max with Arg in WHERE
const maxPreparedQuery = prequery({ userType: Users.type.arg() }, (args) => {
  return db.prepare().$max(Users, Users.id, eq(Users.type, args.userType));
});
const _maxPreparedResult = maxPreparedQuery.run(db, { userType: "user" });
type MaxPreparedResult = Awaited<typeof _maxPreparedResult>;
Expect<Equal<MaxPreparedResult, number | null>>();

// Type test: $distinct with Arg in WHERE
const distinctPreparedQuery = prequery(
  { userType: Users.type.arg() },
  (args) => {
    return db
      .prepare()
      .$distinct(Users, Users.email, eq(Users.type, args.userType));
  },
);
const _distinctPreparedResult = distinctPreparedQuery.run(db, {
  userType: "admin",
});
type DistinctPreparedResult = Awaited<typeof _distinctPreparedResult>;
Expect<Equal<DistinctPreparedResult, (string | null)[]>>();

// Negative type tests: Arg<T> must NOT be accepted in non-prepare shortcuts

// @ts-expect-error - Arg is not allowed in $count without db.prepare()
db.$count(Users, eq(Users.type, Users.type.arg()));

// @ts-expect-error - Arg is not allowed in $exists without db.prepare()
db.$exists(Users, eq(Users.username, Users.username.arg()));

// @ts-expect-error - Arg is not allowed in $first without db.prepare()
db.$first(Users, eq(Users.id, Users.id.arg()));

// @ts-expect-error - Arg is not allowed in $sum without db.prepare()
db.$sum(Users, Users.id, eq(Users.type, Users.type.arg()));

// @ts-expect-error - Arg is not allowed in $distinct without db.prepare()
db.$distinct(Users, Users.email, eq(Users.type, Users.type.arg()));
