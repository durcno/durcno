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

const isFirstMigration = process.env.FIRST_MIGRATION !== "false";
const hasReference = process.env.HAS_REFERENCE === "true";

// Base table that always exists
export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, unique, notNull }),
  email: varchar({ length: 100, notNull }),
  createdAt: timestamp({ notNull, default: now() }),
  // Conditionally add columns based on environment variable
  ...(!isFirstMigration && {
    bio: text({}),
    age: integer({}),
  }),
});

// Conditionally create and export new table.
// When FIRST_MIGRATION is true, export undefined which will be filtered out by the CLI.
// userId starts without a FK reference; HAS_REFERENCE=true adds it in a subsequent migration.
export const Posts = !isFirstMigration
  ? table("public", "posts", {
      id: pk(),
      title: varchar({ length: 500, notNull }),
      content: text({ notNull }),
      userId: hasReference
        ? bigint({
            notNull,
          }).references({ column: () => Users.id, onDelete: "CASCADE" })
        : bigint({ notNull }),
      publishedAt: timestamp({}),
      createdAt: timestamp({ notNull, default: now() }),
    })
  : undefined;
