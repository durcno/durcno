import {
  bigint,
  boolean,
  date,
  enumtype,
  integer,
  Migrations,
  notNull,
  now,
  pk,
  table,
  text,
  timestamp,
  unique,
  varchar,
} from "durcno";

export { Migrations };

// Test enum type
export const StatusEnum = enumtype("public", "status", [
  "active",
  "inactive",
  "pending",
]);
export const RoleEnum = enumtype("public", "role", [
  "admin",
  "user",
  "moderator",
]);

// Comprehensive test table with various column types
export const users = table("public", "users", {
  id: pk(),
  // String types
  username: varchar({ length: 50, unique, notNull }),
  email: varchar({ length: 100, notNull }),
  bio: text({}),
  description: text({}),

  // Numeric types
  age: integer({}),
  score: integer({ notNull }).default(0),
  points: bigint({}),
  balance: bigint({ notNull }).default(0),

  // Boolean type
  isActive: boolean({ notNull }).default(false),
  isVerified: boolean({}),

  // Date/Time types
  birthDate: date({}),
  createdAt: timestamp({ notNull }).default(now()),
  updatedAt: timestamp({}),
  lastLogin: timestamp({}),

  // Enum types
  status: StatusEnum.enumed({ notNull }),
  role: RoleEnum.enumed({ notNull }),
});

// Table with foreign key relationships
export const posts = table("public", "posts", {
  id: pk(),
  authorId: bigint({
    notNull,
  }).references({ column: () => users.id, onDelete: "CASCADE" }),
  title: varchar({ length: 200, notNull }),
  content: text({ notNull }),
  slug: varchar({ length: 250, unique, notNull }),
  isPublished: boolean({ notNull }).default(false),
  publishedAt: timestamp({}),
  createdAt: timestamp({ notNull }).default(now()),
  viewCount: integer({ notNull }).default(0),
  likeCount: bigint({ notNull }).default(0),
});

// Table with multiple foreign keys
export const comments = table("public", "comments", {
  id: pk(),
  postId: bigint({
    notNull,
  }).references({ column: () => posts.id, onDelete: "CASCADE" }),
  authorId: bigint({}).references({
    column: () => users.id,
    onDelete: "SET NULL",
  }),
  parentId: bigint({}), // Will be updated to self-reference after table creation
  body: text({ notNull }),
  isEdited: boolean({ notNull }).default(false),
  createdAt: timestamp({ notNull }).default(now()),
  editedAt: timestamp({}),
});

// Test table with all constraint types
export const products = table("public", "products", {
  id: pk(),
  sku: varchar({ length: 50, unique, notNull }),
  name: varchar({ length: 200, notNull }),
  description: text({}),
  price: bigint({ notNull }),
  inStock: boolean({ notNull }).default(true),
  categoryId: integer({}),
  createdDate: date({ notNull }),
  lastUpdated: timestamp({ notNull }).default(now()),
});
