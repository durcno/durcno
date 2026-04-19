import {
  bigint,
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

// Use MIGRATION_VERSION env var to dynamically modify schema
// "1" = initial schema (Users only)
// "2" = add Posts table and new columns to Users
const migrationVersion = parseInt(process.env.MIGRATION_VERSION || "1", 10);

// Base Users table - always exists
export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, unique, notNull }),
  email: varchar({ length: 100, notNull }),
  createdAt: timestamp({ notNull, default: now() }),
  // Add columns in version 2
  ...(migrationVersion >= 2 && {
    bio: text({}),
    age: integer({}),
  }),
});

// Posts table - added in version 2
export const Posts =
  migrationVersion >= 2
    ? table("public", "posts", {
        id: pk(),
        title: varchar({ length: 200, notNull }),
        content: text({ notNull }),
        authorId: bigint({
          notNull,
        }).references({ column: () => Users.id, onDelete: "CASCADE" }),
        publishedAt: timestamp({}),
        createdAt: timestamp({ notNull, default: now() }),
      })
    : undefined;
