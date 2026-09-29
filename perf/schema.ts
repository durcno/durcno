import {
  bigint,
  boolean,
  date,
  enumtype,
  integer,
  many,
  notNull,
  pk,
  relations,
  table,
  text,
  timestamptz,
  varchar,
} from "durcno";

export { Migrations } from "durcno";

/**
 * Schema used by the `handleRows` benchmarks. Deliberately not shared with the
 * integration suites: the shape here is chosen to make row conversion cheap to
 * measure and stable across schema changes elsewhere.
 */
export const RoleEnum = enumtype("public", "role", [
  "admin",
  "user",
  "moderator",
]);

export const Users = table("public", "users", {
  id: pk(),
  userName: varchar({ length: 50, notNull }),
  email: varchar({ length: 100 }),
  bio: text({}),
  age: integer({}),
  points: bigint({}),
  balance: bigint({ notNull }),
  isActive: boolean({ notNull }),
  isVerified: boolean({}),
  birthDate: date({}),
  createdAt: timestamptz({ notNull }),
  role: RoleEnum.enumed({ notNull }),
});

export const Posts = table("public", "posts", {
  id: pk(),
  title: varchar({ length: 200, notNull }),
  body: text({}),
  views: integer({ notNull }),
  publishedAt: timestamptz({}),
  userId: bigint({ notNull }).references({ column: () => Users.id }),
});

export const Comments = table("public", "comments", {
  id: pk(),
  body: text({ notNull }),
  postId: bigint({ notNull }).references({ column: () => Posts.id }),
});

export const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));

export const PostsRelations = relations(Posts, () => ({
  comments: many(Comments, Comments.postId),
}));
