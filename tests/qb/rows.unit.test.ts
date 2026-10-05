import {
  array,
  bigint,
  boolean,
  database,
  date,
  defineConfig,
  eq,
  integer,
  many,
  notNull,
  numeric,
  one,
  pk,
  relations,
  sql,
  table,
  text,
  timestamptz,
  varchar,
} from "durcno";
import { pg } from "durcno/connectors/pg";
import { describe, expect, it } from "vitest";

/**
 * Row-conversion (`handleRows`) unit tests. No database is involved: driver rows
 * are handed to `handleRows` directly, so the conversion plan — resolved from
 * the first row and replayed for every sibling — is exercised in isolation.
 */

const Users = table("public", "users", {
  id: pk(),
  userName: varchar({ length: 50, notNull }),
  email: varchar({ length: 100 }),
  age: integer({}),
  points: bigint({}),
  isActive: boolean({ notNull }),
  birthDate: date({}),
  createdAt: timestamptz({ notNull }),
  bio: text({}),
});

/**
 * Every column is a single lowercase word, so each driver key already equals
 * its output key and a `SELECT *` takes the in-place conversion path.
 */
const Tokens = table("public", "tokens", {
  id: bigint({}),
  name: varchar({ length: 50 }),
  kind: varchar({ length: 20 }),
  price: numeric({}),
  enabled: boolean({}),
});

/** Carries an array column, which keeps the full `fromDriver` path. */
const Labels = table("public", "labels", {
  id: bigint({}),
  tags: varchar({ length: 20, dimension: array() }),
});

/**
 * The same shape as {@link Tokens} with one snake_case column, so a `SELECT *`
 * over it takes the allocating conversion path.
 */
const Items = table("public", "items", {
  id: bigint({}),
  itemName: varchar({ length: 50 }),
  kind: varchar({ length: 20 }),
  price: numeric({}),
  enabled: boolean({}),
});

const Profiles = table("public", "profiles", {
  id: pk(),
  userId: bigint({ notNull }),
  website: varchar({ length: 200 }),
});

const Posts = table("public", "posts", {
  id: pk(),
  title: varchar({ length: 200, notNull }),
  userId: bigint({ notNull }),
});

const Comments = table("public", "comments", {
  id: pk(),
  body: text({ notNull }),
  postId: bigint({ notNull }),
});

const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
  profile: one(Profiles, Profiles.userId),
}));

const PostsRelations = relations(Posts, () => ({
  comments: many(Comments, Comments.postId),
}));

const db = database(
  {
    Users,
    Tokens,
    Labels,
    Items,
    Profiles,
    Posts,
    Comments,
    UsersRelations,
    PostsRelations,
  },
  defineConfig({
    schema: "./schema.ts",
    // Never connected to: the pool is lazy and no query is ever issued.
    connector: pg({
      dbCredentials: { url: "postgres://unit:unit@127.0.0.1:5432/unit" },
    }),
  }),
);

/** A driver row for `users`: snake_case keys, driver-native value types. */
function driverUser(i: number) {
  return {
    id: String(i),
    user_name: `user_${i}`,
    email: `user_${i}@example.com`,
    age: 30,
    points: String(i * 100),
    is_active: true,
    birth_date: new Date(1990, 4, 17),
    created_at: new Date(2024, 0, 2),
    bio: null,
  };
}

/** A driver row for `tokens`: keys already equal their output keys. */
function driverToken(i: number) {
  return {
    id: String(i),
    name: `token_${i}`,
    kind: i % 2 === 0 ? "a" : "b",
    price: `${i}.50`,
    enabled: i % 3 === 0,
  };
}

describe("select handleRows", () => {
  it("converts a star result to camelCase keys", () => {
    const rows = db
      .from(Users)
      .select("*")
      .handleRows([driverUser(1), driverUser(2)]);

    expect(rows).toEqual([
      {
        id: 1n,
        userName: "user_1",
        email: "user_1@example.com",
        age: 30,
        points: 100n,
        isActive: true,
        birthDate: new Date(Date.UTC(1990, 4, 17)),
        createdAt: new Date(2024, 0, 2),
        bio: null,
      },
      {
        id: 2n,
        userName: "user_2",
        email: "user_2@example.com",
        age: 30,
        points: 200n,
        isActive: true,
        birthDate: new Date(Date.UTC(1990, 4, 17)),
        createdAt: new Date(2024, 0, 2),
        bio: null,
      },
    ]);
  });

  it("leaves the driver rows untouched when a key has to be renamed", () => {
    const driver = driverUser(1);
    db.from(Users).select("*").handleRows([driver]);
    expect(driver.id).toBe("1");
    expect(driver.user_name).toBe("user_1");
  });

  it("returns an empty array for an empty result", () => {
    expect(db.from(Users).select("*").handleRows([])).toEqual([]);
    expect(
      db
        .from(Users)
        .select(() => ({ id: Users.id }))
        .handleRows([]),
    ).toEqual([]);
  });

  it("converts each item of an explicit projection by its own kind", () => {
    const rows = db
      .from(Users)
      .select(() => ({
        id: Users.id,
        userName: Users.userName,
        age: Users.age,
        missing: null,
        isActive: Users.isActive,
        big: 1n,
        flag: true,
        count: 3,
        raw: sql`1`,
        literalText: "kept",
      }))
      .handleRows([
        {
          id: "7",
          userName: "user_7",
          age: 41,
          missing: "ignored",
          isActive: true,
          big: "10",
          flag: "true",
          count: "5",
          raw: 1,
          literalText: "kept",
        },
      ]);

    expect(rows).toEqual([
      {
        id: 7n,
        userName: "user_7",
        age: 41,
        missing: null,
        isActive: true,
        big: 10n,
        flag: true,
        count: 5,
        raw: 1,
        literalText: "kept",
      },
    ]);
  });

  it("maps NULL driver values of literal projections to null", () => {
    const rows = db
      .from(Users)
      .select(() => ({ big: 1n, flag: true, count: 1 }))
      .handleRows([{ big: null, flag: undefined, count: null }]);

    expect(rows).toEqual([{ big: null, flag: null, count: null }]);
  });

  it("reuses the conversion plan across executions", async () => {
    const query = db.from(Users).select("*");
    const first = query.handleRows([driverUser(1)]);
    const second = query.handleRows([driverUser(3), driverUser(4)]);

    expect(first[0].userName).toBe("user_1");
    expect(second.map((r) => r.userName)).toEqual(["user_3", "user_4"]);
    expect(second.map((r) => r.id)).toEqual([3n, 4n]);
  });

  it("converts joined columns of a star result", () => {
    const rows = db
      .from(Users)
      .innerJoin(Posts, () => eq(Posts.userId, Users.id))
      .select("*")
      .handleRows([
        {
          id: "1",
          user_name: "user_1",
          email: null,
          age: null,
          points: null,
          is_active: true,
          birth_date: null,
          created_at: new Date(2024, 0, 2),
          bio: null,
          title: "hello",
          user_id: "1",
        },
      ]);

    expect(rows).toEqual([
      {
        id: 1n,
        userName: "user_1",
        email: null,
        age: null,
        points: null,
        isActive: true,
        birthDate: null,
        createdAt: new Date(2024, 0, 2),
        bio: null,
        title: "hello",
        userId: 1n,
      },
    ]);
  });

  it("throws when a driver key belongs to no table", () => {
    expect(() =>
      db
        .from(Users)
        .select("*")
        .handleRows([{ ...driverUser(1), not_a_column: "x" }]),
    ).toThrow("Column not_a_column not found in any table");
  });
});

describe("star handleRows conversion paths", () => {
  it("converts in place when every driver key is already an output key", () => {
    const rows = db
      .from(Tokens)
      .select("*")
      .handleRows([driverToken(2)]);

    expect(rows).toEqual([
      { id: 2n, name: "token_2", kind: "a", price: "2.50", enabled: false },
    ]);
  });

  it("aliases the driver's row objects on the in-place path", () => {
    // Deliberate behaviour: when no key has to be renamed there is nothing to
    // copy, so the driver's own rows are converted and handed back.
    const driver = [driverToken(1), driverToken(2)];
    const rows = db.from(Tokens).select("*").handleRows(driver);

    expect(rows).toBe(driver);
    expect(rows[0]).toBe(driver[0]);
    expect(rows[1]).toBe(driver[1]);
  });

  it("returns fresh row objects when any key has to be renamed", () => {
    // `Items` mixes single-word columns (`id`, `kind`) with a snake_case
    // one, so one rename is enough to force the allocating path.
    const driver = [
      { id: "1", item_name: "n1", kind: "a", price: "1.50", enabled: true },
      { id: "2", item_name: "n2", kind: "b", price: "2.50", enabled: false },
    ];
    const rows = db.from(Items).select("*").handleRows(driver);

    expect(rows).not.toBe(driver);
    expect(rows[0]).not.toBe(driver[0]);
    expect(driver[0].item_name).toBe("n1");
    expect(rows[0].itemName).toBe("n1");
  });

  it("produces equal values on both paths for the same data", () => {
    // `Tokens` takes the in-place path; `Items` is the same shape with one
    // snake_case column, forcing the allocating path.
    const values = [
      { id: "1", name: "n1", kind: "a", price: "1.50", enabled: true },
      { id: "2", name: null, kind: null, price: null, enabled: false },
      { id: "3", name: "n3", kind: "b", price: "3.00", enabled: null },
    ];

    const inPlace = db
      .from(Tokens)
      .select("*")
      .handleRows(values.map((v) => ({ ...v })));
    const allocating = db
      .from(Items)
      .select("*")
      .handleRows(
        values.map((v) => ({
          id: v.id,
          item_name: v.name,
          kind: v.kind,
          price: v.price,
          enabled: v.enabled,
        })),
      );

    // Rename the one differing key back, then the two results must be
    // identical — including the NULL columns.
    const renamed = allocating.map((row) => ({
      id: row.id,
      name: row.itemName,
      kind: row.kind,
      price: row.price,
      enabled: row.enabled,
    }));

    expect(inPlace).toEqual([
      { id: 1n, name: "n1", kind: "a", price: "1.50", enabled: true },
      { id: 2n, name: null, kind: null, price: null, enabled: false },
      { id: 3n, name: "n3", kind: "b", price: "3.00", enabled: null },
    ]);
    expect(renamed).toEqual(inPlace);
  });

  it("maps NULL to null on both paths", () => {
    const inPlace = db
      .from(Tokens)
      .select("*")
      .handleRows([
        { id: "1", name: null, kind: null, price: null, enabled: null },
      ]);
    const allocating = db
      .from(Items)
      .select("*")
      .handleRows([
        { id: null, item_name: null, kind: null, price: null, enabled: null },
      ]);

    expect(inPlace).toEqual([
      { id: 1n, name: null, kind: null, price: null, enabled: null },
    ]);
    expect(allocating[0]).toEqual({
      id: null,
      itemName: null,
      kind: null,
      price: null,
      enabled: null,
    });
  });

  it("converts an array-dimension column through the full driver path", () => {
    const allocating = db
      .from(Labels)
      .select("*")
      .handleRows([{ id: "1", tags: ["a", "b"] }]);
    expect(allocating).toEqual([{ id: 1n, tags: ["a", "b"] }]);

    // Postgres may also hand arrays back as a literal string.
    const asString = db
      .from(Labels)
      .select("*")
      .handleRows([{ id: "2", tags: "{a,b}" }]);
    expect(asString).toEqual([{ id: 2n, tags: ["a", "b"] }]);
  });

  it("maps a NULL array-dimension column to null on the in-place path", () => {
    const rows = db
      .from(Labels)
      .select("*")
      .handleRows([{ id: "1", tags: null }]);

    expect(rows).toEqual([{ id: 1n, tags: null }]);
  });

  it("keeps a key absent from the first row, unconverted, in place", () => {
    // The plan comes from the first row's keys, so a later row's extra key
    // is never planned. The allocating path dropped it; in place it
    // survives as-is.
    const second = { ...driverToken(2), surprise: "raw" };
    const rows = db
      .from(Tokens)
      .select("*")
      .handleRows([driverToken(1), second]);

    expect(rows[1]).toBe(second);
    expect(second.id).toBe(2n);
    expect(second.surprise).toBe("raw");
  });
});

describe("relational handleRows", () => {
  /** A driver row for a relational `users` result: camelCase keys. */
  function relationalUser(i: number) {
    return {
      id: String(i),
      userName: `user_${i}`,
      email: `user_${i}@example.com`,
      age: 30,
      points: String(i * 100),
      isActive: true,
      birthDate: new Date(1990, 4, 17),
      createdAt: new Date(2024, 0, 2),
      bio: null,
      posts: [
        { id: String(i * 10), title: `post ${i}`, userId: String(i) },
        { id: String(i * 10 + 1), title: `post ${i} again`, userId: String(i) },
      ],
      profile: { id: "1", userId: String(i), website: "https://example.com" },
    };
  }

  it("converts every level of the relation tree", () => {
    const rows = db
      .query(Users)
      .findMany({ with: { posts: {}, profile: {} } })
      .handleRows([relationalUser(1), relationalUser(2)]);

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(1n);
    expect(rows[0].points).toBe(100n);
    expect(rows[0].birthDate).toEqual(new Date(Date.UTC(1990, 4, 17)));
    expect(rows[0].posts).toEqual([
      { id: 10n, title: "post 1", userId: 1n },
      { id: 11n, title: "post 1 again", userId: 1n },
    ]);
    expect(rows[0].profile).toEqual({
      id: 1n,
      userId: 1n,
      website: "https://example.com",
    });
    expect(rows[1].posts[1].id).toBe(21n);
  });

  it("handles empty and null relations", () => {
    const rows = db
      .query(Users)
      .findMany({ with: { posts: {}, profile: {} } })
      .handleRows([{ ...relationalUser(1), posts: [], profile: null }]);

    expect(rows[0].posts).toEqual([]);
    expect(rows[0].profile).toBeNull();
  });

  it("reuses the conversion plan of each level across rows", () => {
    const query = db
      .query(Users)
      .findMany({ with: { posts: {}, profile: {} } });
    const rows = query.handleRows([
      relationalUser(1),
      relationalUser(2),
      relationalUser(3),
    ]);

    expect(rows.map((r) => r.id)).toEqual([1n, 2n, 3n]);
    expect(rows.map((r) => r.posts.length)).toEqual([2, 2, 2]);
  });

  it("returns the rows untouched for an empty result", () => {
    const rows = db.query(Users).findMany({}).handleRows([]);
    expect(rows).toEqual([]);
  });

  it("locks applies ordering with two relations and a nested with", () => {
    const driver = {
      ...relationalUser(1),
      posts: [
        {
          id: "10",
          title: "post 1",
          userId: "1",
          comments: [
            { id: "100", body: "first", postId: "10" },
            { id: "101", body: "second", postId: "10" },
          ],
        },
        { id: "11", title: "post 1 again", userId: "1", comments: [] },
      ],
    };

    const rows = db
      .query(Users)
      .findMany({
        with: { posts: { with: { comments: {} } }, profile: {} },
      })
      .handleRows([driver]);

    expect(rows[0].posts).toEqual([
      {
        id: 10n,
        title: "post 1",
        userId: 1n,
        comments: [
          { id: 100n, body: "first", postId: 10n },
          { id: 101n, body: "second", postId: 10n },
        ],
      },
      { id: 11n, title: "post 1 again", userId: 1n, comments: [] },
    ]);
    expect(rows[0].profile).toEqual({
      id: 1n,
      userId: 1n,
      website: "https://example.com",
    });
  });

  it("passes unknown keys through untouched", () => {
    // Rows are converted in place, so the driver row is the result row.
    const driver = {
      ...relationalUser(1),
      aggregate: { count: "3" },
      extra: "kept",
    };
    const rows = db
      .query(Users)
      .findMany({ with: { posts: {} } })
      .handleRows([driver]);

    expect(rows[0]).toBe(driver);
    expect(driver.aggregate).toEqual({ count: "3" });
    expect(driver.extra).toBe("kept");
    expect(rows[0].points).toBe(100n);
  });
});

describe("returning handleRows", () => {
  const values = {
    userName: "returning",
    isActive: true,
    createdAt: new Date(2024, 0, 2),
  };

  /** Every column of `users` as a driver row, in SQL (snake_case) keys. */
  function fullDriverUser() {
    return driverUser(9);
  }

  it("converts an inclusion projection", () => {
    const rows = db
      .insertInto(Users)
      .values(values)
      .returning({ id: true, userName: true })
      .handleRows([{ id: "9", user_name: "returning" }]);

    expect(rows).toEqual([{ id: 9n, userName: "returning" }]);
  });

  it("converts an exclusion projection, which returns every other column", () => {
    const query = db.insertInto(Users).values(values).returning({ bio: false });
    const driver = fullDriverUser();
    // The clause excludes `bio`, so the driver omits it.
    const { bio: _bio, ...returned } = driver;
    const returningClause = query.toQuery().sql.split("RETURNING ")[1];
    expect(returningClause).not.toContain('"bio"');
    expect(returningClause).toContain('"user_name"');

    const rows = query.handleRows([returned]);
    expect(Object.keys(rows[0])).toEqual([
      "id",
      "userName",
      "email",
      "age",
      "points",
      "isActive",
      "birthDate",
      "createdAt",
    ]);
    expect(rows[0].id).toBe(9n);
    expect(rows[0].points).toBe(900n);
    expect(rows[0].isActive).toBe(true);
  });

  it("converts an update projection", () => {
    const rows = db
      .update(Users)
      .set({ userName: "renamed" })
      .where(eq(Users.id, 9n))
      .returning({ createdAt: true })
      .handleRows([{ created_at: new Date(2024, 0, 2) }]);

    expect(rows).toEqual([{ createdAt: new Date(2024, 0, 2) }]);
  });

  it("converts a delete projection and an empty result", () => {
    const query = db.deleteFrom(Users).where(eq(Users.id, 9n)).returning("*");

    expect(query.handleRows([fullDriverUser()])[0].userName).toBe("user_9");
    expect(query.handleRows([])).toEqual([]);
  });
});
