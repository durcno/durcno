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

const stage = Number(process.env.STAGE ?? 1);

// Scenarios:
// - Stage 1: initial users table (table create)
// - Stage 2: add bio/age columns to users + create posts table (column add + table create)
// - Stage 3: drop bio column from users only (column drop)
// - Stage 4: drop posts table (table drop)

// Base table that always exists
export const Users = table("public", "users", {
  id: pk(),
  username: varchar({ length: 50, unique, notNull }),
  email: varchar({ length: 100, notNull }),
  createdAt: timestamp({ notNull }).default(now()),
  // Stage 2: bio and age added; Stage 3+: only age remains
  ...(stage >= 2 && stage <= 2 && { bio: text({}) }),
  ...(stage >= 2 && { age: integer({}) }),
});

// Stage 2 and 3: posts table; Stage 4+: dropped
export const Posts =
  stage >= 2 && stage <= 3
    ? table("public", "posts", {
        id: pk(),
        title: varchar({ length: 500, notNull }),
        content: text({ notNull }),
        userId: bigint({ notNull }),
        publishedAt: timestamp({}),
        createdAt: timestamp({ notNull }).default(now()),
      })
    : undefined;
