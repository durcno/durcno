import { and, asc, count, eq, lower, or, prepare } from "durcno";
import { db, Logs, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

type UserRow = {
  id: bigint;
  username: string;
  email: string | null;
  type: "admin" | "user";
  createdAt: Date;
  externalId: string;
  trackingId: string | null;
};

// -----------------------------------------------------------------------------
// Prepared selects
// -----------------------------------------------------------------------------

// A single argument
const _basicSelectQuery = prepare({ username: Users.username.arg() }, (args) =>
  db
    .prepare()
    .from(Users)
    .select("*")
    .where(() => eq(Users.username, args.username)),
);
type BasicSelectResult = Awaited<ReturnType<typeof _basicSelectQuery.run>>;
Expect<Equal<BasicSelectResult, UserRow[]>>();

// Multiple arguments, including nullable, enum, and Date columns
const _multiArgSelectQuery = prepare(
  {
    id: Users.id.arg(),
    email: Users.email.arg(),
    type: Users.type.arg(),
    createdAt: Users.createdAt.arg(),
  },
  (args) =>
    db
      .prepare()
      .from(Users)
      .select(() => ({
        id: Users.id,
        email: Users.email,
        type: Users.type,
        createdAt: Users.createdAt,
      }))
      .where(() =>
        and(
          eq(Users.id, args.id),
          eq(Users.email, args.email),
          eq(Users.type, args.type),
          eq(Users.createdAt, args.createdAt),
        ),
      ),
);
type MultiArgSelectResult = Awaited<
  ReturnType<typeof _multiArgSelectQuery.run>
>;
Expect<
  Equal<
    MultiArgSelectResult,
    {
      id: bigint;
      email: string | null;
      type: "admin" | "user";
      createdAt: Date;
    }[]
  >
>();

// OR conditions on another table
const _orSelectQuery = prepare(
  { postId: Posts.id.arg(), title: Posts.title.arg() },
  (args) =>
    db
      .prepare()
      .from(Posts)
      .select(() => ({ title: Posts.title, content: Posts.content }))
      .where(() => or(eq(Posts.id, args.postId), eq(Posts.title, args.title))),
);
type OrSelectResult = Awaited<ReturnType<typeof _orSelectQuery.run>>;
Expect<
  Equal<OrSelectResult, { title: string | null; content: string | null }[]>
>();

// @ts-expect-error - wrong argument type at runtime
_basicSelectQuery.run(db, { username: 123 });

// @ts-expect-error - missing required argument
_multiArgSelectQuery.run(db, { id: 1n });

_multiArgSelectQuery.run(db, {
  id: 1n,
  email: "john@example.com",
  // @ts-expect-error - invalid enum value at runtime
  type: "invalid_type",
  createdAt: new Date(),
});

// @ts-expect-error - extra argument
_basicSelectQuery.run(db, { username: "john", extra: "unused" });

// Scalar functions in select, groupBy, and orderBy
const _sqlFnSelectQuery = prepare({ userType: Users.type.arg() }, (args) =>
  db
    .prepare()
    .from(Users)
    .select(() => ({
      total: count("*"),
      uname: lower(Users.username),
    }))
    .where(() => eq(Users.type, args.userType))
    .groupBy(() => lower(Users.username))
    .orderBy(() => asc(lower(Users.username))),
);
type SqlFnSelectResult = Awaited<ReturnType<typeof _sqlFnSelectQuery.run>>;
Expect<Equal<SqlFnSelectResult, { total: number; uname: string }[]>>();

// -----------------------------------------------------------------------------
// Prepared inserts
// -----------------------------------------------------------------------------

// `$insertFn` columns accept prepared arguments
const _insertFnPreparedQuery = prepare(
  { message: Logs.message.arg(), updatedAt: Logs.updatedAt.arg() },
  (args) =>
    db
      .prepare()
      .insertInto(Logs)
      .values({
        message: args.message,
        updatedAt: args.updatedAt,
      })
      .returning("*"),
);
type InsertFnPreparedResult = Awaited<
  ReturnType<typeof _insertFnPreparedQuery.run>
>;
Expect<
  Equal<
    InsertFnPreparedResult,
    { id: bigint; message: string; createdAt: Date; updatedAt: Date }[]
  >
>();

// -----------------------------------------------------------------------------
// Prepared updates
// -----------------------------------------------------------------------------

const _updateQuery = prepare(
  { id: Users.id.arg(), type: Users.type.arg() },
  (args) =>
    db
      .prepare()
      .update(Users)
      .set({ username: "updated" })
      .where(and(eq(Users.id, args.id), eq(Users.type, args.type)))
      .returning({ id: true, username: true }),
);
type UpdateResult = Awaited<ReturnType<typeof _updateQuery.run>>;
Expect<Equal<UpdateResult, { id: bigint; username: string }[]>>();

// A table with `$updateFn` columns
const _updateFnQuery = prepare({ id: Logs.id.arg() }, (args) =>
  db
    .prepare()
    .update(Logs)
    .set({ message: "updated" })
    .where(eq(Logs.id, args.id))
    .returning({ id: true, message: true, updatedAt: true }),
);
type UpdateFnResult = Awaited<ReturnType<typeof _updateFnQuery.run>>;
Expect<
  Equal<UpdateFnResult, { id: bigint; message: string; updatedAt: Date }[]>
>();

// -----------------------------------------------------------------------------
// Prepared deletes
// -----------------------------------------------------------------------------

const _deleteQuery = prepare({ id: Users.id.arg() }, (args) =>
  db
    .prepare()
    .deleteFrom(Users)
    .where(eq(Users.id, args.id))
    .returning({ id: true, username: true }),
);
type DeleteResult = Awaited<ReturnType<typeof _deleteQuery.run>>;
Expect<Equal<DeleteResult, { id: bigint; username: string }[]>>();

// -----------------------------------------------------------------------------
// Prepared shortcuts
// -----------------------------------------------------------------------------

const _countPreparedQuery = prepare({ userType: Users.type.arg() }, (args) =>
  db.prepare().$count(Users, eq(Users.type, args.userType)),
);
Expect<Equal<Awaited<ReturnType<typeof _countPreparedQuery.run>>, number>>();

const _existsPreparedQuery = prepare(
  { username: Users.username.arg() },
  (args) => db.prepare().$exists(Users, eq(Users.username, args.username)),
);
Expect<Equal<Awaited<ReturnType<typeof _existsPreparedQuery.run>>, boolean>>();

const _firstPreparedQuery = prepare({ id: Users.id.arg() }, (args) =>
  db.prepare().$first(Users, eq(Users.id, args.id)),
);
Expect<
  Equal<Awaited<ReturnType<typeof _firstPreparedQuery.run>>, UserRow | null>
>();

const _sumPreparedQuery = prepare({ id: Users.id.arg() }, (args) =>
  db.prepare().$sum(Users, Users.id, eq(Users.id, args.id)),
);
Expect<
  Equal<Awaited<ReturnType<typeof _sumPreparedQuery.run>>, number | null>
>();

const _distinctPreparedQuery = prepare({ type: Users.type.arg() }, (args) =>
  db.prepare().$distinct(Users, Users.type, eq(Users.type, args.type)),
);
Expect<
  Equal<
    Awaited<ReturnType<typeof _distinctPreparedQuery.run>>,
    ("admin" | "user")[]
  >
>();

// Arg placeholders are refused outside `db.prepare()`
// @ts-expect-error - Arg is not allowed in $count without db.prepare()
db.$count(Users, eq(Users.type, Users.type.arg()));
