import { asc, desc, eq, lower } from "durcno";
import { Articles, Comments, db, Posts, Users } from "./schema";
import { type Equal, Expect } from "./utils";

type UserRow = {
  id: bigint;
  username: string;
  email: string | null;
  type: "admin" | "user";
  createdAt: Date;
  externalId: string;
  trackingId: string | null;
};

// -----------------------------------------------------------------------------
// findMany basics
// -----------------------------------------------------------------------------

const _findManyAllQuery = db.query(Users).findMany({});
type FindManyAll = Awaited<typeof _findManyAllQuery>;
Expect<Equal<FindManyAll, UserRow[]>>();

// A true map keeps only the listed columns
const _findManyColumnsQuery = db.query(Users).findMany({
  columns: { id: true, username: true },
});
type FindManyColumns = Awaited<typeof _findManyColumnsQuery>;
Expect<Equal<FindManyColumns, { id: bigint; username: string }[]>>();

// A false map excludes the listed columns
const _findManyExcludedQuery = db.query(Users).findMany({
  columns: { id: false, createdAt: false },
});
type FindManyExcluded = Awaited<typeof _findManyExcludedQuery>;
Expect<
  Equal<
    FindManyExcluded,
    {
      username: string;
      email: string | null;
      type: "admin" | "user";
      externalId: string;
      trackingId: string | null;
    }[]
  >
>();

// @ts-expect-error - non-existent column in `columns`
db.query(Users).findMany({ columns: { nonExistentColumn: true } });

// @ts-expect-error - true and false maps cannot be mixed
db.query(Users).findMany({ columns: { id: true, username: false } });

// -----------------------------------------------------------------------------
// findFirst
// -----------------------------------------------------------------------------

const _findFirstQuery = db.query(Users).findFirst({});
Expect<Equal<Awaited<typeof _findFirstQuery>, UserRow | null>>();

const _findFirstColumnsQuery = db.query(Users).findFirst({
  columns: { id: true, username: true },
});
Expect<
  Equal<
    Awaited<typeof _findFirstColumnsQuery>,
    { id: bigint; username: string } | null
  >
>();

// -----------------------------------------------------------------------------
// Where and orderBy
// -----------------------------------------------------------------------------

const _findManyFilteredQuery = db.query(Users).findMany({
  columns: { id: true, username: true, createdAt: true },
  where: eq(Users.type, "user"),
  orderBy: [asc(Users.username), desc(Users.createdAt)],
});
type FindManyFiltered = Awaited<typeof _findManyFilteredQuery>;
Expect<
  Equal<FindManyFiltered, { id: bigint; username: string; createdAt: Date }[]>
>();

// @ts-expect-error - wrong value type in `where`
db.query(Users).findMany({ where: eq(Users.id, "string_instead_of_number") });

// @ts-expect-error - column from another table in `orderBy`
db.query(Users).findMany({ orderBy: asc(Posts.createdAt) });

// -----------------------------------------------------------------------------
// Alias-based selection
// -----------------------------------------------------------------------------

const _selectQuery = db.query(Users).findMany({
  select: {
    userId: Users.id,
    name: Users.username,
    lowered: lower(Users.username),
  },
  where: eq(Users.type, "user"),
  orderBy: asc(Users.username),
  limit: 10,
});
type SelectResult = Awaited<typeof _selectQuery>;
Expect<
  Equal<SelectResult, { userId: bigint; name: string; lowered: string }[]>
>();

// `select` on a nested relation
const _selectNestedQuery = db.query(Posts).findMany({
  select: {
    postId: Posts.id,
    heading: Posts.title,
  },
  with: {
    comments: {
      select: {
        commentId: Comments.id,
        text: Comments.body,
      },
    },
  },
});
type SelectNested = Awaited<typeof _selectNestedQuery>;
Expect<
  Equal<
    SelectNested,
    {
      postId: bigint;
      heading: string | null;
      comments: { commentId: bigint; text: string | null }[];
    }[]
  >
>();

const _findFirstSelectQuery = db.query(Users).findFirst({
  select: { userId: Users.id, name: Users.username },
});
Expect<
  Equal<
    Awaited<typeof _findFirstSelectQuery>,
    { userId: bigint; name: string } | null
  >
>();

// @ts-expect-error - `select` and `columns` are mutually exclusive
db.query(Users).findMany({
  columns: { id: true },
  select: { userId: Users.id },
});

// @ts-expect-error - a select value must be a column or SqlFn
db.query(Users).findMany({ select: { whatever: 123 } });

db.query(Posts).findMany({
  select: { postId: Posts.id },
  // @ts-expect-error - nested select value must belong to the related table
  with: { comments: { select: { bad: Posts.title } } },
});

db.query(Posts).findMany({
  with: {
    comments: {
      columns: { id: true },
      // @ts-expect-error - `select` and `columns` are mutually exclusive in relations
      select: { text: Comments.body },
    },
  },
});

// -----------------------------------------------------------------------------
// Relations
// -----------------------------------------------------------------------------

// One-to-one relation
const _usersWithProfileQuery = db.query(Users).findMany({
  columns: { id: true, username: true },
  with: {
    profile: { columns: { bio: true, avatarUrl: true } },
  },
});
type UsersWithProfile = Awaited<typeof _usersWithProfileQuery>;
Expect<
  Equal<
    UsersWithProfile,
    {
      id: bigint;
      username: string;
      profile: { bio: string | null; avatarUrl: string | null } | null;
    }[]
  >
>();

// One-to-many relation
const _postsWithCommentsQuery = db.query(Posts).findMany({
  columns: { id: true, title: true },
  with: {
    comments: { columns: { id: true, body: true } },
  },
});
type PostsWithComments = Awaited<typeof _postsWithCommentsQuery>;
Expect<
  Equal<
    PostsWithComments,
    {
      id: bigint;
      title: string | null;
      comments: { id: bigint; body: string | null }[];
    }[]
  >
>();

// FK relations: a notNull FK is non-nullable, a nullable FK is optional
const _articlesWithRelationsQuery = db.query(Articles).findMany({
  columns: { id: true, title: true },
  with: {
    author: { columns: { id: true, username: true } },
    category: { columns: { id: true, name: true } },
  },
});
type ArticlesWithRelations = Awaited<typeof _articlesWithRelationsQuery>;
Expect<
  Equal<
    ArticlesWithRelations,
    {
      id: bigint;
      title: string;
      author: { id: bigint; username: string };
      category: { id: number; name: string } | null;
    }[]
  >
>();

// @ts-expect-error - non-existent relation in `with`
db.query(Users).findMany({ with: { nonExistentRelation: {} } });

db.query(Posts).findMany({
  with: {
    author: {
      // @ts-expect-error - where is not allowed on an Fk relation
      where: eq(Users.username, "foo"),
    },
  },
});

db.query(Users).findMany({
  with: {
    profile: {
      // @ts-expect-error - orderBy is not allowed on a One relation
      orderBy: asc(Users.username),
    },
  },
});

// -----------------------------------------------------------------------------
// Nested relations
// -----------------------------------------------------------------------------

const _nestedQuery = db.query(Posts).findMany({
  columns: { id: true, title: true },
  with: {
    comments: {
      columns: { id: true, body: true },
      with: {
        author: { columns: { id: true, username: true } },
      },
    },
  },
});
type NestedResult = Awaited<typeof _nestedQuery>;
Expect<
  Equal<
    NestedResult,
    {
      id: bigint;
      title: string | null;
      comments: {
        id: bigint;
        body: string | null;
        author: { id: bigint; username: string };
      }[];
    }[]
  >
>();

// An empty nested selection includes the full related row
const _nestedAllColumnsQuery = db.query(Posts).findMany({
  columns: { id: true, title: true },
  with: {
    comments: {
      with: { author: {} },
    },
  },
});
type NestedAllColumns = Awaited<typeof _nestedAllColumnsQuery>;
Expect<
  Equal<
    NestedAllColumns,
    {
      id: bigint;
      title: string | null;
      comments: {
        id: bigint;
        postId: bigint;
        userId: bigint;
        body: string | null;
        createdAt: Date;
        author: UserRow;
      }[];
    }[]
  >
>();

db.query(Posts).findMany({
  // @ts-expect-error - non-existent relation in a nested `with`
  with: { comments: { with: { nonExistentRelation: {} } } },
});
