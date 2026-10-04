import {
  database,
  defineConfig,
  many,
  pk,
  relations,
  table,
  varchar,
} from "durcno";
import { pg } from "durcno/connectors/pg";
import { describe, expect, it } from "vitest";

const config = defineConfig({
  schema: "./schema.ts",
  connector: pg({
    dbCredentials: { url: "postgres://unit:unit@127.0.0.1:5432/unit" },
  }),
});

const Users = table("public", "users", {
  id: pk(),
  name: varchar({ length: 255 }),
});

const Posts = table("public", "posts", {
  id: pk(),
  title: varchar({ length: 255 }),
  userId: varchar({ length: 255 }),
});

const UsersRelations = relations(Users, () => ({
  posts: many(Posts, Posts.userId),
}));

describe("database() entity discovery", () => {
  it("registers valid tables and relations", () => {
    const db = database({ Users, Posts, UsersRelations }, config);
    expect(db.$.tables).toHaveProperty("Users");
    expect(db.$.tables).toHaveProperty("Posts");
    expect(db.$.allRelations).toHaveProperty('"public"."users"');
  });

  it("safely skips user-exported functions expecting arguments without invoking them", () => {
    let invoked = false;
    const helperWithArgs = (_a: string, _b: number) => {
      invoked = true;
      throw new Error("should not be called");
    };

    expect(() => {
      database({ Users, helperWithArgs }, config);
    }).not.toThrow();

    expect(invoked).toBe(false);
  });

  it("safely ignores zero-arg functions that throw exceptions", () => {
    const throwingHelper = () => {
      throw new Error("unexpected runtime error");
    };

    expect(() => {
      database({ Users, throwingHelper }, config);
    }).not.toThrow();
  });

  it("safely skips class constructors", () => {
    class SomeHelperClass {
      constructor() {
        throw new Error("not callable without new");
      }
    }

    expect(() => {
      database({ Users, SomeHelperClass }, config);
    }).not.toThrow();
  });

  it("safely ignores non-table, non-relation exports", () => {
    const db = database(
      {
        Users,
        someNumber: 42,
        someString: "durcno",
        someObject: { foo: "bar" },
        someNull: null,
        someUndefined: undefined,
      },
      config,
    );
    expect(db.$.tables).toHaveProperty("Users");
    expect(Object.keys(db.$.tables)).toEqual(["Users"]);
  });
});
