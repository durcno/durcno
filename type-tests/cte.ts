import type { CtesByName, InferQueryColumns } from "durcno";
import { add, asc, concat, count, eq, isIn, lower, now, sql } from "durcno";
import { db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

const projectedUsers = db
  .with("projectedUsers")
  .as(
    db.from(Users).select(() => ({ id: Users.id, username: Users.username })),
  );
const projectedUsersQuery = db
  .with(projectedUsers)
  .from((ctes) => ctes.projectedUsers)
  .select("*");
const projectedUsersSource = db
  .from(Users)
  .select(() => ({ id: Users.id, username: Users.username }));

type ProjectedRows = Awaited<typeof projectedUsersQuery>;
Expect<Equal<ProjectedRows, { id: bigint; username: string }[]>>();

type ProjectedColumns = InferQueryColumns<
  "projectedUsers",
  typeof projectedUsersSource
>;
Expect<Equal<keyof ProjectedColumns, "id" | "username">>();

const insertedUsersSource = db
  .insertInto(Users)
  .values({
    username: "cte-user",
    type: "user",
    externalId: "ext-cte-user",
  })
  .returning({ id: true, username: true });

type InsertedSourceColumns = InferQueryColumns<
  "insertedUsers",
  typeof insertedUsersSource
>;
Expect<Equal<keyof InsertedSourceColumns, "id" | "username">>();

const insertedUsers = db.with("insertedUsers").as(insertedUsersSource);
const insertedUsersQuery = db
  .with(insertedUsers)
  .from((ctes) => ctes.insertedUsers)
  .select("*");

type InsertedRow = Awaited<typeof insertedUsersQuery>[number];
Expect<Equal<keyof InsertedRow, "id" | "username">>();
Expect<Equal<InsertedRow["id"], bigint>>();
Expect<Equal<InsertedRow["username"], string>>();

// @ts-expect-error: only typed query builders can be turned into CTEs
db.with("bad").as(Users);

// CtesByName maps CTE tuple to name-keyed object
type CTEMap = CtesByName<[typeof projectedUsers]>;
Expect<Equal<keyof CTEMap, "projectedUsers">>();

const activeUserIds = db
  .with("activeUserIds")
  .as(db.from(Users).select(() => ({ id: Users.id })));

db.from(Posts)
  .select("*")
  .where(() =>
    isIn(
      Posts.userId,
      db.from(activeUserIds).select(({ activeUserIds }) => ({
        id: activeUserIds.id,
      })),
    ),
  );

const mixedCte = db
  .with("mixed")
  .as(
    db.from(Users).select(() => ({ id: Users.id, username: Users.username })),
  );
db.from(Posts)
  .select("*")
  .where(() =>
    isIn(
      Posts.userId,
      // @ts-expect-error: subquery column type (string) does not match Posts.userId (bigint)
      db.from(mixedCte).select(({ mixed }) => ({ id: mixed.username })),
    ),
  );

// CTEs cannot be DML targets — only real tables are writable.
// @ts-expect-error: Cannot INSERT INTO a CTE table
db.with(projectedUsers).insertInto(projectedUsers);
// @ts-expect-error: Cannot UPDATE a CTE table
db.with(projectedUsers).update(projectedUsers);
// @ts-expect-error: Cannot DELETE FROM a CTE table
db.with(projectedUsers).deleteFrom(projectedUsers);

// -------------------------------------------------------------------------
// Function-backed virtual columns: InferQueryColumns preserves SqlFn types
// -------------------------------------------------------------------------

// lower() CTE: virtual column should be string
const lowerSource = db
  .from(Users)
  .select(() => ({ lname: lower(Users.username) }));
type LowerColumns = InferQueryColumns<"lowerCte", typeof lowerSource>;
Expect<Equal<keyof LowerColumns, "lname">>();
const lowerCte = db.with("lowerCte").as(lowerSource);
const lowerQuery = db
  .with(lowerCte)
  .from((ctes) => ctes.lowerCte)
  .select("*");
type LowerRows = Awaited<typeof lowerQuery>;
Expect<Equal<LowerRows, { lname: string }[]>>();

// count() CTE: virtual column should be number
const countSource = db.from(Users).select(() => ({ total: count(Users.id) }));
type CountColumns = InferQueryColumns<"countCte", typeof countSource>;
Expect<Equal<keyof CountColumns, "total">>();
const countCte = db.with("countCte").as(countSource);
const countQuery = db
  .with(countCte)
  .from((ctes) => ctes.countCte)
  .select("*");
type CountRows = Awaited<typeof countQuery>;
Expect<Equal<CountRows, { total: number }[]>>();

// Test for cte.test.ts line 387
const activeUsersForJoin = db.with("activeUsers").as(
  db
    .from(Users)
    .select(() => ({
      username: Users.username,
    }))
    .where(() => eq(Users.username, "active")),
);

const testQuery = db
  .with(activeUsersForJoin)
  .from(Users)
  .leftJoin(activeUsersForJoin, ({ activeUsers }) => {
    Expect<
      Equal<typeof activeUsers.username, typeof activeUsersForJoin.username>
    >();
    return eq(Users.username, activeUsers.username);
  })
  .select(({ activeUsers }) => {
    return {
      username: Users.username,
      activeUser: activeUsers.username,
    };
  })
  .orderBy(() => {
    return asc(Users.username);
  });

const directCteQuery = db
  .with(activeUsersForJoin)
  .from((ctes) => ctes.activeUsers)
  .select(({ activeUsers }) => {
    Expect<
      Equal<typeof activeUsers.username, typeof activeUsersForJoin.username>
    >();
    return {
      username: activeUsers.username,
    };
  })
  .orderBy(({ activeUsers }) => {
    Expect<
      Equal<typeof activeUsers.username, typeof activeUsersForJoin.username>
    >();
    return asc(activeUsers.username);
  });

// -------------------------------------------------------------------------
// Literal, Sql, and null projection CTEs: InferQueryColumns preserves types
// -------------------------------------------------------------------------

const literalCteSource = db.from(Users).select(() => ({
  userId: Users.id,
  rawStr: "literal_string",
  rawNum: 42,
  rawBigInt: 100n,
  rawBool: true,
  directNull: null,
  sqlNull: sql.null,
  sqlCustom: sql<string>`'custom_sql'`,
}));

type LiteralCteColumns = InferQueryColumns<
  "literalCte",
  typeof literalCteSource
>;
Expect<
  Equal<
    keyof LiteralCteColumns,
    | "userId"
    | "rawStr"
    | "rawNum"
    | "rawBigInt"
    | "rawBool"
    | "directNull"
    | "sqlNull"
    | "sqlCustom"
  >
>();

const literalCte = db.with("literalCte").as(literalCteSource);
const literalCteQuery = db
  .with(literalCte)
  .from((ctes) => ctes.literalCte)
  .select("*");

type LiteralCteRows = Awaited<typeof literalCteQuery>;
Expect<
  Equal<
    LiteralCteRows,
    {
      userId: bigint;
      rawStr: string;
      rawNum: number;
      rawBigInt: bigint;
      rawBool: boolean;
      directNull: null;
      sqlNull: null;
      sqlCustom: string;
    }[]
  >
>();

const cteFnQuery = db
  .with(literalCte)
  .from((ctes) => ctes.literalCte)
  .select(({ literalCte }) => ({
    lowered: lower(literalCte.rawStr),
    incremented: add(literalCte.rawBigInt, 1),
    created: now(),
  }));

type CteFnRows = Awaited<typeof cteFnQuery>;
Expect<
  Equal<
    CteFnRows,
    {
      lowered: string;
      incremented: number;
      created: Date;
    }[]
  >
>();

// -------------------------------------------------------------------------
// SqlFn in CTE: InferQueryColumns preserves non-nullability
// -------------------------------------------------------------------------

const fnCteSource = db.from(Users).select(() => ({
  userCount: count("*"),
  fullName: concat(Users.username, " user"),
}));

const fnCte = db.with("fnCte").as(fnCteSource);
const fnCteQuery = db
  .with(fnCte)
  .from((ctes) => ctes.fnCte)
  .select(({ fnCte }) => ({
    total: fnCte.userCount,
    name: fnCte.fullName,
  }));

type FnCteRows = Awaited<typeof fnCteQuery>;
Expect<
  Equal<
    FnCteRows,
    {
      total: number;
      name: string;
    }[]
  >
>();
