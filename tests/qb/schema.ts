import {
  bigint,
  boolean,
  date,
  enumtype,
  fk,
  integer,
  many,
  notNull,
  now,
  one,
  pk,
  relations,
  table,
  text,
  timestamp,
  unique,
  varchar,
} from "durcno";

export { Migrations } from "durcno";

// Comprehensive test enums and tables of a practical scenario

export const UserTypeEnum = enumtype("public", "user_type", ["admin", "user"]);
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

export const Users = table("public", "users", {
  id: pk(),
  // String types
  username: varchar({ length: 50, unique, notNull }),
  email: varchar({ length: 100 }),
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
  type: UserTypeEnum.enumed({ notNull }),
});

export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
  comments: many(Comments, Comments.userId),
  profile: one(UserProfiles, UserProfiles.userId),
}));

// User profiles for one-to-one relationship testing
export const UserProfiles = table("public", "user_profiles", {
  id: pk(),
  userId: bigint({ unique, notNull }).references({
    column: () => Users.id,
    onDelete: "CASCADE",
  }),
  bio: varchar({ length: 500 }),
  avatarUrl: varchar({ length: 200 }),
  website: varchar({ length: 200 }),
  createdAt: timestamp({ notNull }).default(now()),
});

export const UserProfilesRelations = relations(UserProfiles, () => ({
  user: one(Users, Users.id),
}));

// Posts table with foreign key relationships
export const Posts = table("public", "posts", {
  id: pk(),
  userId: bigint({ notNull }).references(() => Users.id),
  title: varchar({ length: 200 }),
  content: varchar({ length: 1000 }),
  slug: varchar({ length: 250, unique }),
  isPublished: boolean({ notNull }).default(false),
  publishedAt: timestamp({}),
  createdAt: timestamp({ notNull }).default(now()),
  viewCount: integer({ notNull }).default(0),
  likeCount: bigint({ notNull }).default(0),
});

export const PostsRelations = relations(Posts, () => ({
  author: fk(Posts.userId, Users),
  comments: many(Comments, Comments.postId),
}));

// Comments table with multiple foreign keys
export const Comments = table("public", "comments", {
  id: pk(),
  postId: bigint({ notNull }).references({
    column: () => Posts.id,
    onDelete: "CASCADE",
  }),
  userId: bigint({ notNull }).references({
    column: () => Users.id,
    onDelete: "CASCADE",
  }),
  parentId: bigint({}), // Self-reference for nested comments
  body: varchar({ length: 500 }),
  isEdited: boolean({ notNull }).default(false),
  createdAt: timestamp({ notNull }).default(now()),
  editedAt: timestamp({}),
});

export const CommentsRelations = relations(Comments, () => ({
  post: fk(Comments.postId, Posts),
  author: fk(Comments.userId, Users),
}));

// Products table for testing various constraints
export const Products = table("public", "products", {
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

// Categories table for testing fk relations
export const Categories = table("public", "categories", {
  id: pk(),
  name: varchar({ length: 100, notNull }),
  description: text({}),
});

// Articles table with both nullable and non-null FK columns for fk relation testing
export const Articles = table("public", "articles", {
  id: pk(),
  title: varchar({ length: 200, notNull }),
  // Non-null FK - author is required
  authorId: bigint({ notNull }).references(() => Users.id),
  // Nullable FK - category is optional
  categoryId: bigint({}).references(() => Categories.id),
  content: text({}),
  createdAt: timestamp({ notNull }).default(now()),
});

export const ArticlesRelations = relations(Articles, () => ({
  // fk relation with notNull FK column - result should be non-nullable
  author: fk(Articles.authorId, Users),
  // fk relation with nullable FK column - result should be nullable
  category: fk(Articles.categoryId, Categories),
}));

// AuditLogs table for testing insertFn and updateFn
export const AuditLogs = table("public", "auditLogs", {
  id: pk(),
  action: varchar({ length: 100, notNull }),
  message: text({}),
  // insertFn: auto-generate createdAt on insert
  createdAt: timestamp({ notNull }).$insertFn(() => new Date()),
  // updateFn: auto-generate modifiedAt on every update
  modifiedAt: timestamp({ notNull }).$updateFn(() => new Date()),
});
