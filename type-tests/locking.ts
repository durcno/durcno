import { asc, count, eq, gte, type LockOptions } from "durcno";
import { db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

// The locking clause does not change the row type
const base = db.from(Users).select("*");
type BaseUsers = Awaited<typeof base>;
const updateAll = db.from(Users).select("*").forUpdate();
Expect<Equal<Awaited<typeof updateAll>, BaseUsers>>();

// Each strength
const noKeyUpdate = db.from(Users).select("*").forNoKeyUpdate();
const share = db.from(Users).select("*").forShare();
const keyShare = db.from(Users).select("*").forKeyShare();
Expect<Equal<Awaited<typeof noKeyUpdate>, BaseUsers>>();
Expect<Equal<Awaited<typeof share>, BaseUsers>>();
Expect<Equal<Awaited<typeof keyShare>, BaseUsers>>();

// Options
const singleOf = db.from(Users).select("*").forUpdate({ of: Posts });
const noWait = db.from(Users).select("*").forNoKeyUpdate({ noWait: true });
const skipLocked = db.from(Users).select("*").forKeyShare({ skipLocked: true });
Expect<Equal<Awaited<typeof singleOf>, BaseUsers>>();
Expect<Equal<Awaited<typeof noWait>, BaseUsers>>();
Expect<Equal<Awaited<typeof skipLocked>, BaseUsers>>();

// Joined table in `of`; clause leaves the select shape alone
const joinedBase = db
  .from(Users)
  .innerJoin(Posts)
  .on(() => eq(Posts.userId, Users.id))
  .select("*");
const joinedLock = db
  .from(Users)
  .innerJoin(Posts)
  .on(() => eq(Posts.userId, Users.id))
  .select("*")
  .forShare({ of: [Users, Posts] });
Expect<Equal<Awaited<typeof joinedLock>, Awaited<typeof joinedBase>>>();
Expect<Equal<Awaited<typeof joinedLock>[number]["title"], string | null>>();

// Chain order is free; row type unchanged
const whereThenLock = db
  .from(Users)
  .select(() => ({ id: Users.id }))
  .where(() => eq(Users.type, "admin"))
  .orderBy(() => asc(Users.id))
  .forUpdate({ skipLocked: true });
Expect<Equal<Awaited<typeof whereThenLock>, { id: bigint }[]>>();

// *Negative tests ---------------------------------------------------------------------------
db.from(Users)
  .select("*")
  // @ts-expect-error: there is no generic .for() — use the .forUpdate()/.for*() methods
  .for("update");

db.from(Users)
  .select("*")
  // @ts-expect-error: noWait and skipLocked are mutually exclusive
  .forUpdate({ noWait: true, skipLocked: true });

db.from(Users)
  .select("*")
  .forUpdate()
  // @ts-expect-error: a query holds at most one locking clause
  .forShare();

// Lock methods disappear right after GROUP BY / HAVING — PostgreSQL rejects
// locking clauses on grouped or aggregated queries.
db.from(Users)
  .select("*")
  .groupBy(() => [Users.type])
  // @ts-expect-error: FOR UPDATE cannot be applied to a GROUP BY query
  .forUpdate();

db.from(Users)
  .select(() => ({ total: count("*") }))
  .having(() => gte(count("*"), 2))
  // @ts-expect-error: FOR SHARE cannot be applied to a HAVING query
  .forShare();

// LockOptions standalone
const options: LockOptions = { of: [Users, Posts], noWait: true };
const empty: LockOptions = {};
const skipOnly: LockOptions = { of: Users, skipLocked: true };
console.log(options, empty, skipOnly);
