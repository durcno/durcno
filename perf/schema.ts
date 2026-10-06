import {
  array,
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
  tuple,
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

/**
 * Every column is a single lowercase word, so its driver key already equals its
 * camelCase output key. A `SELECT *` over this table therefore takes the
 * in-place row-conversion path, which `handle-rows.bench.ts` measures.
 */
export const Tokens = table("public", "tokens", {
  id: bigint({}),
  name: varchar({ length: 50 }),
  kind: varchar({ length: 20 }),
  bio: text({}),
  enabled: boolean({}),
});

/**
 * Wide tables for the query-construction benchmarks. A `LEFT JOIN` clones every
 * column of the joined table to make it nullable, so the cost of building the
 * columns view scales with the joined tables' column counts — these tables
 * exist to keep that cost visible and stable as the schema grows elsewhere.
 */
export const Articles = table("public", "articles", {
  id: pk(),
  slug: varchar({ length: 200, notNull }),
  title: varchar({ length: 300, notNull }),
  summary: text({}),
  body: text({}),
  authorName: varchar({ length: 120 }),
  authorEmail: varchar({ length: 200 }),
  category: varchar({ length: 80 }),
  language: varchar({ length: 16 }),
  status: varchar({ length: 32 }),
  wordCount: integer({}),
  viewCount: bigint({}),
  likeCount: bigint({}),
  commentCount: integer({}),
  isPublished: boolean({ notNull }),
  isFeatured: boolean({}),
  isArchived: boolean({}),
  publishedAt: timestamptz({}),
  createdAt: timestamptz({ notNull }),
  updatedAt: timestamptz({ notNull }),
  role: RoleEnum.enumed({ notNull }),
});

export const ArticleRevisions = table("public", "article_revisions", {
  id: pk(),
  articleId: bigint({ notNull }).references({ column: () => Articles.id }),
  revision: integer({ notNull }),
  editorName: varchar({ length: 120 }),
  editorEmail: varchar({ length: 200 }),
  changeSummary: text({}),
  previousTitle: varchar({ length: 300 }),
  previousSummary: text({}),
  previousBody: text({}),
  wordsAdded: integer({}),
  wordsRemoved: integer({}),
  isApproved: boolean({ notNull }),
  approvedAt: timestamptz({}),
  approvedBy: varchar({ length: 120 }),
  createdAt: timestamptz({ notNull }),
  createdBy: varchar({ length: 120 }),
  clientIp: varchar({ length: 45 }),
  userAgent: text({}),
  role: RoleEnum.enumed({ notNull }),
});

export const ArticleRatings = table("public", "article_ratings", {
  id: pk(),
  articleId: bigint({ notNull }).references({ column: () => Articles.id }),
  rating: integer({ notNull }),
  raterName: varchar({ length: 120 }),
  raterEmail: varchar({ length: 200 }),
  comment: text({}),
  helpfulCount: integer({}),
  isVerified: boolean({ notNull }),
  source: varchar({ length: 40 }),
  referrer: varchar({ length: 300 }),
  deviceType: varchar({ length: 40 }),
  country: varchar({ length: 80 }),
  createdAt: timestamptz({ notNull }),
  updatedAt: timestamptz({ notNull }),
  deletedAt: timestamptz({}),
  role: RoleEnum.enumed({ notNull }),
});

/** Narrow table used to time the per-cell cost of a bulk `INSERT`. */
export const Events = table("public", "events", {
  id: pk(),
  articleId: bigint({}),
  kind: varchar({ length: 60, notNull }),
  source: varchar({ length: 120 }),
  payload: text({}),
  amount: bigint({}),
  isProcessed: boolean({ notNull }),
  occurredAt: timestamptz({ notNull }),
  role: RoleEnum.enumed({ notNull }),
});

/** Carries an array column, so array literal rendering is on the filter path. */
export const Listings = table("public", "listings", {
  id: pk(),
  articleId: bigint({ notNull }).references({ column: () => Articles.id }),
  title: varchar({ length: 200, notNull }),
  tags: varchar({ length: 40, dimension: array() }),
  pairs: varchar({ length: 40, dimension: tuple(2) }),
});

/**
 * Carries `$updateFn` columns, so an `UPDATE` has to resolve which columns a
 * value function applies to. An `UPDATE` asks that question per query, which is
 * what the per-table `$updateFn` column set exists to answer.
 */
export const Sessions = table("public", "sessions", {
  id: pk(),
  token: varchar({ length: 64, notNull }),
  region: varchar({ length: 40, notNull }),
  hits: integer({ notNull }),
  bytes: bigint({}),
  agent: text({}),
  startedAt: timestamptz({ notNull }),
  lastSeenAt: timestamptz({ notNull }).$updateFn(() => new Date()),
  rotatedAt: timestamptz({ notNull }).$updateFn(() => new Date()),
});
