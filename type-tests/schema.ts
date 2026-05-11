import {
  and,
  bigint,
  bigserial,
  bytea,
  cidr,
  database,
  enumtype,
  fk,
  gt,
  gte,
  inet,
  integer,
  length,
  like,
  lte,
  macaddr,
  many,
  notNull,
  now,
  one,
  pk,
  primaryKey,
  relations,
  serial,
  smallserial,
  table,
  time,
  timestamp,
  unique,
  uuid,
  varchar,
} from "durcno";
import { testSetup } from "./utils";

export const UserTypeEnum = enumtype("public", "user_type", ["admin", "user"]);

export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, unique, notNull }),
  email: varchar({ length: 100 }),
  type: UserTypeEnum.enumed({ notNull }),
  createdAt: timestamp({ notNull }).default(now()),
  // uuid column: external identifier for API exposure
  externalId: uuid({ notNull, unique }),
  // Optional uuid for tracking purposes
  trackingId: uuid({}),
});

export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
  comments: many(Comments, Comments.userId),
  profile: one(UserProfiles, UserProfiles.userId),
}));

export const UserProfiles = table("public", "userProfiles", {
  // serial column: auto-incrementing 32-bit integer as primary key
  id: serial({ primaryKey }),
  userId: bigint({
    unique,
    notNull,
  }).references({ column: () => Users.id, onDelete: "CASCADE" }),
  bio: varchar({ length: 500 }),
  avatarUrl: varchar({ length: 200 }),
  // bytea columns: binary data storage for avatar
  avatarData: bytea({ notNull }),
  // Optional bytea for thumbnail
  thumbnailData: bytea({}),
  // Array column: list of skills (nullable)
  skills: varchar({ length: 50, dimension: [null] as const }),
});

export const Posts = table("public", "posts", {
  id: pk(),
  userId: bigint({ notNull }).references(() => Users.id),
  title: varchar({ length: 200 }),
  content: varchar({ length: 1000 }),
  createdAt: timestamp({ notNull }).default(now()),
  // Array column: list of tags (nullable)
  tags: varchar({ length: 50, dimension: [null] as const }),
});

export const Comments = table("public", "comments", {
  id: pk(),
  postId: bigint({
    notNull,
  }).references({ column: () => Posts.id, onDelete: "SET NULL" }),
  userId: bigint({
    notNull,
  }).references({ column: () => Users.id, onDelete: "RESTRICT" }),
  body: varchar({ length: 500 }),
  createdAt: timestamp({ notNull }).default(now()),
});

export const UserProfilesRelations = relations(UserProfiles, () => ({
  user: fk(UserProfiles.userId, Users),
}));

// Table with smallserial for testing small auto-increment
export const Categories = table("public", "categories", {
  // smallserial column: auto-incrementing 16-bit integer
  id: smallserial({ primaryKey }),
  name: varchar({ length: 100, notNull }),
});

// Table with both nullable and non-null FK columns
export const Articles = table("public", "articles", {
  id: pk(),
  title: varchar({ length: 200, notNull }),
  // Non-null FK - author is required
  authorId: bigint({ notNull }).references(() => Users.id),
  // Nullable FK - category is optional
  categoryId: integer({}).references(() => Categories.id),
});

export const ArticlesRelations = relations(Articles, () => ({
  // fk relation with notNull FK column - result should be T (not nullable)
  author: fk(Articles.authorId, Users),
  // fk relation with nullable FK column - result should be T | null
  category: fk(Articles.categoryId, Categories),
}));

// Add fk relation to Posts to test FK from different table
export const PostsRelations = relations(Posts, () => ({
  comments: many(Comments, Comments.postId),
  // fk relation to Users via userId (notNull FK)
  author: fk(Posts.userId, Users),
}));

// Add relations for Comments to enable nested with testing
export const CommentsRelations = relations(Comments, () => ({
  // fk relation to Posts via postId (notNull FK)
  post: fk(Comments.postId, Posts),
  // fk relation to Users via userId (notNull FK)
  author: fk(Comments.userId, Users),
}));

// Table with bigserial and insertFn/updateFn for testing
export const Logs = table("public", "logs", {
  // bigserial column: auto-incrementing 64-bit integer as primary key
  id: bigserial({ primaryKey }),
  message: varchar({ length: 500, notNull }),
  // insertFn: auto-generate createdAt on insert
  createdAt: timestamp({ notNull }).$insertFn(() => new Date()),
  // updateFn: auto-generate updatedAt on every update
  updatedAt: timestamp({ notNull }).$updateFn(() => new Date()),
});

// Table for testing timestamp and time column options
export const Events = table("public", "events", {
  id: pk(),
  name: varchar({ length: 200, notNull }),
  // Default timestamp with timezone (timestamptz)
  scheduledAt: timestamp({ notNull }),
  // Timestamp without timezone
  localTime: timestamp({ withTimezone: false }),
  // Timestamp with precision
  preciseTime: timestamp({ precision: 3 }),
  // Time column with precision
  startTime: time({ precision: 2 }),
  // Time column with timezone
  startTimeWithTz: time({ withTimezone: true }),
  // Time column without precision
  endTime: time({}),
});

// Table for testing check constraints
export const CheckTest = table(
  "public",
  "check_test",
  {
    id: pk(),
    price: bigint({ notNull }),
    quantity: integer({ notNull }),
    email: varchar({ length: 255 }),
    name: varchar({ length: 100, notNull }),
  },
  {
    checkConstraints: (t, check) => [
      // Typesafe: comparisons with column value types
      check("positive_price", gt(t.price, 0n)),

      // Range check with and()
      check("valid_quantity", and(gte(t.quantity, 0), lte(t.quantity, 10000))),

      // Email format with like()
      check("valid_email", like(t.email, "%@%.%")),

      // Length constraints using functions
      check(
        "name_length",
        and(gte(length(t.name), 2), lte(length(t.name), 100)),
      ),
    ],
  },
);

// Table for testing network address types (INET, CIDR, MACADDR)
export const NetworkDevices = table("public", "network_devices", {
  id: pk(),
  name: varchar({ length: 100, notNull }),
  // INET column: required IP address (host with optional netmask)
  ipAddress: inet({ notNull }),
  // INET column: optional secondary IP
  secondaryIp: inet({}),
  // CIDR column: required network range
  networkRange: cidr({ notNull }),
  // CIDR column: optional allowed network
  allowedNetwork: cidr({}),
  // MACADDR column: required device MAC address
  macAddress: macaddr({ notNull, unique }),
  // MACADDR column: optional backup MAC
  backupMac: macaddr({}),
  // Array column: list of allowed IP addresses (nullable)
  allowedIps: inet({ dimension: [null] as const }),
});

// Table for testing array column types
export const ArrayTest = table("public", "array_test", {
  id: pk(),
  // 1D variable-length array: string[]
  tags: varchar({ length: 100, dimension: [null] as const }),
  // // 1D fixed-length array: [number, number, number]
  coordinates: integer({ dimension: [3] as const }),
  // // 2D variable-length array: number[][]
  matrix: integer({ dimension: [null, null] as const }),
  // // Mixed: fixed inner, variable outer: [number, number][]
  vectors: integer({ dimension: [2, null] as const }),
  // // Enum array
  roles: UserTypeEnum.enumed({ dimension: [null] as const }),
});

// Table for testing composite primary key constraint
export const UserRoles = table(
  "public",
  "user_roles",
  {
    userId: bigint({
      notNull,
    }).references(() => Users.id),
    roleId: bigint({ notNull }),
    assignedAt: timestamp({ notNull }).default(now()),
  },
  {
    uniqueConstraints: (t, unique) => [
      unique("unique_user_role", [t.userId, t.roleId]),
    ],
    primaryKeyConstraint: (t, primaryKey) =>
      primaryKey("pk", [t.userId, t.roleId]),
  },
);

// Table for testing composite unique constraint (table-level)
export const Tags = table(
  "public",
  "tags",
  {
    id: pk(),
    name: varchar({ length: 100, notNull }),
    slug: varchar({ length: 100, notNull }),
  },
  {
    uniqueConstraints: (t, unique) => [
      unique("uq_name_slug", [t.name, t.slug]),
    ],
  },
);

// Negative type tests: unique and primaryKey constraint callbacks
// must reject single-column and zero-column arrays
table(
  "public",
  "neg_unique_single",
  { id: pk(), name: varchar({ length: 50 }) },
  {
    uniqueConstraints: (t, unique) => [
      // @ts-expect-error: unique requires at least two columns
      unique("bad_single", [t.id]),
    ],
  },
);

table(
  "public",
  "neg_unique_empty",
  { id: pk(), name: varchar({ length: 50 }) },
  {
    uniqueConstraints: (_, unique) => [
      // @ts-expect-error: unique requires at least two columns
      unique("bad_empty", []),
    ],
  },
);

table(
  "public",
  "neg_pk_single",
  { id: pk(), name: varchar({ length: 50 }) },
  {
    primaryKeyConstraint: (t, primaryKey) =>
      // @ts-expect-error: primaryKey requires at least two columns
      primaryKey("bad_single_pk", [t.id]),
  },
);

table(
  "public",
  "neg_pk_empty",
  { id: pk(), name: varchar({ length: 50 }) },
  {
    // @ts-expect-error: primaryKey requires at least two columns
    primaryKeyConstraint: (_, primaryKey) => primaryKey("bad_empty_pk", []),
  },
);

export const db = database(
  {
    Users,
    UsersRelations,
    Posts,
    PostsRelations,
    Comments,
    CommentsRelations,
    UserProfiles,
    UserProfilesRelations,
    Categories,
    Articles,
    ArticlesRelations,
    Logs,
    Events,
    CheckTest,
    NetworkDevices,
    ArrayTest,
    UserRoles,
    Tags,
  },
  testSetup,
);
