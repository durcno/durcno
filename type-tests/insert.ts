import {
  Categories,
  Comments,
  db,
  Logs,
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

// ============================================
// Serial column type tests (using practical tables)
// ============================================

// Type test: insert on UserProfiles - serial id is auto-generated and optional
db.insert(UserProfiles).values({
  userId: 1n,
  avatarData: Buffer.from("avatar"),
  // id is auto-generated (serial) and optional
});

// Type test: insert on UserProfiles - can provide explicit serial value
db.insert(UserProfiles).values({
  id: 1,
  userId: 1n,
  avatarData: Buffer.from("avatar"),
});

// Type test: insert UserProfiles with skills array column
db.insert(UserProfiles).values({
  userId: 1n,
  avatarData: Buffer.from("avatar"),
  skills: ["TypeScript", "PostgreSQL", "Node.js"],
});

// Type test: insert UserProfiles with null skills (nullable array)
db.insert(UserProfiles).values({
  userId: 1n,
  avatarData: Buffer.from("avatar"),
  skills: null,
});

// Type test: insert on Categories - smallserial id is optional
db.insert(Categories).values({
  name: "Technology",
  // id is auto-generated (smallserial) and optional
});

// Type test: insert UserProfiles with serial returning
const insertSerialWithReturning = db
  .insert(UserProfiles)
  .values({
    userId: 1n,
    avatarData: Buffer.from("avatar"),
  })
  .returning({ id: true, userId: true });
type InsertSerialWithReturning = Awaited<typeof insertSerialWithReturning>;
Expect<
  Equal<
    InsertSerialWithReturning,
    {
      id: number;
      userId: bigint;
    }[]
  >
>();

// ============================================
// UUID column type tests (using Users table)
// ============================================

// Type test: insert on Users - externalId required, trackingId optional
db.insert(Users).values({
  username: "alice",
  type: "user",
  externalId: "550e8400-e29b-41d4-a716-446655440000",
  // trackingId is optional (nullable)
});

// Type test: insert on Users - can provide explicit uuid for nullable column
db.insert(Users).values({
  username: "bob",
  type: "admin",
  externalId: "550e8400-e29b-41d4-a716-446655440000",
  trackingId: "550e8400-e29b-41d4-a716-446655440001",
});

// Type test: insert Users with uuid returning
const insertUuidWithReturning = db
  .insert(Users)
  .values({
    username: "charlie",
    type: "user",
    externalId: "550e8400-e29b-41d4-a716-446655440000",
  })
  .returning({ id: true, externalId: true, trackingId: true, username: true });
type InsertUuidWithReturning = Awaited<typeof insertUuidWithReturning>;
Expect<
  Equal<
    InsertUuidWithReturning,
    {
      id: bigint;
      externalId: string;
      trackingId: string | null;
      username: string;
    }[]
  >
>();

// ============================================
// Bytea column type tests (using UserProfiles table)
// ============================================

// Type test: insert on UserProfiles - avatarData required, thumbnailData optional
db.insert(UserProfiles).values({
  userId: 1n,
  avatarData: Buffer.from("hello world"),
  // thumbnailData is optional (nullable)
});

// Type test: insert on UserProfiles - can provide explicit buffer for nullable column
db.insert(UserProfiles).values({
  userId: 1n,
  avatarData: Buffer.from("required data"),
  thumbnailData: Buffer.from("optional data"),
});

// Type test: insert UserProfiles with bytea returning
const insertByteaWithReturning = db
  .insert(UserProfiles)
  .values({
    userId: 1n,
    avatarData: Buffer.from("test data"),
  })
  .returning({ id: true, avatarData: true, thumbnailData: true, userId: true });
type InsertByteaWithReturning = Awaited<typeof insertByteaWithReturning>;
Expect<
  Equal<
    InsertByteaWithReturning,
    {
      id: number;
      avatarData: Buffer;
      thumbnailData: Buffer | null;
      userId: bigint;
    }[]
  >
>();

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
// Network column type tests (INET, CIDR, MACADDR)
// ============================================================================

import { NetworkDevices } from "./schema";

// Type test: insert on NetworkDevices - all required fields (array is nullable)
db.insert(NetworkDevices).values({
  name: "Router 1",
  ipAddress: "192.168.1.1",
  networkRange: "192.168.1.0/24",
  macAddress: "00:11:22:33:44:55",
  // secondaryIp, allowedNetwork, backupMac, allowedIps are optional (nullable)
});

// Type test: insert on NetworkDevices - with all optional fields including array
db.insert(NetworkDevices).values({
  name: "Switch 1",
  ipAddress: "10.0.0.1",
  secondaryIp: "10.0.0.2",
  networkRange: "10.0.0.0/8",
  allowedNetwork: "172.16.0.0/12",
  macAddress: "aa:bb:cc:dd:ee:ff",
  backupMac: "11:22:33:44:55:66",
  allowedIps: ["192.168.1.100", "192.168.1.101", "10.0.0.50"],
});

// Type test: insert with IPv6 addresses and allowedIps array
db.insert(NetworkDevices).values({
  name: "IPv6 Server",
  ipAddress: "2001:db8::1",
  networkRange: "2001:db8::/32",
  macAddress: "00-11-22-33-44-55",
  allowedIps: ["2001:db8::100", "2001:db8::200"],
});

// Type test: insert with explicit null for allowedIps array
db.insert(NetworkDevices).values({
  name: "No Allowed IPs",
  ipAddress: "192.168.0.1",
  networkRange: "192.168.0.0/24",
  macAddress: "00:00:00:00:00:01",
  allowedIps: null,
});

// Type test: insert NetworkDevices with returning
const insertNetworkWithReturning = db
  .insert(NetworkDevices)
  .values({
    name: "Firewall",
    ipAddress: "192.168.0.1",
    networkRange: "192.168.0.0/16",
    macAddress: "ab:cd:ef:12:34:56",
  })
  .returning({
    id: true,
    ipAddress: true,
    secondaryIp: true,
    macAddress: true,
    backupMac: true,
  });
type InsertNetworkWithReturning = Awaited<typeof insertNetworkWithReturning>;
Expect<
  Equal<
    InsertNetworkWithReturning,
    {
      id: bigint;
      ipAddress: string;
      secondaryIp: string | null;
      macAddress: string;
      backupMac: string | null;
    }[]
  >
>();

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
