import type { CtesByName, InferQueryColumns } from "durcno";
import { count, isIn, lower } from "durcno";
import { db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

const projectedUsers = db
  .with("projectedUsers")
  .as(db.from(Users).select({ id: Users.id, username: Users.username }));
const projectedUsersQuery = db
  .with(projectedUsers)
  .from((ctes) => ctes.projectedUsers)
  .select();
const projectedUsersSource = db
  .from(Users)
  .select({ id: Users.id, username: Users.username });

type ProjectedRows = Awaited<typeof projectedUsersQuery>;
Expect<Equal<ProjectedRows, { id: bigint; username: string }[]>>();

type ProjectedColumns = InferQueryColumns<
  "projectedUsers",
  typeof projectedUsersSource
>;
Expect<Equal<keyof ProjectedColumns, "id" | "username">>();

const insertedUsersSource = db
  .insert(Users)
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
  .select();

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
  .as(db.from(Users).select({ id: Users.id }));

db.from(Posts)
  .select()
  .where(
    isIn(Posts.userId, db.from(activeUserIds).select({ id: activeUserIds.id })),
  );

const mixedCte = db
  .with("mixed")
  .as(db.from(Users).select({ id: Users.id, username: Users.username }));
db.from(Posts)
  .select()
  .where(
    // @ts-expect-error: subquery column type (string) does not match Posts.userId (bigint)
    isIn(Posts.userId, db.from(mixedCte).select({ id: mixedCte.username })),
  );

// CTEs cannot be DML targets — only real tables are writable.
// @ts-expect-error: Cannot INSERT INTO a CTE table
db.with(projectedUsers).insert(projectedUsers);
// @ts-expect-error: Cannot UPDATE a CTE table
db.with(projectedUsers).update(projectedUsers);
// @ts-expect-error: Cannot DELETE FROM a CTE table
db.with(projectedUsers).delete(projectedUsers);

// -------------------------------------------------------------------------
// Function-backed virtual columns: InferQueryColumns preserves SqlFn types
// -------------------------------------------------------------------------

// lower() CTE: virtual column should be string
const lowerSource = db.from(Users).select({ lname: lower(Users.username) });
type LowerColumns = InferQueryColumns<"lowerCte", typeof lowerSource>;
Expect<Equal<keyof LowerColumns, "lname">>();
const lowerCte = db.with("lowerCte").as(lowerSource);
const lowerQuery = db
  .with(lowerCte)
  .from((ctes) => ctes.lowerCte)
  .select();
type LowerRows = Awaited<typeof lowerQuery>;
Expect<Equal<LowerRows, { lname: string | null }[]>>();

// count() CTE: virtual column should be number | null
const countSource = db.from(Users).select({ total: count(Users.id) });
type CountColumns = InferQueryColumns<"countCte", typeof countSource>;
Expect<Equal<keyof CountColumns, "total">>();
const countCte = db.with("countCte").as(countSource);
const countQuery = db
  .with(countCte)
  .from((ctes) => ctes.countCte)
  .select();
type CountRows = Awaited<typeof countQuery>;
Expect<Equal<CountRows, { total: number | null }[]>>();
