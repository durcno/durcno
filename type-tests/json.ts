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

const objQuery = db.from(Users).select(({ users }) => ({
  userObj: jsonBuildObject({
    id: users.id,
    username: users.username,
    email: users.email,
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
const nestedObjQuery = db.from(Posts).select(({ posts }) => ({
  postWithMeta: jsonBuildObject({
    id: posts.id,
    title: posts.title,
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

const aggQuery = db.from(Users).select(({ users }) => ({
  usernames: jsonAgg(users.username),
  ids: jsonbAgg(users.id),
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
const filteredAggQuery = db.from(Posts).select(({ posts }) => ({
  recentTitles: jsonAgg(posts.title)
    .orderBy(desc(posts.createdAt))
    .filter(isNotNull(posts.title)),
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

const coalescedQuery = db.from(Users).select(({ users }) => ({
  names: coalesce(
    jsonAgg(users.username).filter(isNotNull(users.username)),
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

const caseQuery = db.from(Users).select(({ users }) => ({
  roleLabel: caseWhen(eq(users.type, "admin"), "Admin User")
    .when(eq(users.type, "user"), "Regular User")
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
const caseDirectQuery = db.from(Users).select(({ users }) => ({
  directBadge: caseWhen(eq(users.type, "admin"), "Administrator"),
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
const caseDirectMultiQuery = db.from(Users).select(({ users }) => ({
  multiBadge: caseWhen(eq(users.type, "admin"), "Admin User").when(
    eq(users.type, "user"),
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
const caseMixedQuery = db.from(Users).select(({ users }) => ({
  mixedLabel: caseWhen(eq(users.type, "admin"), users.username).else(
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
const caseNullQuery = db.from(Users).select(({ users }) => ({
  maybeLabel: caseWhen(eq(users.type, "admin"), "Administrator").end(),
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
const caseNumbersQuery = db.from(Users).select(({ users }) => ({
  score: caseWhen(eq(users.type, "admin"), 10)
    .when(eq(users.type, "user"), 1)
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
  .leftJoin(Users, ({ posts, users }) => eq(users.id, posts.userId))
  .leftJoin(Comments, ({ posts, comments }) => eq(comments.postId, posts.id))
  .select(({ posts, users, comments }) => ({
    id: posts.id,
    title: posts.title,
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

const toJsonQuery = db.from(Users).select(({ users }) => ({
  userJson: toJson(users),
  userJsonb: toJsonb(users),
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

const arrQuery = db.from(Users).select(({ users }) => ({
  tuple: jsonBuildArray(users.id, users.username),
  stripped: jsonStripNulls(
    jsonBuildObject({ id: users.id, email: users.email }),
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
  .select(({ users }) => ({
    invalidObj: jsonBuildObject({
      commentId: Comments.id,
      username: users.username,
    }),
  }));

db.from(Users)
  // @ts-expect-error: Comments is not joined in query
  .select(({ users }) => ({
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
  .select(({ users }) => ({
    invalidOrder: jsonAgg(users.username).orderBy(asc(Comments.id)),
  }));

const validOrder = jsonAgg(Users.username).orderBy(asc(Users.createdAt));
Expect<
  Equal<
    typeof validOrder.$Columns,
    typeof Users.username | typeof Users.createdAt
  >
>();
Expect<Equal<typeof validOrder.$HasArg, false>>();

