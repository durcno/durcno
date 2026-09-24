import {
  asc,
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
  toJson,
  toJsonb,
} from "durcno";
import { Comments, db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// ============================================================================
// jsonBuildObject & jsonbBuildObject
// ============================================================================

const objQuery = db.from(Users).select(() => ({
  userObj: jsonBuildObject({
    id: Users.id,
    username: Users.username,
    email: Users.email,
  }),
}));
type UserObjType = Awaited<typeof objQuery>;
Expect<
  Equal<
    UserObjType,
    {
      userObj: {
        id: bigint;
        username: string;
        email: string | null;
      };
    }[]
  >
>();

// Nested jsonBuildObject
const nestedObjQuery = db.from(Posts).select(() => ({
  postWithMeta: jsonBuildObject({
    id: Posts.id,
    title: Posts.title,
    extra: jsonBuildObject({
      views: 100,
      active: true,
    }),
  }),
}));
type NestedObjType = Awaited<typeof nestedObjQuery>;
Expect<
  Equal<
    NestedObjType,
    {
      postWithMeta: {
        id: bigint;
        title: string | null;
        extra: {
          views: number;
          active: boolean;
        };
      };
    }[]
  >
>();

// ============================================================================
// jsonAgg & jsonbAgg
// ============================================================================

const aggQuery = db.from(Users).select(() => ({
  usernames: jsonAgg(Users.username),
  ids: jsonbAgg(Users.id),
}));
type AggType = Awaited<typeof aggQuery>;
Expect<
  Equal<
    AggType,
    {
      usernames: string[] | null;
      ids: bigint[] | null;
    }[]
  >
>();

// jsonAgg with .orderBy() and .filter()
const filteredAggQuery = db.from(Posts).select(() => ({
  recentTitles: jsonAgg(Posts.title)
    .orderBy(desc(Posts.createdAt))
    .filter(isNotNull(Posts.title)),
}));
type FilteredAggType = Awaited<typeof filteredAggQuery>;
Expect<
  Equal<
    FilteredAggType,
    {
      recentTitles: (string | null)[] | null;
    }[]
  >
>();

// ============================================================================
// coalesce with jsonAgg -> guaranteed T[]
// ============================================================================

const coalescedQuery = db.from(Users).select(() => ({
  names: coalesce(
    jsonAgg(Users.username).filter(isNotNull(Users.username)),
    [],
  ),
}));
type CoalescedType = Awaited<typeof coalescedQuery>;
Expect<
  Equal<
    CoalescedType,
    {
      names: string[];
    }[]
  >
>();

// ============================================================================
// caseWhen builder
// ============================================================================

const caseQuery = db.from(Users).select(() => ({
  roleLabel: caseWhen(eq(Users.type, "admin"), "Admin User")
    .when(eq(Users.type, "user"), "Regular User")
    .else("Guest"),
}));
type CaseType = Awaited<typeof caseQuery>;
Expect<
  Equal<
    CaseType,
    {
      roleLabel: "Admin User" | "Regular User" | "Guest";
    }[]
  >
>();

// Direct caseWhen without .else() or .end() -> returns T | null
const caseDirectQuery = db.from(Users).select(() => ({
  directBadge: caseWhen(eq(Users.type, "admin"), "Administrator"),
}));
type CaseDirectType = Awaited<typeof caseDirectQuery>;
Expect<
  Equal<
    CaseDirectType,
    {
      directBadge: "Administrator" | null;
    }[]
  >
>();

// Direct multi-branch caseWhen without .else() or .end() -> returns (T1 | T2) | null
const caseDirectMultiQuery = db.from(Users).select(() => ({
  multiBadge: caseWhen(eq(Users.type, "admin"), "Admin User").when(
    eq(Users.type, "user"),
    "Regular User",
  ),
}));
type CaseDirectMultiType = Awaited<typeof caseDirectMultiQuery>;
Expect<
  Equal<
    CaseDirectMultiType,
    {
      multiBadge: "Admin User" | "Regular User" | null;
    }[]
  >
>();

// Mixed column and literal branches -> string
const caseMixedQuery = db.from(Users).select(() => ({
  mixedLabel: caseWhen(eq(Users.type, "admin"), Users.username).else(
    "Anonymous",
  ),
}));
type CaseMixedType = Awaited<typeof caseMixedQuery>;
Expect<
  Equal<
    CaseMixedType,
    {
      mixedLabel: string;
    }[]
  >
>();

// CASE ending with explicit .end() -> returns T | null
const caseNullQuery = db.from(Users).select(() => ({
  maybeLabel: caseWhen(eq(Users.type, "admin"), "Administrator").end(),
}));
type CaseNullType = Awaited<typeof caseNullQuery>;
Expect<
  Equal<
    CaseNullType,
    {
      maybeLabel: "Administrator" | null;
    }[]
  >
>();

// caseWhen with multiple numeric branches
const caseNumbersQuery = db.from(Users).select(() => ({
  score: caseWhen(eq(Users.type, "admin"), 10)
    .when(eq(Users.type, "user"), 1)
    .else(0),
}));
type CaseNumbersType = Awaited<typeof caseNumbersQuery>;
Expect<
  Equal<
    CaseNumbersType,
    {
      score: 10 | 1 | 0;
    }[]
  >
>();

// ============================================================================
// Complete LEFT JOIN query pattern
// ============================================================================

const fullJoinQuery = db
  .from(Posts)
  .leftJoin(Users, () => eq(Users.id, Posts.userId))
  .leftJoin(Comments, () => eq(Comments.postId, Posts.id))
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

type FullJoinType = Awaited<typeof fullJoinQuery>;
Expect<
  Equal<
    FullJoinType,
    {
      id: bigint;
      title: string | null;
      author: {
        id: bigint | null;
        username: string | null;
      } | null;
      comments: {
        id: bigint | null;
        body: string | null;
      }[];
    }[]
  >
>();

// ============================================================================
// toJson & toJsonb
// ============================================================================

const toJsonQuery = db.from(Users).select(() => ({
  userJson: toJson(Users),
  userJsonb: toJsonb(Users),
}));
type ToJsonType = Awaited<typeof toJsonQuery>;
Expect<
  Equal<
    ToJsonType,
    {
      userJson: {
        id: bigint;
        username: string;
        email: string | null;
        type: "admin" | "user";
        createdAt: Date;
        externalId: string;
        trackingId: string | null;
      };
      userJsonb: {
        id: bigint;
        username: string;
        email: string | null;
        type: "admin" | "user";
        createdAt: Date;
        externalId: string;
        trackingId: string | null;
      };
    }[]
  >
>();

// ============================================================================
// jsonBuildArray & jsonStripNulls
// ============================================================================

const arrQuery = db.from(Users).select(() => ({
  tuple: jsonBuildArray(Users.id, Users.username),
  stripped: jsonStripNulls(
    jsonBuildObject({ id: Users.id, email: Users.email }),
  ),
}));
type ArrType = Awaited<typeof arrQuery>;
Expect<
  Equal<
    ArrType,
    {
      tuple: [bigint, string];
      stripped: {
        id: bigint;
        email: string | null;
      };
    }[]
  >
>();

// ============================================================================
// Negative tests: scope enforcement
// ============================================================================

db.from(Users)
  // @ts-expect-error: Comments is not joined in query
  .select(() => ({
    invalidObj: jsonBuildObject({
      commentId: Comments.id,
      username: Users.username,
    }),
  }));

db.from(Users)
  // @ts-expect-error: Comments is not joined in query
  .select(() => ({
    invalidAgg: jsonAgg(Comments.id),
  }));

// Base aggregate .filter() works on count()
const countFiltered = count(Users.id).filter(eq(Users.type, "admin"));
Expect<Equal<typeof countFiltered.isAggregate, true>>();
Expect<Equal<typeof countFiltered.$HasArg, false>>();

// Propagating THasArg in AggregateSqlFn.filter()
const countWithArg = count(Users.id).filter(
  eq(Users.username, Users.username.arg()),
);
Expect<Equal<typeof countWithArg.$HasArg, true>>();

// Strongly typed fromDriverValue without any in JsonBuildArrayFn and JsonbBuildArrayFn
const jba = jsonBuildArray(Users.id, Users.username);
type JbaFrom = ReturnType<typeof jba.fromDriverValue>;
Expect<Equal<JbaFrom, [bigint, string] | null>>();

const jbba = jsonbBuildArray(Users.id, Users.username);
type JbbaFrom = ReturnType<typeof jbba.fromDriverValue>;
Expect<Equal<JbbaFrom, [bigint, string] | null>>();

// Plain object literals in jsonBuildArray and caseWhen
const arrWithObj = jsonBuildArray({ role: "admin" }, Users.id);
type ArrWithObjFrom = ReturnType<typeof arrWithObj.fromDriverValue>;
Expect<Equal<ArrWithObjFrom, [{ role: string }, bigint] | null>>();

const caseWithObj = caseWhen(eq(Users.id, 1n), { role: "admin" }).else({
  role: "user",
});
type CaseObjFrom = ReturnType<typeof caseWithObj.fromDriverValue>;
Expect<Equal<CaseObjFrom, { role: string } | null>>();

// toJson and toJsonb directly on table
const toJsonUsers = toJson(Users);
type ToJsonUsersType = ReturnType<typeof toJsonUsers.fromDriverValue>;
Expect<
  Equal<
    ToJsonUsersType,
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

// Date handling in caseWhen and coalesce
const caseDate = caseWhen(eq(Users.id, 1n), new Date()).else(new Date());
type CaseDateFrom = ReturnType<typeof caseDate.fromDriverValue>;
Expect<Equal<CaseDateFrom, Date | null>>();

const coalesceDate = coalesce(Users.createdAt, new Date());
type CoalesceDateType = ReturnType<typeof coalesceDate.fromDriverValue>;
Expect<Equal<CoalesceDateType, Date | null>>();

// AggregateSqlFn.orderBy() scope enforcement
db.from(Users)
  // @ts-expect-error: Comments is not joined in query
  .select(() => ({
    invalidOrder: jsonAgg(Users.username).orderBy(asc(Comments.id)),
  }));

const validOrder = jsonAgg(Users.username).orderBy(asc(Users.createdAt));
Expect<
  Equal<
    typeof validOrder.$Columns,
    typeof Users.username | typeof Users.createdAt
  >
>();
Expect<Equal<typeof validOrder.$HasArg, false>>();
