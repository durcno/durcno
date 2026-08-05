import { and, asc, count, eq, lower, or, prepare } from "durcno";
import { Comments, db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// ============================================================================
// Section 1: Prepared Select Queries
// ============================================================================

// Basic prepared query with single argument
const _basicSelectQuery = prepare(
  { username: Users.username.arg() },
  (args) => {
    return db
      .prepare()
      .from(Users)
      .select()
      .where(eq(Users.username, args.username));
  },
);
const _basicSelectResult = _basicSelectQuery.run(db, { username: "john" });
type BasicSelectResult = Awaited<typeof _basicSelectResult>;
Expect<
  Equal<
    BasicSelectResult,
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

// Prepared query with multiple arguments
const _multiArgSelectQuery = prepare(
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
const _multiArgSelectResult = _multiArgSelectQuery.run(db, {
  username: "john",
  email: "john@example.com",
  type: "admin",
});
type MultiArgSelectResult = Awaited<typeof _multiArgSelectResult>;
Expect<
  Equal<
    MultiArgSelectResult,
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

// Prepared query with selective column selection
const _selectiveSelectQuery = prepare({ id: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .from(Users)
    .select({ username: Users.username, email: Users.email })
    .where(eq(Users.id, args.id));
});
const _selectiveSelectResult = _selectiveSelectQuery.run(db, { id: 1n });
type SelectiveSelectResult = Awaited<typeof _selectiveSelectResult>;
Expect<
  Equal<SelectiveSelectResult, { username: string; email: string | null }[]>
>();

// Prepared query with numeric argument
const _numericSelectQuery = prepare({ userId: Users.id.arg() }, (args) => {
  return db.prepare().from(Posts).select().where(eq(Posts.userId, args.userId));
});
const _numericSelectResult = _numericSelectQuery.run(db, { userId: 1n });
type NumericSelectResult = Awaited<typeof _numericSelectResult>;
Expect<
  Equal<
    NumericSelectResult,
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

// Prepared query with OR condition
const _orSelectQuery = prepare(
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
const _orSelectResult = _orSelectQuery.run(db, {
  username1: "john",
  username2: "jane",
});
type OrSelectResult = Awaited<typeof _orSelectResult>;
Expect<Equal<OrSelectResult, { id: bigint; username: string }[]>>();

// Prepared query with enum argument
const _enumSelectQuery = prepare({ userType: Users.type.arg() }, (args) => {
  return db
    .prepare()
    .from(Users)
    .select({ id: Users.id, type: Users.type })
    .where(eq(Users.type, args.userType));
});
const _enumSelectResult = _enumSelectQuery.run(db, { userType: "admin" });
type EnumSelectResult = Awaited<typeof _enumSelectResult>;
Expect<Equal<EnumSelectResult, { id: bigint; type: "admin" | "user" }[]>>();

// Prepared query with nullable column argument
const _nullableSelectQuery = prepare({ email: Users.email.arg() }, (args) => {
  return db.prepare().from(Users).select().where(eq(Users.email, args.email));
});
const _nullableSelectResult = _nullableSelectQuery.run(db, {
  email: "test@example.com",
});
type NullableSelectResult = Awaited<typeof _nullableSelectResult>;
Expect<
  Equal<
    NullableSelectResult,
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

// Prepared query with complex AND/OR conditions
const _complexSelectQuery = prepare(
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
const _complexSelectResult = _complexSelectQuery.run(db, {
  username: "john",
  type1: "admin",
  type2: "user",
});
type ComplexSelectResult = Awaited<typeof _complexSelectResult>;
Expect<
  Equal<ComplexSelectResult, { username: string; type: "admin" | "user" }[]>
>();

// Prepared query on Posts table
const _postsSelectQuery = prepare(
  { postId: Posts.id.arg(), userId: Posts.userId.arg() },
  (args) => {
    return db
      .prepare()
      .from(Posts)
      .select({ title: Posts.title, content: Posts.content })
      .where(and(eq(Posts.id, args.postId), eq(Posts.userId, args.userId)));
  },
);
const _postsSelectResult = _postsSelectQuery.run(db, {
  postId: 1n,
  userId: 1n,
});
type PostsSelectResult = Awaited<typeof _postsSelectResult>;
Expect<
  Equal<PostsSelectResult, { title: string | null; content: string | null }[]>
>();

// Prepared query on Comments table
const _commentsSelectQuery = prepare(
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
const _commentsSelectResult = _commentsSelectQuery.run(db, {
  postId: 1n,
  userId: 1n,
});
type CommentsSelectResult = Awaited<typeof _commentsSelectResult>;
Expect<
  Equal<
    CommentsSelectResult,
    {
      id: bigint;
      postId: bigint;
      userId: bigint;
      body: string | null;
      createdAt: Date;
    }[]
  >
>();

// Prepared query selecting single column
const _singleColumnSelectQuery = prepare({ id: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .from(Users)
    .select({ username: Users.username })
    .where(eq(Users.id, args.id));
});
const _singleColumnSelectResult = _singleColumnSelectQuery.run(db, {
  id: 1n,
});
type SingleColumnSelectResult = Awaited<typeof _singleColumnSelectResult>;
Expect<Equal<SingleColumnSelectResult, { username: string }[]>>();

// Prepared query with timestamp argument
const _timestampSelectQuery = prepare(
  { createdAt: Users.createdAt.arg() },
  (args) => {
    return db
      .prepare()
      .from(Users)
      .select({ id: Users.id, createdAt: Users.createdAt })
      .where(eq(Users.createdAt, args.createdAt));
  },
);
const _timestampSelectResult = _timestampSelectQuery.run(db, {
  createdAt: new Date(),
});
type TimestampSelectResult = Awaited<typeof _timestampSelectResult>;
Expect<Equal<TimestampSelectResult, { id: bigint; createdAt: Date }[]>>();

// Prepared query with SqlFn in select, groupBy, and orderBy
const _sqlFnSelectQuery = prepare({ userType: Users.type.arg() }, (args) => {
  return db
    .prepare()
    .from(Users)
    .select({
      total: count("*"),
      uname: lower(Users.username),
    })
    .where(eq(Users.type, args.userType))
    .groupBy(lower(Users.username))
    .orderBy(asc(lower(Users.username)));
});
const _sqlFnSelectResult = _sqlFnSelectQuery.run(db, { userType: "admin" });
type SqlFnSelectResult = Awaited<typeof _sqlFnSelectResult>;
Expect<
  Equal<
    SqlFnSelectResult,
    {
      total: number;
      uname: string;
    }[]
  >
>();

// ============================================================================
// Section 2: Prepared Update Queries
// ============================================================================

// Basic prepared update with single argument
const _updateBasicQuery = prepare({ userId: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .update(Users)
    .set({ username: "updated_name" })
    .where(eq(Users.id, args.userId));
});
const _updateBasicResult = _updateBasicQuery.run(db, { userId: 1n });
type UpdateBasicResult = Awaited<typeof _updateBasicResult>;
Expect<Equal<UpdateBasicResult, null>>();

// Prepared update with multiple arguments
const _updateMultiArgQuery = prepare(
  { userId: Users.id.arg(), userType: Users.type.arg() },
  (args) => {
    return db
      .prepare()
      .update(Users)
      .set({ email: "new@example.com" })
      .where(and(eq(Users.id, args.userId), eq(Users.type, args.userType)));
  },
);
const _updateMultiArgResult = _updateMultiArgQuery.run(db, {
  userId: 1n,
  userType: "admin",
});
type UpdateMultiArgResult = Awaited<typeof _updateMultiArgResult>;
Expect<Equal<UpdateMultiArgResult, null>>();

// Prepared update with returning
const _updateReturningQuery = prepare({ userId: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .update(Users)
    .set({ username: "updated" })
    .where(eq(Users.id, args.userId))
    .returning({ id: true, username: true });
});
const _updateReturningResult = _updateReturningQuery.run(db, { userId: 1n });
type UpdateReturningResult = Awaited<typeof _updateReturningResult>;
Expect<Equal<UpdateReturningResult, { id: bigint; username: string }[]>>();

// Prepared update with OR condition
const _updateOrQuery = prepare(
  { type1: Users.type.arg(), type2: Users.type.arg() },
  (args) => {
    return db
      .prepare()
      .update(Users)
      .set({ email: "batch@example.com" })
      .where(or(eq(Users.type, args.type1), eq(Users.type, args.type2)));
  },
);
const _updateOrResult = _updateOrQuery.run(db, {
  type1: "admin",
  type2: "user",
});
type UpdateOrResult = Awaited<typeof _updateOrResult>;
Expect<Equal<UpdateOrResult, null>>();

// Prepared update on Posts table
const _updatePostsQuery = prepare(
  { postId: Posts.id.arg(), userId: Posts.userId.arg() },
  (args) => {
    return db
      .prepare()
      .update(Posts)
      .set({ title: "Updated Title" })
      .where(and(eq(Posts.id, args.postId), eq(Posts.userId, args.userId)));
  },
);
const _updatePostsResult = _updatePostsQuery.run(db, {
  postId: 1n,
  userId: 1n,
});
type UpdatePostsResult = Awaited<typeof _updatePostsResult>;
Expect<Equal<UpdatePostsResult, null>>();

// ============================================================================
// Section 3: Prepared Delete Queries
// ============================================================================

// Basic prepared delete with single argument
const _deleteBasicQuery = prepare({ userId: Users.id.arg() }, (args) => {
  return db.prepare().delete(Users).where(eq(Users.id, args.userId));
});
const _deleteBasicResult = _deleteBasicQuery.run(db, { userId: 1n });
type DeleteBasicResult = Awaited<typeof _deleteBasicResult>;
Expect<Equal<DeleteBasicResult, null>>();

// Prepared delete with multiple arguments
const _deleteMultiArgQuery = prepare(
  { userId: Users.id.arg(), userType: Users.type.arg() },
  (args) => {
    return db
      .prepare()
      .delete(Users)
      .where(and(eq(Users.id, args.userId), eq(Users.type, args.userType)));
  },
);
const _deleteMultiArgResult = _deleteMultiArgQuery.run(db, {
  userId: 1n,
  userType: "admin",
});
type DeleteMultiArgResult = Awaited<typeof _deleteMultiArgResult>;
Expect<Equal<DeleteMultiArgResult, null>>();

// Prepared delete with returning
const _deleteReturningQuery = prepare({ userId: Users.id.arg() }, (args) => {
  return db
    .prepare()
    .delete(Users)
    .where(eq(Users.id, args.userId))
    .returning({ id: true, username: true });
});
const _deleteReturningResult = _deleteReturningQuery.run(db, { userId: 1n });
type DeleteReturningResult = Awaited<typeof _deleteReturningResult>;
Expect<Equal<DeleteReturningResult, { id: bigint; username: string }[]>>();

// Prepared delete with OR condition
const _deleteOrQuery = prepare(
  { type1: Users.type.arg(), type2: Users.type.arg() },
  (args) => {
    return db
      .prepare()
      .delete(Users)
      .where(or(eq(Users.type, args.type1), eq(Users.type, args.type2)));
  },
);
const _deleteOrResult = _deleteOrQuery.run(db, {
  type1: "admin",
  type2: "user",
});
type DeleteOrResult = Awaited<typeof _deleteOrResult>;
Expect<Equal<DeleteOrResult, null>>();

// Prepared delete on Posts table
const _deletePostsQuery = prepare(
  { postId: Posts.id.arg(), userId: Posts.userId.arg() },
  (args) => {
    return db
      .prepare()
      .delete(Posts)
      .where(and(eq(Posts.id, args.postId), eq(Posts.userId, args.userId)));
  },
);
const _deletePostsResult = _deletePostsQuery.run(db, {
  postId: 1n,
  userId: 1n,
});
type DeletePostsResult = Awaited<typeof _deletePostsResult>;
Expect<Equal<DeletePostsResult, null>>();

// ============================================================================
// Section 4: Prepared Shortcut ($) Queries
// ============================================================================

// $count with Arg in WHERE
const _countPreparedQuery = prepare({ userType: Users.type.arg() }, (args) => {
  return db.prepare().$count(Users, eq(Users.type, args.userType));
});
const _countPreparedResult = _countPreparedQuery.run(db, { userType: "admin" });
type CountPreparedResult = Awaited<typeof _countPreparedResult>;
Expect<Equal<CountPreparedResult, number>>();

// $exists with Arg in WHERE
const _existsPreparedQuery = prepare(
  { username: Users.username.arg() },
  (args) => {
    return db.prepare().$exists(Users, eq(Users.username, args.username));
  },
);
const _existsPreparedResult = _existsPreparedQuery.run(db, {
  username: "john",
});
type ExistsPreparedResult = Awaited<typeof _existsPreparedResult>;
Expect<Equal<ExistsPreparedResult, boolean>>();

// $first with Arg in WHERE
const _firstPreparedQuery = prepare({ userId: Users.id.arg() }, (args) => {
  return db.prepare().$first(Users, eq(Users.id, args.userId));
});
const _firstPreparedResult = _firstPreparedQuery.run(db, { userId: 1n });
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

// $sum with Arg in WHERE
const _sumPreparedQuery = prepare({ userType: Users.type.arg() }, (args) => {
  return db.prepare().$sum(Users, Users.id, eq(Users.type, args.userType));
});
const _sumPreparedResult = _sumPreparedQuery.run(db, { userType: "admin" });
type SumPreparedResult = Awaited<typeof _sumPreparedResult>;
Expect<Equal<SumPreparedResult, number | null>>();

// $avg with Arg in WHERE
const _avgPreparedQuery = prepare({ userType: Users.type.arg() }, (args) => {
  return db.prepare().$avg(Users, Users.id, eq(Users.type, args.userType));
});
const _avgPreparedResult = _avgPreparedQuery.run(db, { userType: "user" });
type AvgPreparedResult = Awaited<typeof _avgPreparedResult>;
Expect<Equal<AvgPreparedResult, number | null>>();

// $min with Arg in WHERE
const _minPreparedQuery = prepare({ userType: Users.type.arg() }, (args) => {
  return db.prepare().$min(Users, Users.id, eq(Users.type, args.userType));
});
const _minPreparedResult = _minPreparedQuery.run(db, { userType: "admin" });
type MinPreparedResult = Awaited<typeof _minPreparedResult>;
Expect<Equal<MinPreparedResult, number | null>>();

// $max with Arg in WHERE
const _maxPreparedQuery = prepare({ userType: Users.type.arg() }, (args) => {
  return db.prepare().$max(Users, Users.id, eq(Users.type, args.userType));
});
const _maxPreparedResult = _maxPreparedQuery.run(db, { userType: "user" });
type MaxPreparedResult = Awaited<typeof _maxPreparedResult>;
Expect<Equal<MaxPreparedResult, number | null>>();

// $distinct with Arg in WHERE
const _distinctPreparedQuery = prepare(
  { userType: Users.type.arg() },
  (args) => {
    return db
      .prepare()
      .$distinct(Users, Users.email, eq(Users.type, args.userType));
  },
);
const _distinctPreparedResult = _distinctPreparedQuery.run(db, {
  userType: "admin",
});
type DistinctPreparedResult = Awaited<typeof _distinctPreparedResult>;
Expect<Equal<DistinctPreparedResult, (string | null)[]>>();

// ============================================================================
// Section 5: Negative Type Safety Tests
// ============================================================================

// Wrong argument type at runtime for select
const _wrongArgTypeQuery = prepare({ id: Users.id.arg() }, (args) =>
  db.prepare().from(Users).select().where(eq(Users.id, args.id)),
);
// @ts-expect-error - Wrong argument type at runtime should not compile
_wrongArgTypeQuery.run(db, { id: "string_instead_of_number" });

// Missing required argument for select
const _missingArgQuery = prepare(
  { username: Users.username.arg(), type: Users.type.arg() },
  (args) =>
    db
      .prepare()
      .from(Users)
      .select()
      .where(and(eq(Users.username, args.username), eq(Users.type, args.type))),
);
// @ts-expect-error - Missing required argument should not compile
_missingArgQuery.run(db, { username: "test" });

// Invalid enum value at runtime for select
const _enumArgQuery = prepare({ type: Users.type.arg() }, (args) =>
  db.prepare().from(Users).select().where(eq(Users.type, args.type)),
);
// @ts-expect-error - Invalid enum value at runtime should not compile
_enumArgQuery.run(db, { type: "invalid_type" });

// Wrong type for bigint argument
const _bigintArgQuery = prepare({ userId: Posts.userId.arg() }, (args) =>
  db.prepare().from(Posts).select().where(eq(Posts.userId, args.userId)),
);
// @ts-expect-error - Wrong type for bigint argument should not compile
_bigintArgQuery.run(db, { userId: "not_a_number" });

// Extra argument for select
const _extraArgQuery = prepare({ id: Users.id.arg() }, (args) =>
  db.prepare().from(Users).select().where(eq(Users.id, args.id)),
);
// @ts-expect-error - Extra argument should not compile
_extraArgQuery.run(db, { id: 1n, extra: "unused" });

// Wrong argument type for update
const _wrongUpdateArgType = prepare({ id: Users.id.arg() }, (args) =>
  db
    .prepare()
    .update(Users)
    .set({ username: "test" })
    .where(eq(Users.id, args.id)),
);
// @ts-expect-error - Wrong argument type for update should not compile
_wrongUpdateArgType.run(db, { id: "string_instead_of_number" });

// Missing required argument for update
const _missingUpdateArg = prepare(
  { id: Users.id.arg(), type: Users.type.arg() },
  (args) =>
    db
      .prepare()
      .update(Users)
      .set({ username: "test" })
      .where(and(eq(Users.id, args.id), eq(Users.type, args.type))),
);
// @ts-expect-error - Missing required argument for update should not compile
_missingUpdateArg.run(db, { id: 1n });

// Wrong argument type for delete
const _wrongDeleteArgType = prepare({ id: Users.id.arg() }, (args) =>
  db.prepare().delete(Users).where(eq(Users.id, args.id)),
);
// @ts-expect-error - Wrong argument type for delete should not compile
_wrongDeleteArgType.run(db, { id: "string_instead_of_number" });

// Missing required argument for delete
const _missingDeleteArg = prepare(
  { id: Users.id.arg(), type: Users.type.arg() },
  (args) =>
    db
      .prepare()
      .delete(Users)
      .where(and(eq(Users.id, args.id), eq(Users.type, args.type))),
);
// @ts-expect-error - Missing required argument for delete should not compile
_missingDeleteArg.run(db, { id: 1n });

// Arg<T> must NOT be accepted in non-prepare shortcuts:

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
