import {
  Comments,
  db,
  Logs,
  NetworkDevices,
  Posts,
  UserProfiles,
  Users,
} from "./schema";
import { type Equal, Expect } from "./utils";

// Type test: insert on Users
db.insert(Users).values({
  username: "ghost",
  email: "email@example.com",
  type: "admin",
  externalId: "550e8400-e29b-41d4-a716-446655440000",
});

// Type test: insert on Posts (includes array column)
db.insert(Posts).values([
  {
    userId: 1n,
    title: "title",
    content: "content",
    tags: ["typescript", "postgres"],
  },
  {
    userId: 1n,
    title: "title",
    content: "content",
    // tags is nullable, can be omitted
  },
]);

// Type test: insert Posts with explicit null for array column
db.insert(Posts).values({
  userId: 1n,
  title: "test",
  tags: null,
});

// Type test: insert on Comments
db.insert(Comments).values({
  postId: 1n,
  userId: 1n,
  body: "body",
});

// Type test: insert with returning
const insertWithReturning = db
  .insert(Users)
  .values({
    username: "ghost",
    email: "email@example.com",
    type: "user",
    externalId: "550e8400-e29b-41d4-a716-446655440000",
  })
  .returning({ id: true, username: true, email: true });
type InsertWithReturning = Awaited<typeof insertWithReturning>;
Expect<
  Equal<
    InsertWithReturning,
    {
      id: bigint;
      username: string;
      email: string | null;
    }[]
  >
>();

// Type test: insert with insertFn - createdAt is optional because insertFn provides default
db.insert(Logs).values({
  message: "Log message",
  updatedAt: new Date(), // updatedAt has updateFn but still required for insert
  // createdAt is optional due to insertFn
});

// Type test: insert with insertFn - can still provide explicit value
db.insert(Logs).values({
  message: "Log message",
  createdAt: new Date(), // Override insertFn with explicit value
  updatedAt: new Date(),
});

// Type test: insert Logs with returning
const insertLogsWithReturning = db
  .insert(Logs)
  .values({
    message: "Test log",
    updatedAt: new Date(),
  })
  .returning({ id: true, message: true, createdAt: true });
type InsertLogsWithReturning = Awaited<typeof insertLogsWithReturning>;
Expect<
  Equal<
    InsertLogsWithReturning,
    {
      id: bigint;
      message: string;
      createdAt: Date;
    }[]
  >
>();

// ============================================================================
// returning("*") type tests
// ============================================================================

// Positive: single row insert with returning("*") returns full row type as array
const _returningWildcardSingle = db
  .insert(Users)
  .values({
    username: "ghost",
    type: "user",
    externalId: "550e8400-e29b-41d4-a716-446655440000",
  })
  .returning("*");
type ReturningWildcardSingle = Awaited<typeof _returningWildcardSingle>;
Expect<
  Equal<
    ReturningWildcardSingle,
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

// Positive: multi-row insert with returning("*") also returns full row type as array
const _returningWildcardMulti = db
  .insert(Users)
  .values([
    {
      username: "user1",
      type: "user",
      externalId: "550e8400-e29b-41d4-a716-446655440000",
    },
    {
      username: "user2",
      type: "admin",
      externalId: "550e8400-e29b-41d4-a716-446655440001",
    },
  ])
  .returning("*");
type ReturningWildcardMulti = Awaited<typeof _returningWildcardMulti>;
Expect<
  Equal<
    ReturningWildcardMulti,
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

// Negative: parameterized returning still rejects invalid keys
db.insert(Users)
  .values({
    username: "test",
    type: "user",
    externalId: "550e8400-e29b-41d4-a716-446655440000",
  })
  // @ts-expect-error - Returning non-existent column should not compile
  .returning({ nonExistentColumn: true });

// ============================================================================
// Negative type tests - these should cause compile errors
// ============================================================================

// @ts-expect-error - Missing required field should not compile
db.insert(Users).values({ email: "email@example.com" });

// Wrong type for field should not compile
db.insert(Users).values({
  // @ts-expect-error - username should be string
  username: 123,
  type: "admin",
  externalId: "550e8400-e29b-41d4-a716-446655440000",
});

// Invalid enum value should not compile
db.insert(Users).values({
  username: "ghost",
  // @ts-expect-error - invalid enum value
  type: "invalid_type",
  externalId: "550e8400-e29b-41d4-a716-446655440000",
});

// @ts-expect-error - Wrong type for bigint field should not compile
db.insert(Posts).values({ userId: "not_a_number" });

db.insert(Users)
  .values({
    username: "test",
    type: "user",
    externalId: "550e8400-e29b-41d4-a716-446655440000",
  })
  // @ts-expect-error - Returning non-existent column should not compile
  .returning({ nonExistent: true });

// Insert to wrong table reference should not compile
db.insert(Users).values({
  // @ts-expect-error - postId doesn't exist on Users
  postId: 1,
  username: "test",
  type: "user",
  externalId: "550e8400-e29b-41d4-a716-446655440000",
});

// @ts-expect-error - Wrong type for bytea field (string instead of Buffer) should not compile
db.insert(UserProfiles).values({ userId: 1, avatarData: "not-a-buffer" });

// @ts-expect-error - Wrong type for bytea field (number instead of Buffer) should not compile
db.insert(UserProfiles).values({ userId: 1, avatarData: 123 });

// @ts-expect-error - Missing required bytea field should not compile
db.insert(UserProfiles).values({ userId: 1 });

// ============================================================================
// Negative type tests for network column inserts
// ============================================================================

// @ts-expect-error - Missing required ipAddress field should not compile
db.insert(NetworkDevices).values({
  name: "Bad Device",
  networkRange: "192.168.0.0/24",
  macAddress: "00:11:22:33:44:55",
});

// @ts-expect-error - Missing required networkRange field should not compile
db.insert(NetworkDevices).values({
  name: "Bad Device",
  ipAddress: "192.168.1.1",
  macAddress: "00:11:22:33:44:55",
});

// @ts-expect-error - Missing required macAddress field should not compile
db.insert(NetworkDevices).values({
  name: "Bad Device",
  ipAddress: "192.168.1.1",
  networkRange: "192.168.0.0/24",
});

// Wrong type for ipAddress should not compile
db.insert(NetworkDevices).values({
  name: "Bad Device",
  // @ts-expect-error - number not assignable to string
  ipAddress: 12345,
  networkRange: "192.168.0.0/24",
  macAddress: "00:11:22:33:44:55",
});

// Wrong type for macAddress should not compile
db.insert(NetworkDevices).values({
  name: "Bad Device",
  ipAddress: "192.168.1.1",
  networkRange: "192.168.0.0/24",
  // @ts-expect-error - number not assignable to string
  macAddress: 12345,
});

// ============================================================================
// ON CONFLICT type tests
// ============================================================================

// Return type flows correctly through .returning()
const _upsertResult = db
  .insert(Users)
  .values({
    username: "alice",
    type: "user",
    externalId: "550e8400-e29b-41d4-a716-446655440000",
  })
  .onConflict(Users.externalId)
  .doUpdateSet(({ excluded }) => ({ username: excluded.username }))
  .returning({ id: true, username: true });
type UpsertResult = Awaited<typeof _upsertResult>;
Expect<Equal<UpsertResult, { id: bigint; username: string }[]>>();

// doNothing with returning: type still flows through
const _doNothingWithReturning = db
  .insert(Users)
  .values({
    username: "bob",
    type: "admin",
    externalId: "550e8400-e29b-41d4-a716-446655440000",
  })
  .onConflict(Users.email)
  .doNothing()
  .returning({ id: true });
type DoNothingWithReturning = Awaited<typeof _doNothingWithReturning>;
Expect<Equal<DoNothingWithReturning, { id: bigint }[]>>();

// ── Negative: doUpdateSet without target ────────────────────────────────────

// doUpdateSet is typed as returning `never` when no target columns are given.
// Calling it compiles, but the return type is `never` — unusable as a query.
const _doUpdateSetNoTarget = db
  .insert(Users)
  .values({
    username: "alice",
    type: "user",
    externalId: "550e8400-e29b-41d4-a716-446655440000",
  })
  .onConflict()
  .doUpdateSet(({ excluded }) => ({ username: excluded.username }));
// The result is `never` — it cannot be awaited or chained usefully.
type DoUpdateSetNoTarget = typeof _doUpdateSetNoTarget;
Expect<Equal<DoUpdateSetNoTarget, never>>();
