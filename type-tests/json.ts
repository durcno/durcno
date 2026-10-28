import {
  asc,
  avg,
  caseWhen,
  coalesce,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  jsonAgg,
  jsonBuildArray,
  jsonBuildObject,
  jsonbAgg,
  jsonbBuildArray,
  jsonStripNulls,
  round,
  toJson,
  toJsonb,
} from "durcno";
import { Comments, db, Posts, Users } from "./schema";
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
// JSON object builders
// -----------------------------------------------------------------------------

const objectQuery = db.from(Users).select(() => ({
  userObj: jsonBuildObject({
    id: Users.id,
    username: Users.username,
    email: Users.email,
  }),
}));
type ObjectResult = Awaited<typeof objectQuery>;
Expect<
  Equal<
    ObjectResult,
    {
      userObj: { id: bigint; username: string; email: string | null };
    }[]
  >
>();

// Nested objects keep every level's types
const nestedObjectQuery = db.from(Posts).select(() => ({
  postWithMeta: jsonBuildObject({
    id: Posts.id,
    title: Posts.title,
    extra: jsonBuildObject({
      views: 100,
      active: true,
    }),
  }),
}));
type NestedObjectResult = Awaited<typeof nestedObjectQuery>;
Expect<
  Equal<
    NestedObjectResult,
    {
      postWithMeta: {
        id: bigint;
        title: string | null;
        extra: { views: number; active: boolean };
      };
    }[]
  >
>();

db.from(Users)
  // @ts-expect-error - Comments is not joined in the query
  .select(() => ({
    invalidObj: jsonBuildObject({
      commentId: Comments.id,
      username: Users.username,
    }),
  }));

// -----------------------------------------------------------------------------
// JSON aggregates
// -----------------------------------------------------------------------------

const aggregateQuery = db.from(Users).select(() => ({
  usernames: jsonAgg(Users.username),
  ids: jsonbAgg(Users.id),
}));
type AggregateResult = Awaited<typeof aggregateQuery>;
Expect<
  Equal<AggregateResult, { usernames: string[] | null; ids: bigint[] | null }[]>
>();

// .orderBy() and .filter()
const filteredAggregateQuery = db.from(Posts).select(() => ({
  recentTitles: jsonAgg(Posts.title)
    .orderBy(desc(Posts.createdAt))
    .filter(isNotNull(Posts.title)),
}));
type FilteredAggregate = Awaited<typeof filteredAggregateQuery>;
Expect<
  Equal<FilteredAggregate, { recentTitles: (string | null)[] | null }[]>
>();

// coalesce makes the array non-null
const coalescedAggregateQuery = db.from(Users).select(() => ({
  names: coalesce(
    jsonAgg(Users.username).filter(isNotNull(Users.username)),
    [],
  ),
}));
type CoalescedAggregate = Awaited<typeof coalescedAggregateQuery>;
Expect<Equal<CoalescedAggregate, { names: string[] }[]>>();

// A scalar wrapper remains a valid aggregate operand
const _jsonAggScalar = jsonAgg(round(Users.id, 2));

// A scalar order item is valid
const validOrder = jsonAgg(Users.username).orderBy(asc(Users.createdAt));
Expect<
  Equal<
    (typeof validOrder.$)["Columns"],
    typeof Users.username | typeof Users.createdAt
  >
>();
Expect<Equal<(typeof validOrder.$)["HasArg"], false>>();

// .filter() keeps the aggregate kind and tracks Args
const countFiltered = count(Users.id).filter(eq(Users.type, "admin"));
Expect<Equal<(typeof countFiltered._)["sqlFnType"], "aggregate">>();
Expect<Equal<(typeof countFiltered.$)["HasArg"], false>>();

const countWithArg = count(Users.id).filter(
  eq(Users.username, Users.username.arg()),
);
Expect<Equal<(typeof countWithArg.$)["HasArg"], true>>();

// @ts-expect-error - json_agg cannot take an aggregate operand
jsonAgg(avg(Users.id));

// @ts-expect-error - jsonb_agg cannot take an aggregate operand
jsonbAgg(count("*"));

// @ts-expect-error - bare aggregate in an aggregate's ORDER BY
jsonAgg(Users.username).orderBy(asc(count("*")));

// @ts-expect-error - wrapped aggregate in an aggregate's ORDER BY
jsonAgg(Users.username).orderBy(asc(round(avg(Users.id), 1)));

db.from(Users)
  // @ts-expect-error - Comments is not joined in the query
  .select(() => ({ invalidAgg: jsonAgg(Comments.id) }));

db.from(Users)
  // @ts-expect-error - ORDER BY column must be in the query scope
  .select(() => ({
    invalidOrder: jsonAgg(Users.username).orderBy(asc(Comments.id)),
  }));

// -----------------------------------------------------------------------------
// caseWhen
// -----------------------------------------------------------------------------

const caseQuery = db.from(Users).select(() => ({
  roleLabel: caseWhen(eq(Users.type, "admin"), "Admin User")
    .when(eq(Users.type, "user"), "Regular User")
    .else("Guest"),
}));
type CaseResult = Awaited<typeof caseQuery>;
Expect<
  Equal<CaseResult, { roleLabel: "Admin User" | "Regular User" | "Guest" }[]>
>();

// Without `.else()` the branch types stay nullable
const caseDirectQuery = db.from(Users).select(() => ({
  directBadge: caseWhen(eq(Users.type, "admin"), "Administrator"),
}));
type CaseDirectResult = Awaited<typeof caseDirectQuery>;
Expect<Equal<CaseDirectResult, { directBadge: "Administrator" | null }[]>>();

// A column and a literal branch widen to their common type
const caseMixedQuery = db.from(Users).select(() => ({
  mixedLabel: caseWhen(eq(Users.type, "admin"), Users.username).else(
    "Anonymous",
  ),
}));
type CaseMixedResult = Awaited<typeof caseMixedQuery>;
Expect<Equal<CaseMixedResult, { mixedLabel: string }[]>>();

// -----------------------------------------------------------------------------
// JSON builders and strips
// -----------------------------------------------------------------------------

const arrayQuery = db.from(Users).select(() => ({
  tuple: jsonBuildArray(Users.id, Users.username),
  stripped: jsonStripNulls(
    jsonBuildObject({ id: Users.id, email: Users.email }),
  ),
}));
type ArrayResult = Awaited<typeof arrayQuery>;
Expect<
  Equal<
    ArrayResult,
    {
      tuple: [bigint, string];
      stripped: { id: bigint; email: string | null };
    }[]
  >
>();

// toJson / toJsonb on a whole table
const toJsonQuery = db.from(Users).select(() => ({
  userJson: toJson(Users),
  userJsonb: toJsonb(Users),
}));
type ToJsonResult = Awaited<typeof toJsonQuery>;
Expect<Equal<ToJsonResult, { userJson: UserRow; userJsonb: UserRow }[]>>();

// -----------------------------------------------------------------------------
// Decoded driver values
// -----------------------------------------------------------------------------

// JSON arrays decode to a tuple
const jsonArrayDecoded = jsonBuildArray(Users.id, Users.username);
type JsonArrayDecoded = ReturnType<typeof jsonArrayDecoded.fromDriverValue>;
Expect<Equal<JsonArrayDecoded, [bigint, string] | null>>();

const jsonbArrayDecoded = jsonbBuildArray(Users.id, Users.username);
type JsonbArrayDecoded = ReturnType<typeof jsonbArrayDecoded.fromDriverValue>;
Expect<Equal<JsonbArrayDecoded, [bigint, string] | null>>();

// A whole table, a record, and literals keep their types
const toJsonUsers = toJson(Users);
type ToJsonUsersDecoded = ReturnType<typeof toJsonUsers.fromDriverValue>;
Expect<Equal<ToJsonUsersDecoded, UserRow | null>>();

const toJsonRecord = toJson({
  id: Users.id,
  username: Users.username,
  count: 5n,
  at: new Date(),
  nested: jsonBuildObject({ id: Users.id }),
});
type ToJsonRecordDecoded = ReturnType<typeof toJsonRecord.fromDriverValue>;
Expect<
  Equal<
    ToJsonRecordDecoded,
    {
      id: bigint;
      username: string;
      count: bigint;
      at: Date;
      nested: { id: bigint };
    } | null
  >
>();

// SQL functions, dates, arrays, and prepared arguments keep their types
const toJsonFn = toJson(jsonBuildObject({ id: Users.id }));
Expect<
  Equal<ReturnType<typeof toJsonFn.fromDriverValue>, { id: bigint } | null>
>();

const toJsonDate = toJson(new Date());
Expect<Equal<ReturnType<typeof toJsonDate.fromDriverValue>, Date | null>>();

const toJsonArray = toJson([Users.id, Users.username]);
Expect<
  Equal<
    ReturnType<typeof toJsonArray.fromDriverValue>,
    (bigint | string)[] | null
  >
>();

const toJsonArg = toJson(Users.username.arg());
Expect<Equal<ReturnType<typeof toJsonArg.fromDriverValue>, string | null>>();

const argJsonAgg = jsonAgg(Users.id.arg());
Expect<Equal<ReturnType<typeof argJsonAgg.fromDriverValue>, bigint[] | null>>();

// Date handling in caseWhen
const caseDate = caseWhen(eq(Users.id, 1n), new Date()).else(new Date());
Expect<Equal<ReturnType<typeof caseDate.fromDriverValue>, Date | null>>();

// -----------------------------------------------------------------------------
// Complete LEFT JOIN pattern
// -----------------------------------------------------------------------------

const fullJoinQuery = db
  .from(Posts)
  .leftJoin(Users)
  .on(() => eq(Users.id, Posts.userId))
  .leftJoin(Comments)
  .on(() => eq(Comments.postId, Posts.id))
  .select(({ users, comments }) => ({
    id: Posts.id,
    title: Posts.title,
    author: caseWhen(isNull(users.id), null).else(
      jsonBuildObject({
        id: users.id,
        username: users.username,
      }),
    ),
    comments: coalesce(
      jsonAgg(
        jsonBuildObject({
          id: comments.id,
          body: comments.body,
        }),
      )
        .orderBy(asc(comments.createdAt))
        .filter(isNotNull(comments.id)),
      [],
    ),
  }));

type FullJoinResult = Awaited<typeof fullJoinQuery>;
Expect<
  Equal<
    FullJoinResult,
    {
      id: bigint;
      title: string | null;
      author: { id: bigint | null; username: string | null } | null;
      comments: { id: bigint | null; body: string | null }[];
    }[]
  >
>();
